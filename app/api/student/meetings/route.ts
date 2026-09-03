import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole("student");
  if (!auth.ok) return auth.error;

  try {
    await pool.query("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT FALSE");
    const result = await pool.query(
      `SELECT
         m.id,
         m.title,
         m.meeting_id,
         m.scheduled_at,
         m.duration_minutes,
         s.id   AS subject_id,
         s.name AS subject_name,
         t.id   AS teacher_id,
         t.name AS teacher_name
       FROM meeting_students ms
       JOIN meetings m  ON m.id  = ms.meeting_id
       JOIN subjects s  ON s.id  = m.subject_id
       JOIN users t     ON t.id  = m.teacher_id
       WHERE ms.student_id = $1
         AND t.role = 'teacher'
         AND COALESCE(m.is_cancelled, FALSE) = FALSE
       ORDER BY m.scheduled_at ASC`,
      [auth.payload.userId]
    );

    const meetings = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      meeting_id: row.meeting_id,
      scheduled_at: row.scheduled_at,
      duration_minutes: row.duration_minutes,
      subject: { id: row.subject_id, name: row.subject_name },
      teacher: { id: row.teacher_id, name: row.teacher_name },
    }));

    return Response.json(meetings);
  } catch (err) {
    console.error("[api/student/meetings] error:", err);
    return Response.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }
}
