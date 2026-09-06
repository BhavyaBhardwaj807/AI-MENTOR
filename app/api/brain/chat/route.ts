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
import { assembleContext } from "@/lib/brain/context-assembler";
import { setLastAiSpokeAt } from "@/lib/brain/live-context";
import { RETRIEVAL } from "@/lib/brain/config";
import { generateQuizDraft } from "@/lib/brain/quiz-generation";
import { parseQuizCommand } from "@/lib/brain/quiz-command";
import { evaluateSpeakingPolicy } from "@/lib/brain/speaking-policy";
import { llmJsonCall } from "@/lib/llm";
import { z } from "zod";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  turn_id?: number;
  timestamp?: number;
  name?: string;
  metadata?: {
    source?: string;
    user?: string;
    uid?: string | number;
    rtc_uid?: string | number;
    speaker_uid?: string | number;
  };
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
  last_ai_spoke_at?: number;
  confusion_signals?: Array<{ concept: string; count: number }>;
  unanswered_questions?: Array<{ text: string }>;
}

type SpeakerMetadata = {
  role?: string;
  userId?: string;
};

type SpeakerRole = "teacher" | "student" | "admin" | "unknown";
function normalizeSpeakerRole(role: unknown): SpeakerRole {
  return role === "teacher" || role === "student" || role === "admin" ? role : "unknown";
}

function extractSpeakerUid(message: ChatMessage | undefined): string {
  const metadata = message?.metadata;
  const value = metadata?.user ?? metadata?.uid ?? metadata?.rtc_uid ?? metadata?.speaker_uid ?? message?.name;
  return value == null || value === "" ? "unknown" : String(value);
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

const CommandIntentSchema = z.object({
  isCommand: z.boolean().describe("Whether the utterance is a direct command to the AI"),
  intent: z.enum(["CREATE_QUIZ", "NONE"]).describe("The specific command intent"),
  args: z.object({
    topic: z.string().optional().describe("The topic for the quiz"),
    questionCount: z.number().optional().describe("Number of questions requested"),
  }).optional(),
});

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

function appendRAGContext(systemPrompt: string, ragText: string): string {
  if (!ragText || ragText === "No relevant context found.") return systemPrompt;
  return `${systemPrompt}\n\n[RETRIEVED KNOWLEDGE]\nUse the following course materials to ground your answer. If they are irrelevant, ignore them.\n${ragText}\n[/RETRIEVED KNOWLEDGE]`;
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

function silentResponse(responseId: string, headers: Record<string, string> = {}) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sseChunk(responseId, "", "stop"));
      controller.enqueue(SSE_DONE);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...headers,
    },
  });
}

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

  // Agora calls this endpoint as an OpenAI-compatible LLM provider. Keep it
  // private so browser callers cannot spend LLM quota or inject classroom turns.
  const secret = process.env.BRAIN_SERVER_SECRET;
  if (!secret) {
    brainLog.error("[Brain] BRAIN_SERVER_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Brain endpoint is not configured" }), { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (token !== secret) {
    brainLog.warn({ ip: req.headers.get("x-forwarded-for") }, "[Brain] 401 bad secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
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
  const speakerUid = extractSpeakerUid(lastUser);
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
  const rawSignals = ctx?.confusion_signals;
  const signalsArray = Array.isArray(rawSignals) ? rawSignals : [];
  const confusedConcepts = signalsArray.map((s) => s.concept);

  // Determine speaker role
  let speakerRole: SpeakerRole = "unknown";
  let speakerUserId: string | undefined;
  if (sessionId && speakerUid !== "unknown") {
    try {
      const speakerRaw = await redis.hget(`session:${sessionId}:speakers`, speakerUid);
      if (speakerRaw) {
        const speakerParsed = JSON.parse(speakerRaw) as SpeakerMetadata;
        speakerRole = normalizeSpeakerRole(speakerParsed.role);
        speakerUserId = speakerParsed.userId;
      }
    } catch { /* ignore */ }
  }

  if (sessionId && speakerRole === "unknown") {
    try {
      const controllerRaw = await redis.get(`session:${sessionId}:voice-controller`);
      if (controllerRaw) {
        const controller = JSON.parse(controllerRaw) as SpeakerMetadata;
        speakerRole = normalizeSpeakerRole(controller.role);
        speakerUserId = controller.userId;
      }
    } catch { /* ignore */ }
  }
  const speakerStudentId = speakerRole === "student" ? speakerUserId : undefined;

  let path: "fast" | "slow" | "command" = classifyPath(lastUserText);
  let commandData: z.infer<typeof CommandIntentSchema> | null = null;

  const quizCommandSpeakerAllowed = speakerRole === "teacher" || speakerRole === "admin" || speakerRole === "unknown";
  const directQuizCommand = parseQuizCommand(lastUserText);

  if (quizCommandSpeakerAllowed && directQuizCommand) {
    path = "command";
    commandData = directQuizCommand;
  }

  // Command intent pipeline (Phase 2). The deterministic parser handles the
  // common voice phrases; the model remains as a fallback for less direct asks.
  if (!commandData && quizCommandSpeakerAllowed && /(quiz|questions|test)/i.test(lastUserText)) {
    tlog.debug("[Brain] quiz mentioned, checking intent...");
    try {
      const intentRes = await llmJsonCall({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an intent classifier for a voice AI co-teacher named George. Determine if the teacher is asking you to create a quiz." },
          { role: "user", content: `Current Topic: ${ctx?.current_topic || "Unknown"}\nTeacher says: "${lastUserText}"\nIdentify intent. If topic isn't explicitly mentioned, infer from context.` }
        ],
        schema: CommandIntentSchema,
        maxTokens: 100,
      });
      if (intentRes.parsed.isCommand && intentRes.parsed.intent === "CREATE_QUIZ") {
        path = "command";
        commandData = intentRes.parsed;
      }
    } catch (err) {
      tlog.warn({ err }, "[Brain] intent classification failed");
    }
  }

  const speakingDecision = evaluateSpeakingPolicy({
    text: lastUserText,
    speakerRole,
    command: commandData?.intent,
    context: ctx ? {
      teacher_speaking: Boolean(ctx.teacher_speaking),
      confusion_signals: ctx.confusion_signals ?? [],
      unanswered_questions: ctx.unanswered_questions ?? [],
      last_ai_spoke_at: ctx.last_ai_spoke_at,
    } : null,
  });

  tlog.info({
    path,
    topic: ctx?.current_topic ?? null,
    confused_concepts: confusedConcepts,
    teacher_speaking: ctx?.teacher_speaking ?? false,
    speaker_role: speakerRole,
    command: commandData?.intent ?? null,
    should_speak: speakingDecision.shouldSpeak,
    confidence_to_speak: speakingDecision.confidence,
    speak_reason: speakingDecision.reason,
  }, `[Brain] classified → ${path}`);

  const responseId = `brain-${Date.now()}`;

  if (!speakingDecision.shouldSpeak) {
    tlog.info({
      confidence_to_speak: speakingDecision.confidence,
      speak_reason: speakingDecision.reason,
      message: lastUserText.slice(0, 120),
    }, "[Brain] abstained");
    return silentResponse(responseId, {
      "X-Brain-Path": "abstain",
      "X-Brain-Speak-Confidence": speakingDecision.confidence.toFixed(2),
    });
  }

  let ragContextText = "";
  let ragUsed = false;

  if (path !== "command" && ctx?.class_id) {
    tlog.debug("[Brain] assembling context...");
    const { text, results } = await assembleContext(lastUserText, {
      classId: ctx.class_id,
      sessionId: sessionId || undefined,
      studentId: speakerStudentId,
      confusedConcepts,
      scoreThreshold: RETRIEVAL.scoreThreshold,
      maxResults: RETRIEVAL.courseTopK,
      tokenBudget: RETRIEVAL.maxContextTokens,
    });
    ragContextText = text;
    ragUsed = results.length > 0;
  }

  const systemContent = appendRAGContext(buildSystemPrompt(ctx), ragContextText);
  const messagesWithCtx: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...messages.filter((m) => m.role !== "system"),
  ];

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

        if (path === "command" && commandData?.intent === "CREATE_QUIZ") {
          const quizTopic = commandData.args?.topic || ctx?.current_topic || "general review";
          const ack = sessionId && ctx?.class_id
            ? `Sure, I'll draft a quiz on ${quizTopic} for you to review.`
            : "I heard the quiz request, but this meeting is missing classroom context, so I can't create it yet.";
          controller.enqueue(sseChunk(responseId, ack));
          fullResponse = ack;

          if (sessionId && ctx?.class_id) {
            void generateQuizDraft({
              classId: ctx.class_id,
              sessionId,
              studentId: speakerStudentId,
              topic: quizTopic,
              generatedBy: "ai",
            })
              .then((result) => {
                tlog.info(
                  { quizId: result.quiz.id, questions: result.quiz.questions.length, topic: quizTopic },
                  "[Brain] quiz generation dispatched",
                );
              })
              .catch((err) => {
                tlog.error(
                  {
                    err,
                    topic: quizTopic,
                    classId: ctx.class_id,
                    sessionId,
                  },
                  "[Brain] quiz generation dispatch failed",
                );
              });
          }
        } else {
          for await (const token of streamLLM(messagesWithCtx, resolvedModel, abortController.signal)) {
            controller.enqueue(sseChunk(responseId, token));
            fullResponse += token;
            tokenCount++;
          }
        }

        controller.enqueue(sseChunk(responseId, "", "stop"));
        controller.enqueue(SSE_DONE);

        if (sessionId && fullResponse.trim()) {
          await setLastAiSpokeAt(sessionId).catch((err) => {
            tlog.warn({ err }, "[Brain] failed to update last_ai_spoke_at");
          });
        }

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
          path: (path === "command" ? "fast" : path) as "fast" | "slow",
          fillerPhrase: fillerUsed,
          response: fullResponse,
          tokens: tokenCount,
          latencyMs: elapsed(),
          ragUsed,
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
      "X-Brain-Path": (path === "command" ? "fast" : path) as "fast" | "slow",
    },
  });
}
