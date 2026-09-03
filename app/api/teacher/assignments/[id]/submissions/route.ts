import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("teacher");
  if (!auth.ok) return auth.error;

  const { id: assignmentId } = await params;

  if (!uuidRe.test(assignmentId))
    return Response.json({ error: "Invalid assignment ID" }, { status: 400 });

  try {
    // Verify assignment exists and belongs to this teacher
    const ownerCheck = await pool.query(
      "SELECT id FROM assignments WHERE id = $1 AND teacher_id = $2",
      [assignmentId, auth.payload.userId]
    );

    if (ownerCheck.rowCount === 0) {
      const exists = await pool.query(
        "SELECT id FROM assignments WHERE id = $1",
        [assignmentId]
      );
      if (exists.rowCount === 0)
        return Response.json({ error: "Assignment not found" }, { status: 404 });
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all assigned students with their submission (if any)
    const result = await pool.query(
      `SELECT
         u.id          AS student_id,
         u.name        AS student_name,
         u.email       AS student_email,
         sub.id        AS submission_id,
         sub.status    AS submission_status,
         sub.submitted_at,
         sub.content
       FROM assignment_students ast
       JOIN users u
         ON u.id = ast.student_id
       LEFT JOIN assignment_submissions sub
         ON sub.assignment_id = ast.assignment_id
        AND sub.student_id   = ast.student_id
       WHERE ast.assignment_id = $1
         AND u.role = 'student'
       ORDER BY u.name ASC`,
      [assignmentId]
    );

    const submissions = result.rows.map((row) => ({
      student: {
        id: row.student_id,
        name: row.student_name,
        email: row.student_email,
      },
      status: row.submission_id ? "submitted" : "pending",
      submitted_at: row.submitted_at ?? null,
      content: row.content ?? null,
    }));

    return Response.json(submissions);
  } catch (err) {
    console.error("[api/teacher/assignments/[id]/submissions GET] error:", err);
    return Response.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}
