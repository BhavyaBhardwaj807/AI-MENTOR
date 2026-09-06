/**
 * lib/retrieval/graph-adapter.ts
 *
 * GraphRAG Retrieval Adapter.
 * Identifies confused concepts and queries Neo4j for unmastered prerequisites.
 */

import { runQuery } from "@/lib/neo4j";
import { RetrievalAdapter, QueryContext, RetrievalResult, SourceType } from "./types";

export class GraphRetrievalAdapter implements RetrievalAdapter {
  readonly name = "GraphRAGAdapter";
  readonly sourceType: SourceType = "graph";

  async retrieve(query: string, context: QueryContext): Promise<RetrievalResult[]> {
    if (!context.classId || !context.studentId || !context.confusedConcepts || context.confusedConcepts.length === 0) {
      return [];
    }

    const results: RetrievalResult[] = [];

    for (const concept of context.confusedConcepts) {
      // Find up to 3 levels of prerequisites.
      // We check if the student has a MASTERED edge.
      const cypher = `
        MATCH (c:Concept {name: $concept, classId: $classId})
        OPTIONAL MATCH path = (c)-[:REQUIRES*1..3]->(pre:Concept)
        OPTIONAL MATCH (s:Student {id: $studentId})-[m:MASTERED]->(pre)
        RETURN
          pre.name AS prereq,
          coalesce(m.confidence, 0.0) AS mastery,
          length(path) AS depth
        ORDER BY depth ASC
      `;

      try {
        const res = await runQuery(cypher, {
          concept,
          classId: context.classId,
          studentId: context.studentId,
        });

        const gaps: string[] = [];
        for (const record of res.records) {
          const prereq = record.get("prereq");
          const mastery = record.get("mastery");

          // If the student doesn't understand the prerequisite (confidence < 0.6)
          if (prereq && mastery < 0.6) {
            gaps.push(prereq);
          }
        }

        if (gaps.length > 0) {
          // Remove duplicates
          const uniqueGaps = Array.from(new Set(gaps));

          results.push({
            content: `[TEACHING STRATEGY] Before explaining "${concept}", this student lacks prerequisite knowledge. You MUST explain these concepts first: ${uniqueGaps.join(", ")}. Then build up to the main concept.`,
            source: `graph:prereqs:${concept}`,
            sourceType: this.sourceType,
            score: 1.0, // High score so it dictates the AI's behavior
            permissions: "student-private",
            metadata: { confusedConcept: concept, gaps: uniqueGaps },
            citation: `Prerequisite Knowledge Graph`,
          });
        }
      } catch (err) {
        console.error("GraphRAG query failed for concept:", concept, err);
      }
    }

    return results;
  }
}
