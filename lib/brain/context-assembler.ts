/**
 * lib/brain/context-assembler.ts
 *
 * Orchestrates retrieval adapters and formats results into LLM context.
 */

import { QueryContext, RetrievalAdapter, RetrievalResult } from "@/lib/retrieval/types";
import { CourseRetrievalAdapter } from "@/lib/retrieval/course-adapter";
import { LiveContextAdapter } from "@/lib/retrieval/live-context-adapter";
import { MemoryRetrievalAdapter } from "@/lib/retrieval/memory-adapter";
import { GraphRetrievalAdapter } from "@/lib/retrieval/graph-adapter";
import { RETRIEVAL } from "./config";
import { brainLog as logger } from "@/lib/logger";

const adapters: RetrievalAdapter[] = [
  new CourseRetrievalAdapter(),
  new LiveContextAdapter(),
  new MemoryRetrievalAdapter(),
  new GraphRetrievalAdapter(),
];

export async function assembleContext(
  query: string,
  contextParams: QueryContext,
): Promise<{ text: string; results: RetrievalResult[] }> {
  const startTime = Date.now();
  
  // 1. Run all adapters in parallel
  const retrievalPromises = adapters.map(async (adapter) => {
    try {
      const results = await adapter.retrieve(query, {
        ...contextParams,
        maxResults: RETRIEVAL.courseTopK, // Customize per adapter later
      });
      return results;
    } catch (err) {
      logger.error({ adapter: adapter.name, err }, "Retrieval adapter failed");
      return [];
    }
  });

  const allResultsNested = await Promise.all(retrievalPromises);
  let allResults = allResultsNested.flat();

  // 2. Sort by score descending
  allResults.sort((a, b) => b.score - a.score);

  // 3. Take top N overall (Reranking/RRF can go here later)
  allResults = allResults.slice(0, RETRIEVAL.rerankTopN);

  // 4. Format for LLM
  if (allResults.length === 0) {
    return { text: "No relevant context found.", results: [] };
  }

  const contextBlocks = allResults.map((r, i) => {
    return `[Source ${i + 1}: ${r.citation}]\n${r.content}`;
  });

  const formattedContext = contextBlocks.join("\n\n---\n\n");
  
  logger.info({ 
    query, 
    resultsCount: allResults.length, 
    latencyMs: Date.now() - startTime 
  }, "Context assembled");

  return {
    text: formattedContext,
    results: allResults,
  };
}
