import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetingSessions } from "@/lib/db/schema";
import { startSttTask, stopSttTask } from "@/lib/agora-stt";
import { startAgent, stopAgentById } from "@/lib/agora-conversational-ai";
import { eq } from "drizzle-orm";
import { dreamQueue } from "@/lib/queue";

export async function POST(req: Request) {
  try {
    const { action, channelName, sessionId } = await req.json();

    if (!channelName || !sessionId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const session = await db.query.meetingSessions.findFirst({
      where: eq(meetingSessions.id, sessionId),
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (action === "start") {
      // Start Conversational AI
      const { agentId } = await startAgent(channelName);
      
      // Start STT
      const sttUid = 999998; // Dedicated UID for STT bot
      const { taskId, builderToken } = await startSttTask(channelName, sttUid);

      await db
        .update(meetingSessions)
        .set({
          agoraAgentId: agentId,
          agoraSttAgentId: taskId,
          // Store builderToken somewhere if needed, but typically it's kept in Redis or DB.
          status: "live",
          startedAt: new Date(),
        })
        .where(eq(meetingSessions.id, sessionId));

      return NextResponse.json({ success: true, agentId, taskId });

    } else if (action === "stop") {
      if (session.agoraAgentId) {
        await stopAgentById(session.agoraAgentId);
      }
      
      // We don't have builderToken stored cleanly in this minimal schema, 
      // but in production we'd fetch it to stop STT gracefully.
      // For now, assume it's stopped when the channel empties or via separate mechanism.
      // Or we can store builderToken in redis: `stt:${taskId}:token`

      await db
        .update(meetingSessions)
        .set({
          status: "ended",
          endedAt: new Date(),
        })
        .where(eq(meetingSessions.id, sessionId));

      // Trigger the dreaming worker to extract memories from the transcript
      await dreamQueue.add("dream-memories", { sessionId });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Meeting control error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
