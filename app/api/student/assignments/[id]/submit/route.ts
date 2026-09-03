import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

const MAX_CONTENT_LENGTH = 10_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("student");
  if (!auth.ok) return auth.error;

  const { id: assignmentId } = await params;

  // Validate assignment ID is a UUID
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(assignmentId))
    return Response.json({ error: "Invalid assignment ID" }, { status: 400 });

  let body: { content?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const rawContent = body.content;
  if (!rawContent || typeof rawContent !== "string" || rawContent.trim().length === 0)
    return Response.json({ error: "content is required and must be a non-empty string" }, { status: 400 });
  if (rawContent.trim().length > MAX_CONTENT_LENGTH)
    return Response.json({ error: `content must not exceed ${MAX_CONTENT_LENGTH} characters` }, { status: 400 });

  const content = rawContent.trim();
  const studentId = auth.payload.userId;

  try {
    // Verify assignment exists AND is assigned to this student
    const accessCheck = await pool.query(
      `SELECT a.id
       FROM assignments a
       JOIN assignment_students ast ON ast.assignment_id = a.id
       WHERE a.id = $1 AND ast.student_id = $2`,
      [assignmentId, studentId]
    );

    if (accessCheck.rowCount === 0) {
      // Distinguish 404 vs 403: check if assignment exists at all
      const exists = await pool.query(
        "SELECT id FROM assignments WHERE id = $1",
        [assignmentId]
      );
      if (exists.rowCount === 0)
        return Response.json({ error: "Assignment not found" }, { status: 404 });
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Insert submission; rely on UNIQUE(assignment_id, student_id) to catch duplicates
    const result = await pool.query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, content, status, submitted_at)
       VALUES ($1, $2, $3, 'submitted', NOW())
       RETURNING id, assignment_id, status, submitted_at`,
      [assignmentId, studentId, content]
    );

    const row = result.rows[0];
    return Response.json(
      {
        id: row.id,
        assignment_id: row.assignment_id,
        submitted_at: row.submitted_at,
        status: row.status,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return Response.json({ error: "Assignment already submitted" }, { status: 409 });
    }
    console.error("[api/student/assignments/[id]/submit POST] error:", err);
    return Response.json({ error: "Failed to submit assignment" }, { status: 500 });
  }
}
