import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetingSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireMeetingAccessByChannel } from "@/lib/auth/guards";
import { stopAgentById } from "@/lib/agora-conversational-ai";
import { stopSttTask } from "@/lib/agora-stt";
import { redis } from "@/lib/redis";
import { dreamQueue } from "@/lib/queue";

// GET: Return current meeting status
export async function GET(
  req: Request,
  props: { params: Promise<{ roomId: string }> }
) {
  try {
    const params = await props.params;
    const { roomId } = params;
    const access = await requireMeetingAccessByChannel(roomId, { allowEnded: true });
    if (!access.ok) return access.response;

    return NextResponse.json({ 
      status: access.meeting.status,
      agentName: access.classData.agentName || "AI Mentor"
    });
  } catch (error) {
    console.error("[meeting/status/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Update meeting status (e.g. end it)
export async function POST(
  req: Request,
  props: { params: Promise<{ roomId: string }> }
) {
  try {
    const params = await props.params;
    const { roomId } = params;
    const { status } = await req.json();

    if (status !== "ended") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const access = await requireMeetingAccessByChannel(roomId, { allowEnded: true });
    if (!access.ok) return access.response;

    if (access.classData.teacherId !== access.user.id && access.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (access.meeting.status === "ended") {
      return NextResponse.json({ success: true, status: "ended" });
    }

    if (access.meeting.agoraAgentId) {
      await stopAgentById(access.meeting.agoraAgentId);
    }

    if (access.meeting.agoraSttAgentId) {
      const builderToken = await redis.get(`stt:${access.meeting.agoraSttAgentId}:builder-token`);
      if (builderToken) {
        await stopSttTask(access.meeting.agoraSttAgentId, builderToken);
        await redis.del(`stt:${access.meeting.agoraSttAgentId}:builder-token`);
      }
    }

    await db.update(meetingSessions)
      .set({
        status: "ended",
        agoraAgentId: null,
        agoraSttAgentId: null,
        endedAt: new Date()
      })
      .where(eq(meetingSessions.agoraChannel, roomId));

    await dreamQueue.add(
      "dream-memories",
      { sessionId: access.meeting.id },
      { jobId: `dream-${access.meeting.id}` },
    );

    return NextResponse.json({ success: true, status: "ended" });
  } catch (error) {
    console.error("[meeting/status/POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
