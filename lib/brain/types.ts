/**
 * lib/brain/types.ts
 *
 * Core type definitions for the AI Brain module.
 * These types define the contracts between subsystems.
 * Nothing in this file imports React, Agora, or any database client.
 */

// ── Chat protocol (OpenAI-compatible, what Agora sends us) ─────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  turn_id?: number;
  timestamp?: number;
  metadata?: { source?: string; user?: string };
}

export interface BrainChatRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  turn_id?: number;
  timestamp?: number;
}

// ── Query routing ──────────────────────────────────────────────────────

export type QueryIntent =
  | "greeting"
  | "factual"
  | "conceptual"
  | "personal"
  | "command"
  | "clarification"
  | "unknown";

export type RetrievalSource =
  | "live_context"
  | "course"
  | "transcript"
  | "student"
  | "relational"
  | "graph";

export interface QueryRoute {
  path: "fast" | "slow";
  intent: QueryIntent;
  sources: RetrievalSource[];
  needsDecomposition: boolean;
  needsRewrite: boolean;
  needsPersonalization: boolean;
  tokenBudget: number;
  confidenceToAnswer: number;
}

// ── Classroom context (read from Redis) ────────────────────────────────

export interface ConfusionSignal {
  concept: string;
  count: number;
  student_uids: string[];
}

export interface UnansweredQuestion {
  text: string;
  student_uid: string;
  asked_at: number;
}

export interface RecentUtterance {
  uid: string;
  role: "teacher" | "student" | "ai";
  text: string;
  timestamp: number;
}

export interface ClassroomContext {
  session_id: string;
  class_id: string;
  current_topic?: string;
  current_subtopic?: string;
  teacher_speaking: boolean;
  teacher_uid?: string;
  active_student_uids: string[];
  last_ai_spoke_at?: number;
  intervention_score: number;
  confusion_signals: ConfusionSignal[];
  unanswered_questions: UnansweredQuestion[];
  recent_utterances: RecentUtterance[];
}

// ── Brain internal API (for dashboard, student app) ────────────────────

export interface BrainQueryRequest {
  question: string;
  class_id: string;
  session_id?: string;
  student_id?: string;
  mode: "voice" | "text";
  include_citations?: boolean;
}

export interface BrainQueryResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  trace_id: string;
  latency_ms: number;
}

export interface Citation {
  text: string;
  source: string;
  page?: number;
  timestamp_ms?: number;
}

// ── Validation ─────────────────────────────────────────────────────────

export interface ValidationResult {
  pass: boolean;
  scores: {
    groundedness: number;      // 0-1: fraction of claims supported by context
    relevance: number;         // 0-1: does this answer the question?
    citation_coverage: number; // 0-1: are sources referenced?
    length_ok: boolean;        // under token limit?
    permission_safe: boolean;  // no private data leakage?
  };
  issues: string[];
}

// ── Brain execution trace ──────────────────────────────────────────────

export interface BrainTrace {
  trace_id: string;
  turn_id: number;
  session_id: string | null;
  timestamp: number;

  // Input
  original_query: string;
  speaker_uid: string;
  speaker_role: string;

  // Routing
  classified_intent: QueryIntent;
  chosen_path: "fast" | "slow";
  chosen_sources: RetrievalSource[];

  // Query transforms
  rewritten_query?: string;
  decomposed_queries?: string[];

  // Retrieval
  retrieval_results: Array<{
    source: string;
    doc_id: string;
    score: number;
    selected: boolean;
  }>;
  reranking_changes?: Array<{
    doc_id: string;
    before_rank: number;
    after_rank: number;
  }>;

  // Generation
  model_used: string;
  context_tokens: number;
  output_tokens: number;
  total_latency_ms: number;
  retrieval_latency_ms: number;
  llm_latency_ms: number;

  // Validation
  validation_scores: Record<string, number>;
  retry_count: number;
  retry_reason?: string;
  abstained: boolean;
  abstention_reason?: string;

  // Output
  response_preview: string;
}

// ── Memory types ───────────────────────────────────────────────────────

export type MemoryType =
  | "mastery"
  | "confusion"
  | "partial"
  | "breakthrough"
  | "explanation_worked"
  | "explanation_failed";

export type MemoryValidity = "current" | "superseded";

export interface MemoryAtom {
  type: MemoryType;
  subject: string;
  evidence: string;
  confidence: number;
  source: "dreaming_worker" | "quiz_result" | "live_detection";
  session_id: string;
  timestamp: number;
  validity: MemoryValidity;
  version: number;
  contradicts?: string;
}

// ── Learning events (extracted by dreaming worker) ─────────────────────

export type LearningEventType =
  | "mastery"
  | "confusion"
  | "partial"
  | "question"
  | "breakthrough";

export interface LearningEvent {
  concept: string;
  concept_id?: string;
  event_type: LearningEventType;
  confidence: number;
  evidence: string;
  new_confidence: number;
}
