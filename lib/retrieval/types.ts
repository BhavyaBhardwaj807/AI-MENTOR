/**
 * lib/retrieval/types.ts
 *
 * Common interface for all retrieval adapters.
 * The orchestration layer talks to this interface — it never cares
 * which physical database produced a result.
 */

// ── Normalized retrieval result ────────────────────────────────────────

export type SourceType =
  | "course"
  | "transcript"
  | "student_memory"
  | "live_context"
  | "relational"
  | "graph";

export type PermissionLevel = "class" | "student-private";

export interface RetrievalResult {
  /** The text content of the retrieved chunk */
  content: string;

  /** Identifier for the source (e.g., "course:phys101:material-abc:chunk-3") */
  source: string;

  /** Category of source */
  sourceType: SourceType;

  /** Relevance score, normalized to 0-1 */
  score: number;

  /** Who can see this result */
  permissions: PermissionLevel;

  /** Arbitrary metadata for tracing and display */
  metadata: Record<string, unknown>;

  /** Unix timestamp (ms) of source creation, if applicable */
  timestamp?: number;

  /** Human-readable citation (e.g., "Physics 101 Lesson Notes, p.3") */
  citation: string;
}

// ── Query context passed to adapters ───────────────────────────────────

export interface QueryContext {
  /** The class this query relates to */
  classId: string;

  /** Current session (for transcript/live context) */
  sessionId?: string;

  /** Authenticated student (for personalized retrieval) */
  studentId?: string;

  /** Current lesson topic (for relevance boosting) */
  currentTopic?: string;

  /** Concepts the student is currently confused about */
  confusedConcepts?: string[];

  /** Maximum tokens to return */
  tokenBudget: number;

  /** Maximum number of results */
  maxResults: number;

  /** Minimum similarity score */
  scoreThreshold: number;
}

// ── Adapter interface ──────────────────────────────────────────────────

export interface RetrievalAdapter {
  /** Human-readable name (for tracing) */
  readonly name: string;

  /** The source type this adapter produces */
  readonly sourceType: SourceType;

  /**
   * Retrieve relevant content for the given query.
   * Must return results sorted by descending score.
   * Must respect permissions — e.g., studentId filter for private data.
   */
  retrieve(query: string, context: QueryContext): Promise<RetrievalResult[]>;
}

// ── Orchestrator types ─────────────────────────────────────────────────

export interface FusedRetrievalResult extends RetrievalResult {
  /** Fused score after RRF or other fusion */
  fusedScore: number;

  /** Original rank from the source adapter before fusion */
  originalRank: number;

  /** Whether this result was selected for the final context */
  selected: boolean;
}

export interface RetrievalPlan {
  /** Which adapters to query */
  adapters: string[];

  /** Per-adapter overrides for maxResults */
  perAdapterLimits?: Record<string, number>;

  /** Per-adapter overrides for scoreThreshold */
  perAdapterThresholds?: Record<string, number>;
}
