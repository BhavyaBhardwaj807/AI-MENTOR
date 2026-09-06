/**
 * lib/retrieval/memory-adapter.ts
 *
 * Retrieval adapter that fetches the active user's long-term
 * memories (mastery and confusion events) from Qdrant.
 */

import { qdrant, COLLECTIONS } from "@/lib/qdrant";
import { generateEmbedding } from "@/lib/embeddings";
import {
  RetrievalAdapter,
  QueryContext,
  RetrievalResult,
  SourceType,
} from "./types";

export class MemoryRetrievalAdapter implements RetrievalAdapter {
  readonly name = "StudentMemoryAdapter";
  readonly sourceType: SourceType = "student_memory";

  async retrieve(
    query: string,
    context: QueryContext,
  ): Promise<RetrievalResult[]> {
    if (!context.classId || !context.studentId) {
      return [];
    }

    const queryVector = await generateEmbedding(query);

    const results = await qdrant.query(COLLECTIONS.STUDENT_MEMORIES, {
      query: queryVector,
      limit: context.maxResults,
      score_threshold: context.scoreThreshold,
      filter: {
        must: [
          { key: "class_id", match: { value: context.classId } },
          { key: "student_id", match: { value: context.studentId } }
        ],
      },
      with_payload: true,
    });

    return results.points.map((res) => {
      const payload = res.payload as Record<string, unknown>;
      const content = typeof payload.content === "string" ? payload.content : "";
      const concept = typeof payload.concept === "string" ? payload.concept : "unknown";
      return {
        content,
        source: `memory:${res.id}`,
        sourceType: this.sourceType,
        score: res.score,
        permissions: "student-private",
        metadata: payload,
        citation: `Student History (Concept: ${concept})`,
      };
    });
  }
}
