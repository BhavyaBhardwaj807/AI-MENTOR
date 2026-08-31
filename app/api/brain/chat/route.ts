/**
 * /api/brain/chat — Custom LLM endpoint (Agora calls this on every turn)
 *
 * Latency strategy:
 *   Fast path — short/simple → direct LLM call, stream immediately
 *   Slow path — complex      → filler phrase first, then real answer
 */

import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { brainLog, logBrainTurn, startTimer } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  turn_id?: number;
  timestamp?: number;
  metadata?: { source?: string; user?: string };
}

interface AgoraLLMRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  turn_id?: number;
  timestamp?: number;
}

interface ClassroomContext {
  session_id?: string;
  class_id?: string;
  current_topic?: string;
  teacher_speaking?: boolean;
  confusion_signals?: Array<{ concept: string; count: number }>;
  unanswered_questions?: Array<{ text: string }>;
}

// ── Filler phrases ─────────────────────────────────────────────────────────

const FILLERS = [
  "Let me think about that...",
  "Good question, just a moment...",
  "Let me check on that...",
  "One second...",
];
const randomFiller = () => FILLERS[Math.floor(Math.random() * FILLERS.length)];

// ── Path classifier ────────────────────────────────────────────────────────

function classifyPath(text: string): "fast" | "slow" {
  if (text.length < 25) return "fast";
  if (/^(hi|hello|hey|thanks|ok|yes|no|sure|got it)/i.test(text)) return "fast";
  if (/explain|how does|why|what is|define|confused|don.t understand/i.test(text)) return "slow";
  return text.length > 100 ? "slow" : "fast";
}

// ── Context loader ─────────────────────────────────────────────────────────

async function getClassroomContext(sessionId: string | null): Promise<ClassroomContext | null> {
  if (!sessionId) return null;
  try {
    const raw = await redis.get(`classroom:${sessionId}:context`);
    return raw ? (JSON.parse(raw) as ClassroomContext) : null;
  } catch (e) {
    brainLog.warn({ err: e, session_id: sessionId }, "[Brain] Redis context load failed");
    return null;
  }
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: ClassroomContext | null): string {
  const lines = [
    "You are an AI Mentor in a live classroom. You are a concise, helpful teaching assistant.",
    "Keep responses to 1–3 sentences. No markdown, no bullet points — this is voice output.",
    "Speak naturally, like you're in a conversation.",
  ];
  if (ctx?.current_topic) lines.push(`Current lesson topic: ${ctx.current_topic}.`);
  if (ctx?.confusion_signals?.length) {
    lines.push(`Students seem confused about: ${ctx.confusion_signals.map((s) => s.concept).join(", ")}.`);
  }
  if (ctx?.unanswered_questions?.length) {
    lines.push(`Unanswered student question: "${ctx.unanswered_questions[0].text}"`);
  }
  return lines.join(" ");
}

// ── SSE helpers ────────────────────────────────────────────────────────────

const enc = new TextEncoder();

function sseChunk(id: string, content: string, finish: string | null = null) {
  return enc.encode(
    "data: " + JSON.stringify({
      id,
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: finish ? {} : { content }, finish_reason: finish }],
    }) + "\n\n"
  );
}

function sseMeta(id: string, interruptable: boolean) {
  return enc.encode(
    "data: " + JSON.stringify({
      id,
      object: "chat.completion.custom_metadata",
      choices: [],
      metadata: { interruptable },
    }) + "\n\n"
  );
}

const SSE_DONE = enc.encode("data: [DONE]\n\n");

// ── LLM streaming ──────────────────────────────────────────────────────────

async function* streamLLM(
  messages: ChatMessage[],
  model: string,
  signal: AbortSignal
): AsyncGenerator<string> {
  const apiKey = process.env.LLM_API_KEY!;
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 200, temperature: 0.7 }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM ${res.status}: ${err.slice(0, 200)}`);
  }

  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data: ")) continue;
      const d = t.slice(6);
      if (d === "[DONE]") return;
      try {
        const c = JSON.parse(d)?.choices?.[0]?.delta?.content;
        if (c) yield c;
      } catch { /* skip malformed */ }
    }
  }
}

// ── Session ID extractor ───────────────────────────────────────────────────

function extractSessionId(messages: ChatMessage[]): string | null {
  const sys = messages.find((m) => m.role === "system");
  if (!sys) return null;
  const m = sys.content.match(/\[SESSION:([^\]]+)\]/);
  return m ? m[1] : null;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const elapsed = startTimer();

  // Auth (optional — only enforced if BRAIN_SERVER_SECRET is set)
  const secret = process.env.BRAIN_SERVER_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (token !== secret) {
      brainLog.warn({ ip: req.headers.get("x-forwarded-for") }, "[Brain] 401 bad secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  let body: AgoraLLMRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { messages = [], model } = body;
  const resolvedModel = model || process.env.LLM_MODEL || "gpt-4o-mini";

  const allUserMsgs = messages.filter((m) => m.role === "user");
  const lastUser = allUserMsgs.at(-1);
  const lastUserText = lastUser?.content ?? "";
  const speakerUid = lastUser?.metadata?.user ?? "unknown";
  const turnId = body.turn_id ?? 0;
  const sessionId = extractSessionId(messages);

  // Bound child logger for this request
  const tlog = brainLog.child({ turn_id: turnId, session_id: sessionId, speaker_uid: speakerUid });

  tlog.info({
    history_len: messages.length,
    model: resolvedModel,
    message: lastUserText.slice(0, 120),
  }, "[Brain] incoming turn");

  const ctx = await getClassroomContext(sessionId);
  const path = classifyPath(lastUserText);
  const confusedConcepts = ctx?.confusion_signals?.map((s) => s.concept) ?? [];

  tlog.info({
    path,
    topic: ctx?.current_topic ?? null,
    confused_concepts: confusedConcepts,
    teacher_speaking: ctx?.teacher_speaking ?? false,
  }, `[Brain] classified → ${path}`);

  const systemContent = buildSystemPrompt(ctx);
  const messagesWithCtx: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...messages.filter((m) => m.role !== "system"),
  ];

  const responseId = `brain-${Date.now()}`;
  const abortController = new AbortController();

  let fillerUsed: string | undefined;
  let fullResponse = "";
  let tokenCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (path === "slow") {
          controller.enqueue(sseMeta(responseId + "-m1", false));
          fillerUsed = randomFiller();
          controller.enqueue(sseChunk(responseId, fillerUsed));
          controller.enqueue(sseChunk(responseId, "", "stop"));
          tlog.debug({ filler: fillerUsed }, "[Brain] filler sent");
          controller.enqueue(sseMeta(responseId + "-m2", true));
        }

        for await (const token of streamLLM(messagesWithCtx, resolvedModel, abortController.signal)) {
          controller.enqueue(sseChunk(responseId, token));
          fullResponse += token;
          tokenCount++;
        }

        controller.enqueue(sseChunk(responseId, "", "stop"));
        controller.enqueue(SSE_DONE);

        // Structured log of completed turn
        logBrainTurn({
          turnId,
          sessionId,
          speakerUid,
          message: lastUserText,
          historyLen: messages.length,
          model: resolvedModel,
          topic: ctx?.current_topic ?? null,
          confusedConcepts,
          path,
          fillerPhrase: fillerUsed,
          response: fullResponse,
          tokens: tokenCount,
          latencyMs: elapsed(),
        });
      } catch (err) {
        tlog.error({ err, latency_ms: elapsed() }, "[Brain] LLM error");
        controller.enqueue(sseChunk(responseId, "Sorry, I'm having trouble responding right now."));
        controller.enqueue(sseChunk(responseId, "", "stop"));
        controller.enqueue(SSE_DONE);
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
      tlog.debug("[Brain] stream cancelled by client");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Brain-Path": path,
    },
  });
}
