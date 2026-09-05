import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transcriptSegments } from "@/lib/db/schema";
import { addTranscriptSegment } from "@/lib/brain/live-context";
import { sttLog as logger } from "@/lib/logger";

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

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("Agora-Signature");
    // Verify signature using AGORA_WEBHOOK_SECRET in production

    const body = await req.json();
    logger.debug({ body }, "Received Agora STT Webhook");

    // The eventType 3 implies recognize result
    if (body.eventType === 3 && body.payload?.recognizeResult?.words?.length) {
      const { taskId, channelName } = body.payload;
      const { uid, words } = body.payload.recognizeResult;
      
      const isFinal = words.some((w: any) => w.isFinal);
      const text = words.map((w: any) => w.text).join(" ");
      const startedAtMs = words[0].startMs;
      const endedAtMs = words[words.length - 1].startMs + words[words.length - 1].durationMs;

      // Extract sessionId from channelName or via a lookup
      // Assuming channelName is the sessionId for simplicity
      const sessionId = channelName;

      // Determine role (teacher vs student)
      // In a real app, look up the participant in session_participants
      const role = "student"; // Defaulting to student

      if (isFinal && text.trim().length > 0) {
        // Write to Postgres
        await db.insert(transcriptSegments).values({
          sessionId,
          speakerUid: String(uid),
          speakerRole: role,
          content: text,
          startedAtMs,
          endedAtMs,
          isFinal: true,
        });

        // Write to Redis Live Context
        await addTranscriptSegment(sessionId, String(uid), role, text, true);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err }, "STT Webhook Error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
