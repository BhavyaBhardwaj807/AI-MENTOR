import { createRtcToken } from "@/lib/agora";
import { requireMeetingAccessByChannel, requireMeetingAccessById } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { meetingSessions, sessionParticipants } from "@/lib/db/schema";
import { redis } from "@/lib/redis";
import { and, eq } from "drizzle-orm";

const RESERVED_UIDS = new Set(["999998", "999999"]);

async function allocateUid(sessionId: string): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const uid = Math.floor(Math.random() * 900_000_000) + 1;
    const uidText = String(uid);
    if (RESERVED_UIDS.has(uidText)) continue;

    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.agoraUid, uidText),
      ),
    });

    if (!existing) return uid;
  }

  throw new Error("Could not allocate participant uid");
}

export async function POST(request: Request) {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !appCertificate) return Response.json({ error: "AGORA_APP_ID and AGORA_APP_CERTIFICATE must be configured on the server." }, { status: 500 });

  let body: { channelName?: unknown; meetingId?: unknown; uid?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "";
  const meetingId = typeof body.meetingId === "string" ? body.meetingId.trim() : "";
  if (!meetingId && !channelName) return Response.json({ error: "meetingId or channelName is required." }, { status: 400 });
  if (channelName && Buffer.byteLength(channelName, "utf8") > 63) return Response.json({ error: "channelName must be 63 bytes or fewer." }, { status: 400 });

  let access = meetingId ? await requireMeetingAccessById(meetingId) : await requireMeetingAccessByChannel(channelName);

  if (!access.ok && meetingId && channelName) {
    access = await requireMeetingAccessByChannel(channelName);
  }
  if (!access.ok) return access.response;
  if (channelName && channelName !== access.meeting.agoraChannel) {
    return Response.json({ error: "channelName does not match meetingId." }, { status: 400 });
  }

  const resolvedChannelName = access.meeting.agoraChannel;

  const participantRole = access.classData.teacherId === access.user.id || access.user.role === "admin"
    ? "teacher"
    : "student";
  let meeting = access.meeting;

  if (participantRole === "teacher" && meeting.status === "pending") {
    const [updatedMeeting] = await db
      .update(meetingSessions)
      .set({
        status: "live",
        startedAt: new Date(),
      })
      .where(
        and(
          eq(meetingSessions.id, meeting.id),
          eq(meetingSessions.status, "pending"),
        ),
      )
      .returning();

    meeting = updatedMeeting
      ?? await db.query.meetingSessions.findFirst({ where: eq(meetingSessions.id, meeting.id) })
      ?? meeting;
  }

  if (participantRole === "student" && meeting.status !== "live") {
    return Response.json({ error: "Meeting has not started yet." }, { status: 409 });
  }

  const existingParticipant = await db.query.sessionParticipants.findFirst({
    where: and(
      eq(sessionParticipants.sessionId, meeting.id),
      eq(sessionParticipants.userId, access.user.id),
    ),
  });

  const uid = existingParticipant?.agoraUid && !RESERVED_UIDS.has(existingParticipant.agoraUid)
    ? Number(existingParticipant.agoraUid)
    : await allocateUid(meeting.id);

  if (existingParticipant) {
    await db
      .update(sessionParticipants)
      .set({
        agoraUid: String(uid),
        role: participantRole,
        leftAt: null,
      })
      .where(
        and(
          eq(sessionParticipants.sessionId, meeting.id),
          eq(sessionParticipants.userId, access.user.id),
        ),
      );
  } else {
    await db.insert(sessionParticipants).values({
      sessionId: meeting.id,
      userId: access.user.id,
      agoraUid: String(uid),
      role: participantRole,
    });
  }

  const metadata = {
    name: access.user.name,
    role: participantRole,
    userId: access.user.id,
  };

  await redis.hset(`meeting:${resolvedChannelName}:participants`, String(uid), JSON.stringify(metadata));
  await redis.expire(`meeting:${resolvedChannelName}:participants`, 4 * 60 * 60);
  await redis.hset(`session:${meeting.id}:speakers`, String(uid), JSON.stringify(metadata));
  await redis.expire(`session:${meeting.id}:speakers`, 4 * 60 * 60);

  const token = createRtcToken(resolvedChannelName, uid, appId, appCertificate);
  return Response.json({
    appId,
    channelName: resolvedChannelName,
    token,
    uid,
    sessionId: meeting.id,
    classId: meeting.classId,
    role: participantRole,
    status: meeting.status,
  });
}
