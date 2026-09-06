import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { requireMeetingAccessByChannel } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sessionParticipants, user } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type ParticipantMetadata = {
  name?: string | null;
  role?: string | null;
  userId?: string | null;
};

// GET: Return dictionary of uid -> { name, role }
export async function GET(
  req: Request,
  props: { params: Promise<{ roomId: string }> }
) {
  try {
    const params = await props.params;
    const { roomId } = params;

    const access = await requireMeetingAccessByChannel(roomId, { allowEnded: true });
    if (!access.ok) return access.response;

    // In Redis, we'll store participants in a Hash: meeting:{roomId}:participants
    const key = `meeting:${roomId}:participants`;
    const participantsData = await redis.hgetall(key);

    // Parse the JSON strings back into objects
    const result: Record<string, ParticipantMetadata> = {};
    for (const [uid, dataStr] of Object.entries(participantsData)) {
      try {
        result[uid] = JSON.parse(dataStr);
      } catch {
        // skip malformed
      }
    }

    const dbParticipants = await db
      .select({
        uid: sessionParticipants.agoraUid,
        role: sessionParticipants.role,
        userId: sessionParticipants.userId,
        name: user.name,
      })
      .from(sessionParticipants)
      .innerJoin(user, eq(user.id, sessionParticipants.userId))
      .where(eq(sessionParticipants.sessionId, access.meeting.id));

    for (const participant of dbParticipants) {
      if (!participant.uid) continue;
      const metadata = {
        name: participant.name,
        role: participant.role,
        userId: participant.userId,
      };
      result[participant.uid] = {
        ...result[participant.uid],
        ...metadata,
      };
      if (!participantsData[participant.uid]) {
        await redis.hset(key, participant.uid, JSON.stringify(metadata));
      }
    }

    if (dbParticipants.length > 0) {
      await redis.expire(key, 4 * 60 * 60);
    }

    return NextResponse.json({ participants: result });
  } catch (error) {
    console.error("[meeting/participants/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Add self to the dictionary
export async function POST(
  req: Request,
  props: { params: Promise<{ roomId: string }> }
) {
  try {
    const params = await props.params;
    const { roomId } = params;
    const { uid } = await req.json();

    if (uid == null) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const access = await requireMeetingAccessByChannel(roomId);
    if (!access.ok) return access.response;

    const participant = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, access.meeting.id),
        eq(sessionParticipants.userId, access.user.id),
      ),
    });

    if (!participant || participant.agoraUid !== String(uid)) {
      return NextResponse.json({ error: "Participant uid mismatch" }, { status: 403 });
    }

    const key = `meeting:${roomId}:participants`;

    // Store user data
    const userData = {
      name: access.user.name,
      role: participant.role,
      userId: access.user.id
    };

    await redis.hset(key, String(uid), JSON.stringify(userData));
    await redis.hset(`session:${access.meeting.id}:speakers`, String(uid), JSON.stringify(userData));

    // Expire the key after 4 hours to clean up automatically
    await redis.expire(key, 4 * 60 * 60);
    await redis.expire(`session:${access.meeting.id}:speakers`, 4 * 60 * 60);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[meeting/participants/POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
