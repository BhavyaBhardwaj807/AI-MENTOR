import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole("teacher");
  if (!auth.ok) return auth.error;

  try {
    const result = await pool.query(
      `SELECT
         m.id,
         m.title,
         m.meeting_id,
         m.scheduled_at,
         m.duration_minutes,
         m.created_at,
         s.id   AS subject_id,
         s.name AS subject_name
       FROM meetings m
       JOIN subjects s ON s.id = m.subject_id
       WHERE m.teacher_id = $1
       ORDER BY m.scheduled_at ASC`,
      [auth.payload.userId]
    );

    const meetings = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      meeting_id: row.meeting_id,
      scheduled_at: row.scheduled_at,
      duration_minutes: row.duration_minutes,
      created_at: row.created_at,
      subject: { id: row.subject_id, name: row.subject_name },
    }));

    return Response.json(meetings);
  } catch (err) {
    console.error("[api/teacher/meetings] error:", err);
    return Response.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("teacher");
  if (!auth.ok) return auth.error;

  let body: { subject_id?: unknown; title?: unknown; scheduled_at?: unknown; duration_minutes?: unknown; student_ids?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { subject_id, title, scheduled_at, duration_minutes, student_ids } = body;

  if (!subject_id) return Response.json({ error: "subject_id is required" }, { status: 400 });
  if (!title || typeof title !== "string" || title.trim().length === 0)
    return Response.json({ error: "title is required" }, { status: 400 });
  if (!scheduled_at || typeof scheduled_at !== "string" || isNaN(Date.parse(scheduled_at)))
    return Response.json({ error: "scheduled_at must be a valid ISO date string" }, { status: 400 });
  if (duration_minutes !== undefined && (typeof duration_minutes !== "number" || duration_minutes < 1))
    return Response.json({ error: "duration_minutes must be a positive number" }, { status: 400 });
  if (!Array.isArray(student_ids) || student_ids.length === 0)
    return Response.json({ error: "student_ids must be a non-empty array" }, { status: 400 });

  // Deduplicate student IDs
  const uniqueStudentIds = [...new Set(student_ids)];

  const client = await pool.connect();
  try {
    // Validate subject exists
    const subjectResult = await client.query(
      "SELECT id, name FROM subjects WHERE id = $1",
      [subject_id]
    );
    if (subjectResult.rowCount === 0)
      return Response.json({ error: "subject_id does not exist" }, { status: 400 });
    const subject = subjectResult.rows[0];

    // Validate all student_ids belong to this teacher via teacher_students
    const studentCheck = await client.query(
      `SELECT ts.student_id
       FROM teacher_students ts
       JOIN users u ON u.id = ts.student_id
       WHERE ts.teacher_id = $1
         AND u.role = 'student'
         AND ts.student_id = ANY($2::uuid[])`,
      [auth.payload.userId, uniqueStudentIds]
    );
    if (studentCheck.rowCount !== uniqueStudentIds.length)
      return Response.json({ error: "One or more student_ids are invalid or not assigned to you" }, { status: 400 });

    // Generate unique Agora channel ID — matches existing app convention
    const meetingChannelId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    await client.query("BEGIN");

    const meetingResult = await client.query(
      `INSERT INTO meetings (teacher_id, subject_id, title, meeting_id, scheduled_at, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, meeting_id, scheduled_at, duration_minutes, created_at`,
      [
        auth.payload.userId,
        subject_id,
        title.trim(),
        meetingChannelId,
        scheduled_at,
        duration_minutes ?? null,
      ]
    );
    const meeting = meetingResult.rows[0];

    // Insert meeting_students rows
    for (const studentId of uniqueStudentIds) {
      await client.query(
        "INSERT INTO meeting_students (meeting_id, student_id) VALUES ($1, $2)",
        [meeting.id, studentId]
      );
    }

    await client.query("COMMIT");

    return Response.json(
      {
        id: meeting.id,
        title: meeting.title,
        meeting_id: meeting.meeting_id,
        scheduled_at: meeting.scheduled_at,
        duration_minutes: meeting.duration_minutes,
        created_at: meeting.created_at,
        subject: { id: subject.id, name: subject.name },
        student_ids: uniqueStudentIds,
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[api/teacher/meetings POST] error:", err);
    return Response.json({ error: "Failed to create meeting" }, { status: 500 });
  } finally {
    client.release();
  }
}
