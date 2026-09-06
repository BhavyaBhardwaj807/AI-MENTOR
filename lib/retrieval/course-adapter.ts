/**
 * lib/retrieval/course-adapter.ts
 *
 * Retrieval adapter for course materials using Qdrant.
 */

import { qdrant, COLLECTIONS } from "@/lib/qdrant";
import { generateEmbedding } from "@/lib/embeddings";
import {
  RetrievalAdapter,
  QueryContext,
  RetrievalResult,
  SourceType,
} from "./types";

export class CourseRetrievalAdapter implements RetrievalAdapter {
  readonly name = "CourseMaterialAdapter";
  readonly sourceType: SourceType = "course";

  async retrieve(
    query: string,
    context: QueryContext,
  ): Promise<RetrievalResult[]> {
    if (!context.classId) {
      return [];
    }

    // Generate query embedding
    const queryVector = await generateEmbedding(query);

    try {
      // Perform hybrid/dense search in Qdrant
      // For M1, just dense search
      const results = await qdrant.query(COLLECTIONS.COURSE_KNOWLEDGE, {
        query: queryVector,
        limit: context.maxResults,
        score_threshold: context.scoreThreshold,
        filter: {
          must: [
            {
              key: "class_id",
              match: {
                value: context.classId,
              },
            },
          ],
        },
        with_payload: true,
      });

      return results.points.map((res) => {
        const payload = res.payload as Record<string, unknown>;
        const materialId = String(payload.material_id ?? "unknown");
        const chunkIndex = String(payload.chunk_index ?? "unknown");
        const content = typeof payload.content === "string" ? payload.content : "";
        const citation = typeof payload.source === "string" ? payload.source : "Course Material";
        return {
          content,
          source: `course:${materialId}:chunk-${chunkIndex}`,
          sourceType: this.sourceType,
          score: res.score,
          permissions: "class",
          metadata: payload,
          citation,
        };
      });
    } catch (error) {
      const err = error as Record<string, unknown>;
      if (err?.status === 404) return [];
      console.error("[CourseRetrievalAdapter] query failed:", err);
      return [];
    }
  }
}
