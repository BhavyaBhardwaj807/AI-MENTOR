/**
 * lib/brain/config.ts
 *
 * Centralized, environment-driven configuration for the AI Brain.
 * Every tunable parameter lives here. Nothing is hardcoded in retrieval
 * or generation code.
 *
 * All LLM model references are separate env vars so each subsystem
 * can be independently pointed at different models via .env.
 */

// ── LLM models ─────────────────────────────────────────────────────────

/** Model used by the brain server for answer generation (Agora voice path). */
export const LLM_BRAIN_MODEL =
  process.env.LLM_BRAIN_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";

/** Model used by the classify-turn worker (concept extraction, intent). */
export const LLM_CLASSIFY_MODEL =
  process.env.LLM_CLASSIFY_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";

/** Model used by the dreaming worker (learning event extraction). */
export const LLM_DREAM_MODEL =
  process.env.LLM_DREAM_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";

/** Model used for validation / LLM-as-judge. */
export const LLM_VALIDATION_MODEL =
  process.env.LLM_VALIDATION_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";

// ── LLM provider ──────────────────────────────────────────────────────

export const LLM_API_KEY = process.env.LLM_API_KEY || "";
export const LLM_BASE_URL = (
  process.env.LLM_BASE_URL || "https://api.openai.com/v1"
).replace(/\/$/, "");

// ── Embedding ─────────────────────────────────────────────────────────

export const EMBEDDING_API_KEY =
  process.env.EMBEDDING_API_KEY || process.env.LLM_API_KEY || "";
export const EMBEDDING_BASE_URL = (
  process.env.EMBEDDING_BASE_URL ||
  process.env.LLM_BASE_URL ||
  "https://api.openai.com/v1"
).replace(/\/$/, "");
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = parseInt(
  process.env.EMBEDDING_DIMENSIONS || "1536",
  10,
);

// ── Retrieval parameters ──────────────────────────────────────────────

export const RETRIEVAL = {
  /** Candidates from course_knowledge collection */
  courseTopK: parseInt(process.env.RETRIEVAL_COURSE_TOP_K || "5", 10),

  /** Candidates from classroom_episodes collection */
  transcriptTopK: parseInt(process.env.RETRIEVAL_TRANSCRIPT_TOP_K || "5", 10),

  /** Candidates from student_memories collection */
  studentTopK: parseInt(process.env.RETRIEVAL_STUDENT_TOP_K || "4", 10),

  /** Minimum similarity score for inclusion (0-1) */
  scoreThreshold: parseFloat(
    process.env.RETRIEVAL_SCORE_THRESHOLD || "0.70",
  ),

  /** Final context items after reranking */
  rerankTopN: parseInt(process.env.RETRIEVAL_RERANK_TOP_N || "5", 10),

  /** Token budget for retrieved context block */
  maxContextTokens: parseInt(
    process.env.RETRIEVAL_MAX_CONTEXT_TOKENS || "2500",
    10,
  ),

  /** Diversity cap: no single source type > this percentage of context */
  maxSingleSourcePercent: parseFloat(
    process.env.RETRIEVAL_MAX_SINGLE_SOURCE_PERCENT || "0.60",
  ),

  /** RRF fusion constant */
  rrfK: parseInt(process.env.RETRIEVAL_RRF_K || "60", 10),
} as const;

// ── Voice latency budgets ─────────────────────────────────────────────

export const LATENCY = {
  /** Fast path: max ms to first LLM token */
  fastPathMaxMs: parseInt(process.env.LATENCY_FAST_PATH_MAX_MS || "600", 10),

  /** Slow path: max ms for filler phrase */
  fillerMaxMs: parseInt(process.env.LATENCY_FILLER_MAX_MS || "200", 10),

  /** Slow path: max total ms for full answer (including retrieval) */
  slowPathMaxMs: parseInt(process.env.LATENCY_SLOW_PATH_MAX_MS || "4000", 10),

  /** Max response tokens for voice output */
  maxVoiceTokens: parseInt(
    process.env.LATENCY_MAX_VOICE_TOKENS || "200",
    10,
  ),

  /** Max response tokens for text output */
  maxTextTokens: parseInt(process.env.LATENCY_MAX_TEXT_TOKENS || "500", 10),
} as const;

// ── Validation thresholds ─────────────────────────────────────────────

export const VALIDATION = {
  /** Min groundedness score to pass */
  minGroundedness: parseFloat(
    process.env.VALIDATION_MIN_GROUNDEDNESS || "0.7",
  ),

  /** Min mean retrieval score to proceed (below = abstain) */
  minRetrievalConfidence: parseFloat(
    process.env.VALIDATION_MIN_RETRIEVAL_CONFIDENCE || "0.5",
  ),

  /** Max retries after validation failure */
  maxRetries: parseInt(process.env.VALIDATION_MAX_RETRIES || "1", 10),
} as const;

// ── Ingestion ─────────────────────────────────────────────────────────

export const INGESTION = {
  /** Max upload file size in bytes (50 MB) */
  maxFileSizeBytes: parseInt(
    process.env.INGESTION_MAX_FILE_SIZE || String(50 * 1024 * 1024),
    10,
  ),

  /** Chunk size in tokens */
  chunkSize: parseInt(process.env.INGESTION_CHUNK_SIZE || "512", 10),

  /** Chunk overlap in tokens */
  chunkOverlap: parseInt(process.env.INGESTION_CHUNK_OVERLAP || "64", 10),

  /** Allowed MIME types */
  allowedMimeTypes: [
    "application/pdf",
    "text/plain",
    "text/markdown",
  ] as readonly string[],
} as const;

// ── File storage ──────────────────────────────────────────────────────

/** Local upload directory (default for dev; Docker volume in prod) */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./data/uploads";

// ── Embedding cache TTL ───────────────────────────────────────────────

/** TTL for cached embeddings in Redis, in seconds */
export const EMBEDDING_CACHE_TTL = parseInt(
  process.env.EMBEDDING_CACHE_TTL || "3600",
  10,
);
