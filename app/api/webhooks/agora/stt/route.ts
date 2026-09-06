import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transcriptSegments, meetingSessions, classes, sessionParticipants } from "@/lib/db/schema";
import { addTranscriptSegment } from "@/lib/brain/live-context";
import { sttLog as logger } from "@/lib/logger";
import { eq, and } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
// Assuming we have a function to trigger intervention in the Intervention Engine
// import { triggerIntervention } from "@/lib/brain/intervention-engine";
// We will just log it or simulate for now since Intervention Engine polls live context anyway.

// Agora STT webhook payload structure
interface SttWebhookPayload {
  noticeId: string;
  productId: number;
  eventType: number;
  payload: {
    taskId: string;
    channelName: string;
    sequence: number;
    recognizeResult: {
      uid: number;
      streamId: number;
      words: Array<{
        text: string;
        startMs: number;
        durationMs: number;
        isFinal: boolean;
      }>;
    };
  };
}

type SpeakerRole = "teacher" | "student" | "ai";

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function getBearerToken(headerValue: string | null) {
  if (!headerValue?.startsWith("Bearer ")) return "";
  return headerValue.slice("Bearer ".length).trim();
}

function verifyWebhookSecret(req: Request) {
  const secret = process.env.AGORA_STT_WEBHOOK_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const candidates = [
    getBearerToken(req.headers.get("authorization")),
    req.headers.get("x-agora-stt-secret") ?? "",
    req.headers.get("x-webhook-secret") ?? "",
  ].filter(Boolean);

  return candidates.some((candidate) => safeCompare(candidate, secret));
}

function normalizeSpeakerRole(role: string | null | undefined): SpeakerRole {
  if (role === "teacher" || role === "student" || role === "ai") return role;
  return "student";
}

export async function POST(req: Request) {
  try {
    if (!verifyWebhookSecret(req)) {
      const status = process.env.AGORA_STT_WEBHOOK_SECRET ? 401 : 500;
      logger.warn({ status }, "Rejected Agora STT webhook without configured/valid secret");
      return NextResponse.json({ error: "Unauthorized" }, { status });
    }

    const body = await req.json() as Partial<SttWebhookPayload>;
    logger.debug({ noticeId: body.noticeId, eventType: body.eventType }, "Received Agora STT Webhook");

    if (body.eventType === 3 && body.payload?.recognizeResult?.words?.length) {
      const { channelName } = body.payload;
      const { uid, words } = body.payload.recognizeResult;

      const isFinal = words.some((w) => w.isFinal);
      const text = words.map((w) => w.text).join(" ");
      const startedAtMs = words[0].startMs;
      const endedAtMs = words[words.length - 1].startMs + words[words.length - 1].durationMs;

      // Lookup session, class, agentName
      const sessionData = await db
        .select({
          sessionId: meetingSessions.id,
          classId: meetingSessions.classId,
          agentName: classes.agentName,
          status: meetingSessions.status,
          sttTaskId: meetingSessions.agoraSttAgentId,
        })
        .from(meetingSessions)
        .leftJoin(classes, eq(meetingSessions.classId, classes.id))
        .where(eq(meetingSessions.agoraChannel, channelName))
        .limit(1)
        .then(res => res[0]);

      if (!sessionData) {
        logger.warn({ channelName }, "Session not found for STT channel");
        return NextResponse.json({ success: true });
      }

      if (sessionData.status === "ended") {
        logger.warn({ channelName, sessionId: sessionData.sessionId }, "Ignoring STT transcript for ended session");
        return NextResponse.json({ success: true });
      }

      if (sessionData.sttTaskId && sessionData.sttTaskId !== body.payload.taskId) {
        logger.warn(
          { channelName, sessionId: sessionData.sessionId, taskId: body.payload.taskId },
          "Ignoring STT transcript for non-current STT task",
        );
        return NextResponse.json({ success: true });
      }

      const { sessionId, agentName } = sessionData;

      // Lookup real speaker role from participants
      const participant = await db
        .select({ role: sessionParticipants.role })
        .from(sessionParticipants)
        .where(
          and(
            eq(sessionParticipants.sessionId, sessionId),
            eq(sessionParticipants.agoraUid, String(uid))
          )
        )
        .limit(1)
        .then(res => res[0]);

      const role = normalizeSpeakerRole(participant?.role);

      if (isFinal && text.trim().length > 0) {
        // 1. Write to Postgres
        await db.insert(transcriptSegments).values({
          sessionId,
          speakerUid: String(uid),
          speakerRole: role,
          content: text,
          startedAtMs,
          endedAtMs,
          isFinal: true,
        });

        // 2. Write to Redis Live Context
        await addTranscriptSegment(sessionId, String(uid), role, text, true);

        // 3. Dynamic Wake Word Detection
        const wakeWord = agentName ? agentName.toLowerCase() : "george";
        const textLower = text.toLowerCase();

        if (textLower.includes(wakeWord) || textLower.includes(`hey ${wakeWord}`)) {
          logger.info({ sessionId, wakeWord, text }, "Wake word detected in STT stream!");

          // Trigger the intervention / direct question logic here
          // The Intervention Engine cron normally picks this up within 3 seconds,
          // but we can immediately queue a high-priority 'direct_question' interaction if needed.
          // For now, logging it guarantees the engine sees the transcript anyway.
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err }, "STT Webhook Error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
