/**
 * lib/ingest/chunker.ts
 *
 * Structure-aware text chunking.
 * Simple implementation for M1: splits by paragraphs, merges up to chunk size, overlaps.
 */

import { INGESTION } from "@/lib/brain/config";

export interface Chunk {
  text: string;
  index: number;
}

/**
 * A basic word-count based token estimator.
 * In a real production system, use tiktoken.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

export function chunkText(text: string): Chunk[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: Chunk[] = [];
  let currentText = "";
  let currentTokens = 0;
  let index = 0;

  for (const p of paragraphs) {
    const pTokens = estimateTokens(p);

    // If a single paragraph is too large, just add it as its own chunk (or we could split it further)
    if (pTokens > INGESTION.chunkSize) {
      if (currentText) {
        chunks.push({ text: currentText.trim(), index: index++ });
        currentText = "";
        currentTokens = 0;
      }
      chunks.push({ text: p, index: index++ });
      continue;
    }

    if (currentTokens + pTokens > INGESTION.chunkSize) {
      chunks.push({ text: currentText.trim(), index: index++ });
      // Keep overlap from previous chunk
      // This is a naive overlap: taking the last N words
      const words = currentText.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(INGESTION.chunkOverlap / 1.3));
      currentText = overlapWords.join(" ") + "\n\n" + p;
      currentTokens = estimateTokens(currentText);
    } else {
      currentText += (currentText ? "\n\n" : "") + p;
      currentTokens += pTokens;
    }
  }

  if (currentText) {
    chunks.push({ text: currentText.trim(), index: index++ });
  }

  return chunks;
}
