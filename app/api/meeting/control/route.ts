import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { meetingSessions } from "@/lib/db/schema";
import { startSttTask, stopSttTask } from "@/lib/agora-stt";
import { startAgent, stopAgentById, stopAllAgentsInChannel } from "@/lib/agora-conversational-ai";
import { eq } from "drizzle-orm";
import { dreamQueue } from "@/lib/queue";
import { requireMeetingAccessByChannel } from "@/lib/auth/guards";
import { initLiveContext } from "@/lib/brain/live-context";
import { redis } from "@/lib/redis";

function voiceControllerValue(access: Awaited<ReturnType<typeof requireMeetingAccessByChannel>> & { ok: true }) {
  return JSON.stringify({
    role: access.user.role === "admin" ? "admin" : "teacher",
    userId: access.user.id,
  });
}

async function cleanupAgentState(meeting: typeof meetingSessions.$inferSelect, channelName: string) {
  const cleanupTasks: Promise<unknown>[] = [];

  if (meeting.agoraAgentId) {
    cleanupTasks.push(stopAgentById(meeting.agoraAgentId));
  }

  cleanupTasks.push(stopAllAgentsInChannel(channelName));

  if (meeting.agoraSttAgentId) {
    const builderToken = await redis.get(`stt:${meeting.agoraSttAgentId}:builder-token`);
    if (builderToken) {
      cleanupTasks.push(stopSttTask(meeting.agoraSttAgentId, builderToken));
    }
    cleanupTasks.push(redis.del(`stt:${meeting.agoraSttAgentId}:builder-token`));
  }

  await Promise.allSettled(cleanupTasks);
  await redis.del(`session:${meeting.id}:voice-controller`).catch(() => {});
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";
    const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "";
    const rtcUid = typeof body.rtcUid === "string" || typeof body.rtcUid === "number"
      ? String(body.rtcUid).trim()
      : "";
    const forceRestart = body.forceRestart === true;

    if (!channelName) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const access = await requireMeetingAccessByChannel(channelName, { allowEnded: true });
    if (!access.ok) return access.response;

    console.log("[MeetingControl] request", {
      action,
      channelName,
      sessionId: access.meeting.id,
      classId: access.meeting.classId,
      meetingStatus: access.meeting.status,
      userId: access.user.id,
      role: access.user.role,
      hasAgent: Boolean(access.meeting.agoraAgentId),
      hasStt: Boolean(access.meeting.agoraSttAgentId),
      rtcUid: rtcUid || null,
      forceRestart,
    });

    if (access.classData.teacherId !== access.user.id && access.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "start") {
      const startLockKey = `meeting:${access.meeting.id}:ai-start-lock`;
      if (access.meeting.status === "ended") {
        return NextResponse.json({ error: "Meeting has ended" }, { status: 409 });
      }

      const lockToken = randomUUID();
      const lockAcquired = await redis.set(startLockKey, lockToken, "EX", 60, "NX");
      if (!lockAcquired) {
        const currentMeeting = await db.query.meetingSessions.findFirst({
          where: eq(meetingSessions.id, access.meeting.id),
        });

        if (currentMeeting?.agoraAgentId && currentMeeting.status === "live") {
          await redis.set(
            `session:${currentMeeting.id}:voice-controller`,
            voiceControllerValue(access),
            "EX",
            4 * 60 * 60,
          );
          console.log("[MeetingControl] AI Mentor already active after lock wait", {
            channelName,
            sessionId: currentMeeting.id,
            agentId: currentMeeting.agoraAgentId,
            sttStatus: currentMeeting.agoraSttAgentId ? "active" : "degraded",
          });
          return NextResponse.json({
            success: true,
            alreadyActive: true,
            agentId: currentMeeting.agoraAgentId,
            taskId: currentMeeting.agoraSttAgentId,
            sessionId: currentMeeting.id,
            classId: currentMeeting.classId,
          });
        }

        return NextResponse.json({ error: "AI Instructor is already starting" }, { status: 409 });
      }

      let agentId: string | undefined;
      let taskId: string | undefined;
      let builderToken: string | undefined;
      let sttError: string | undefined;
      let replacedAgent = false;

      try {
        const currentMeeting = await db.query.meetingSessions.findFirst({
          where: eq(meetingSessions.id, access.meeting.id),
        }) ?? access.meeting;

        if (currentMeeting.agoraAgentId && currentMeeting.status === "live") {
          if (!forceRestart) {
            await redis.set(
              `session:${currentMeeting.id}:voice-controller`,
              voiceControllerValue(access),
              "EX",
              4 * 60 * 60,
            );
            console.log("[MeetingControl] AI Mentor already active", {
              channelName,
              sessionId: currentMeeting.id,
              agentId: currentMeeting.agoraAgentId,
              sttStatus: currentMeeting.agoraSttAgentId ? "active" : "degraded",
            });
            return NextResponse.json({
              success: true,
              alreadyActive: true,
              agentId: currentMeeting.agoraAgentId,
              taskId: currentMeeting.agoraSttAgentId,
              sessionId: currentMeeting.id,
              classId: currentMeeting.classId,
            });
          }

          replacedAgent = true;
          console.log("[MeetingControl] replacing stored AI Mentor", {
            channelName,
            sessionId: currentMeeting.id,
            oldAgentId: currentMeeting.agoraAgentId,
          });
          await cleanupAgentState(currentMeeting, channelName);
        }

        await initLiveContext(access.meeting.id, access.meeting.classId);
        await redis.set(
          `session:${access.meeting.id}:voice-controller`,
          voiceControllerValue(access),
          "EX",
          4 * 60 * 60,
        );

        // Start Conversational AI
        const remoteRtcUids = rtcUid ? [rtcUid] : ["*"];
        if (!rtcUid) {
          console.warn("[MeetingControl] starting AI Mentor without a teacher RTC UID; falling back to all remote RTC users");
        }
        const agent = await startAgent(channelName, access.meeting.id, remoteRtcUids);
        agentId = agent.agentId;
      
        // Start STT. This powers classroom transcript/context, but should not
        // tear down the voice mentor if Agora STT is unavailable for the project.
        const sttUid = 999998; // Dedicated UID for STT bot
        try {
          const stt = await startSttTask(channelName, sttUid);
          taskId = stt.taskId;
          builderToken = stt.builderToken;
          await redis.set(`stt:${taskId}:builder-token`, builderToken, "EX", 4 * 60 * 60);
        } catch (err) {
          sttError = err instanceof Error ? err.message : "STT startup failed";
          console.warn("Meeting STT startup failed; continuing with voice AI only:", sttError);
        }

        await db
          .update(meetingSessions)
          .set({
            agoraAgentId: agentId,
            agoraSttAgentId: taskId,
            status: "live",
            startedAt: new Date(),
          })
          .where(eq(meetingSessions.id, access.meeting.id));
      } catch (err) {
        if (agentId) {
          await stopAgentById(agentId).catch(() => {});
        }
        if (taskId && builderToken) {
          await stopSttTask(taskId, builderToken).catch(() => {});
          await redis.del(`stt:${taskId}:builder-token`).catch(() => {});
        }
        throw err;
      } finally {
        await redis
          .get(startLockKey)
          .then((currentToken) => currentToken === lockToken ? redis.del(startLockKey) : undefined)
          .catch(() => {});
      }

      return NextResponse.json({
        success: true,
        agentId,
        taskId,
        sttStatus: taskId ? "active" : "degraded",
        sttError,
        replacedAgent,
        sessionId: access.meeting.id,
        classId: access.meeting.classId,
      });

    } else if (action === "stop") {
      const cleanupTasks: Promise<unknown>[] = [];

      if (access.meeting.agoraAgentId) {
        cleanupTasks.push(stopAgentById(access.meeting.agoraAgentId));
      }

      if (access.meeting.agoraSttAgentId) {
        const builderToken = await redis.get(`stt:${access.meeting.agoraSttAgentId}:builder-token`);
        if (builderToken) {
          cleanupTasks.push(stopSttTask(access.meeting.agoraSttAgentId, builderToken));
        }
        cleanupTasks.push(redis.del(`stt:${access.meeting.agoraSttAgentId}:builder-token`));
      }

      cleanupTasks.push(redis.del(`meeting:${access.meeting.id}:ai-start-lock`));
      cleanupTasks.push(redis.del(`session:${access.meeting.id}:voice-controller`));
      await Promise.allSettled(cleanupTasks);

      await db
        .update(meetingSessions)
        .set({
          agoraAgentId: null,
          agoraSttAgentId: null,
          status: "ended", // Or 'idle' depending on logic
          endedAt: new Date(),
        })
        .where(eq(meetingSessions.id, access.meeting.id));

      // Trigger the dreaming worker to extract memories from the transcript
      await dreamQueue.add(
        "dream-memories",
        { sessionId: access.meeting.id },
        { jobId: `dream-${access.meeting.id}` },
      );

      return NextResponse.json({ success: true, sessionId: access.meeting.id });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Meeting control error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
