import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole("student");
  if (!auth.ok) return auth.error;

  try {
    const result = await pool.query(
      `SELECT
         a.id,
         a.title,
         a.description,
         a.due_date,
         a.created_at,
         s.id   AS subject_id,
         s.name AS subject_name,
         sub.id          AS submission_id,
         sub.submitted_at
       FROM assignment_students ast
       JOIN assignments a  ON a.id = ast.assignment_id
       JOIN subjects s     ON s.id = a.subject_id
       LEFT JOIN assignment_submissions sub
         ON sub.assignment_id = a.id
        AND sub.student_id   = ast.student_id
       WHERE ast.student_id = $1
       ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC`,
      [auth.payload.userId]
    );

    const assignments = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      due_date: row.due_date,
      created_at: row.created_at,
      subject: { id: row.subject_id, name: row.subject_name },
      status: row.submission_id ? "submitted" : "pending",
      submitted_at: row.submitted_at ?? null,
    }));

    return Response.json(assignments);
  } catch (err) {
    console.error("[api/student/assignments GET] error:", err);
    return Response.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}
