import pool from "@/lib/db";
import { getAuthPayload } from "@/lib/auth";
import { createRtcToken } from "@/lib/agora";

// Derive a stable 32-bit Agora UID from a UUID string.
// Takes the first 8 hex chars of the UUID (no dashes) and parses as uint32.
// Clamped to [1, 4294967295] — Agora's valid numeric UID range.
function uuidToUid(uuid: string): number {
  const hex = uuid.replace(/-/g, "").slice(0, 8);
  const n = parseInt(hex, 16);
  return Math.max(1, n >>> 0) || 1;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !appCertificate)
    return Response.json({ error: "Agora credentials not configured" }, { status: 500 });

  const payload = await getAuthPayload();
  if (!payload)
    return Response.json({ error: "Unauthenticated" }, { status: 401 });

  const { meetingId } = await params;

  try {
    const meetingResult = await pool.query(
      `SELECT m.id, m.meeting_id, m.teacher_id FROM meetings m WHERE m.meeting_id = $1`,
      [meetingId]
    );

    if (meetingResult.rowCount === 0)
      return Response.json({ error: "Meeting not found" }, { status: 404 });

    const meeting = meetingResult.rows[0];

    if (payload.role === "teacher") {
      if (meeting.teacher_id !== payload.userId)
        return Response.json({ error: "Forbidden" }, { status: 403 });
    } else if (payload.role === "student") {
      const access = await pool.query(
        `SELECT 1 FROM meeting_students WHERE meeting_id = $1 AND student_id = $2`,
        [meeting.id, payload.userId]
      );
      if (access.rowCount === 0)
        return Response.json({ error: "Forbidden" }, { status: 403 });
    } else {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const uid = uuidToUid(payload.userId);
    const channelName = meeting.meeting_id;
    const token = createRtcToken(channelName, uid, appId, appCertificate);

    return Response.json({ appId, channelName, token, uid });
  } catch (err) {
    console.error("[api/meetings/token] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
