/**
 * lib/logger/index.ts
 *
 * Production-grade structured logger built on Pino.
 *
 * Features:
 *   - JSON output in production (machine-readable, ship to Loki/Datadog/etc)
 *   - Pretty-printed output in development
 *   - Child loggers with bound context (session_id, agent_id, user_id, etc.)
 *   - Named log levels: trace, debug, info, warn, error, fatal
 *   - Automatic redaction of secrets
 *   - Request/response timing helpers
 *   - Brain turn logging (structured for analytics)
 *
 * Usage:
 *   import { log } from '@/lib/logger'
 *   log.info({ session_id: 'abc', topic: 'Newton' }, 'Session started')
 *
 *   // Bound child logger
 *   const sessionLog = log.child({ session_id: 'abc', class_id: 'phys-101' })
 *   sessionLog.info({ turn: 3, path: 'slow' }, '[Brain] classified')
 *
 *   // Brain turn helper
 *   import { logBrainTurn } from '@/lib/logger'
 *   logBrainTurn({ turnId: 1, speakerUid: '123', message: 'What is F=ma?',
 *                  path: 'slow', latencyMs: 820, tokens: 24, response: '...' })
 */

import pino, { Logger } from "pino";

const isDev = process.env.NODE_ENV !== "production";

// ── Core logger ────────────────────────────────────────────────────────────

const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),

  // Auto-redact secrets so they never appear in logs
  redact: {
    paths: [
      "*.api_key",
      "*.apiKey",
      "*.token",
      "*.password",
      "*.secret",
      "authorization",
      "headers.authorization",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },

  // Base fields on every log line
  base: {
    service: "knotic-brain",
    env: process.env.NODE_ENV || "development",
  },

  // Use ISO timestamp
  timestamp: pino.stdTimeFunctions.isoTime,

  // Serializers — format Error objects properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
};

// In dev: pretty-print to console. In prod: JSON to stdout (ship to log aggregator).
const transport = isDev
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname,service,env",
        messageFormat: "{msg}",
        singleLine: false,
      },
    })
  : undefined;

export const log: Logger = transport
  ? pino(pinoOptions, transport)
  : pino(pinoOptions);

// ── Namespaced child loggers ────────────────────────────────────────────────

export const agentLog = log.child({ ns: "agent" });     // Agora agent lifecycle
export const brainLog = log.child({ ns: "brain" });     // Brain server turns
export const sttLog   = log.child({ ns: "stt" });       // STT webhook events
export const ctxLog   = log.child({ ns: "ctx" });       // Classroom context engine
export const dbLog    = log.child({ ns: "db" });        // Database operations
export const queueLog = log.child({ ns: "queue" });     // BullMQ workers
export const ragLog   = log.child({ ns: "rag" });       // RAG retrieval
export const dreamLog = log.child({ ns: "dream" });     // Dreaming worker

// ── Typed log helpers ──────────────────────────────────────────────────────

export interface BrainTurnLog {
  turnId: number;
  sessionId: string | null;
  speakerUid: string;
  speakerRole?: string;
  message: string;
  historyLen: number;
  model: string;
  topic: string | null;
  confusedConcepts: string[];
  path: "fast" | "slow";
  fillerPhrase?: string;
  response: string;
  tokens: number;
  latencyMs: number;
  ragUsed?: boolean;
}

export function logBrainTurn(t: BrainTurnLog) {
  brainLog.info(
    {
      turn_id:          t.turnId,
      session_id:       t.sessionId,
      speaker_uid:      t.speakerUid,
      speaker_role:     t.speakerRole,
      path:             t.path,
      model:            t.model,
      topic:            t.topic,
      confused_concepts: t.confusedConcepts,
      rag_used:         t.ragUsed ?? false,
      tokens_out:       t.tokens,
      latency_ms:       t.latencyMs,
      filler:           t.fillerPhrase,
      // Truncate long strings for log readability
      user_message:     t.message.slice(0, 200),
      response_preview: t.response.slice(0, 200),
    },
    `[Brain] turn=${t.turnId} path=${t.path} ${t.latencyMs}ms`
  );
}

export interface AgentLifecycleLog {
  event: "start" | "stop" | "error" | "poll";
  channelName: string;
  agentId?: string;
  agentUid?: number;
  status?: string;
  llmUrl?: string;
  ttsMode?: string;
  errorMsg?: string;
  httpStatus?: number;
}

export function logAgentEvent(e: AgentLifecycleLog) {
  const level = e.event === "error" ? "error" : "info";
  agentLog[level](
    {
      event:        e.event,
      channel:      e.channelName,
      agent_id:     e.agentId,
      agent_uid:    e.agentUid,
      status:       e.status,
      llm_url:      e.llmUrl,
      tts_mode:     e.ttsMode,
      http_status:  e.httpStatus,
      error:        e.errorMsg,
    },
    `[Agent] ${e.event} channel=${e.channelName}`
  );
}

export interface SttEventLog {
  sessionId: string;
  speakerUid: string;
  speakerRole: string;
  text: string;
  isFinal: boolean;
  timestampMs: number;
}

export function logSttEvent(e: SttEventLog) {
  sttLog.debug(
    {
      session_id:   e.sessionId,
      speaker_uid:  e.speakerUid,
      speaker_role: e.speakerRole,
      is_final:     e.isFinal,
      ts:           e.timestampMs,
      text_preview: e.text.slice(0, 120),
    },
    `[STT] ${e.speakerRole} uid=${e.speakerUid} "${e.text.slice(0, 60)}"`
  );
}

// ── Request timing helper ──────────────────────────────────────────────────

export function startTimer(): () => number {
  const t = Date.now();
  return () => Date.now() - t;
}
