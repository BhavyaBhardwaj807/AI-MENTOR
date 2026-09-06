/**
 * lib/embeddings/index.ts
 *
 * Embedding generation client with Redis caching.
 */

import { redis } from "@/lib/redis";
import {
  EMBEDDING_API_KEY,
  EMBEDDING_BASE_URL,
  EMBEDDING_MODEL,
  EMBEDDING_CACHE_TTL,
} from "@/lib/brain/config";
import { createHash } from "crypto";

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

/**
 * Generate a SHA-256 hash for caching.
 */
function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Generate an embedding for a single string.
 * Checks Redis cache first.
 */
export async function generateEmbedding(
  text: string,
  options?: EmbeddingOptions,
): Promise<number[]> {
  const model = options?.model || EMBEDDING_MODEL;
  const cacheKey = `embed:${model}:${hashText(text)}`;

  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as number[];
    } catch {
      // ignore parse error and re-fetch
    }
  }

  // 2. Fetch from OpenAI-compatible API
  const body: Record<string, unknown> = {
    model,
    input: text,
  };

  if (options?.dimensions) {
    body.dimensions = options.dimensions;
  }

  const res = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Embedding failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const embedding = data.data?.[0]?.embedding;

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Invalid embedding response from API");
  }

  // 3. Update cache (fire and forget)
  redis.set(cacheKey, JSON.stringify(embedding), "EX", EMBEDDING_CACHE_TTL).catch(() => {});

  return embedding;
}

/**
 * Generate embeddings for an array of strings in batches.
 * Caches individually.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options?: EmbeddingOptions,
): Promise<number[][]> {
  const model = options?.model || EMBEDDING_MODEL;
  const results: number[][] = new Array(texts.length);
  const cacheKeys = texts.map((t) => `embed:${model}:${hashText(t)}`);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  // 1. Bulk check cache using mget
  const cachedValues = await redis.mget(...cacheKeys);

  for (let i = 0; i < texts.length; i++) {
    const cached = cachedValues[i];
    if (cached) {
      try {
        results[i] = JSON.parse(cached);
        continue;
      } catch {
        // ignore parse error
      }
    }
    uncachedIndices.push(i);
    uncachedTexts.push(texts[i]);
  }

  if (uncachedTexts.length === 0) {
    return results;
  }

  // 2. Fetch uncached items
  const body: Record<string, unknown> = {
    model,
    input: uncachedTexts,
  };

  if (options?.dimensions) {
    body.dimensions = options.dimensions;
  }

  const res = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Bulk embedding failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const embeddings = data.data;

  if (!embeddings || !Array.isArray(embeddings)) {
    throw new Error("Invalid bulk embedding response from API");
  }

  // 3. Merge results and cache
  const cachePipeline = redis.pipeline();

  for (const item of embeddings) {
    const originalIndex = uncachedIndices[item.index];
    results[originalIndex] = item.embedding;
    cachePipeline.set(
      cacheKeys[originalIndex],
      JSON.stringify(item.embedding),
      "EX",
      EMBEDDING_CACHE_TTL
    );
  }

  await cachePipeline.exec().catch(() => {});

  return results;
}
