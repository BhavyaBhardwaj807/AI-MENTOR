import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole("teacher");
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
         COUNT(DISTINCT ast.student_id)::int AS total_students,
         COUNT(DISTINCT CASE WHEN sub.id IS NOT NULL THEN ast.student_id END)::int AS submitted_students
       FROM assignments a
       JOIN subjects s ON s.id = a.subject_id
       LEFT JOIN assignment_students ast ON ast.assignment_id = a.id
       LEFT JOIN assignment_submissions sub
         ON sub.assignment_id = a.id AND sub.student_id = ast.student_id
       WHERE a.teacher_id = $1
       GROUP BY a.id, a.title, a.description, a.due_date, a.created_at, s.id, s.name
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
      submission_stats: {
        total: row.total_students,
        submitted: row.submitted_students,
        pending: row.total_students - row.submitted_students,
      },
    }));

    return Response.json(assignments);
  } catch (err) {
    console.error("[api/teacher/assignments GET] error:", err);
    return Response.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("teacher");
  if (!auth.ok) return auth.error;

  let body: { subject_id?: unknown; title?: unknown; description?: unknown; due_date?: unknown; student_ids?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { subject_id, title, description, due_date, student_ids } = body;

  if (!subject_id)
    return Response.json({ error: "subject_id is required" }, { status: 400 });
  if (!title || typeof title !== "string" || title.trim().length === 0)
    return Response.json({ error: "title is required" }, { status: 400 });
  if (description !== undefined && typeof description !== "string")
    return Response.json({ error: "description must be a string" }, { status: 400 });
  if (due_date !== undefined && (typeof due_date !== "string" || isNaN(Date.parse(due_date))))
    return Response.json({ error: "due_date must be a valid ISO date string" }, { status: 400 });
  if (!Array.isArray(student_ids) || student_ids.length === 0)
    return Response.json({ error: "student_ids must be a non-empty array" }, { status: 400 });

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

    // Validate all student_ids are assigned to this teacher
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

    await client.query("BEGIN");

    const assignmentResult = await client.query(
      `INSERT INTO assignments (teacher_id, subject_id, title, description, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, due_date, created_at`,
      [
        auth.payload.userId,
        subject_id,
        title.trim(),
        description ?? null,
        due_date ?? null,
      ]
    );
    const assignment = assignmentResult.rows[0];

    for (const studentId of uniqueStudentIds) {
      await client.query(
        "INSERT INTO assignment_students (assignment_id, student_id) VALUES ($1, $2)",
        [assignment.id, studentId]
      );
    }

    await client.query("COMMIT");

    return Response.json(
      {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        due_date: assignment.due_date,
        created_at: assignment.created_at,
        subject: { id: subject.id, name: subject.name },
        student_ids: uniqueStudentIds,
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[api/teacher/assignments POST] error:", err);
    return Response.json({ error: "Failed to create assignment" }, { status: 500 });
  } finally {
    client.release();
  }
}

