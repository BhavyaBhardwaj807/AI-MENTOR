import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_CONTENT_LENGTH = 10_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf", "text/plain", "image/png", "image/jpeg",
  "application/zip", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".png", ".jpg", ".jpeg", ".zip", ".doc", ".docx"]);

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

  let rawContent: FormDataEntryValue | null = null;
  let uploaded: FormDataEntryValue | null = null;
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      rawContent = form.get("content");
      uploaded = form.get("file");
    } else {
      const body = await request.json() as { content?: unknown };
      rawContent = typeof body.content === "string" ? body.content : null;
    }
  } catch { return Response.json({ error: "Invalid submission data" }, { status: 400 }); }

  if (rawContent !== null && typeof rawContent !== "string")
    return Response.json({ error: "content must be a string" }, { status: 400 });
  if (typeof rawContent === "string" && rawContent.trim().length > MAX_CONTENT_LENGTH)
    return Response.json({ error: `content must not exceed ${MAX_CONTENT_LENGTH} characters` }, { status: 400 });

  const content = typeof rawContent === "string" ? rawContent.trim() : "";
  const file = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
  if (!content && !file) return Response.json({ error: "Add an answer or a file" }, { status: 400 });
  if (file) {
    const extension = path.extname(file.name).toLowerCase();
    if (file.size > MAX_FILE_SIZE) return Response.json({ error: "File must be 10 MB or smaller" }, { status: 400 });
    if (!ALLOWED_FILE_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension))
      return Response.json({ error: "Unsupported file type" }, { status: 400 });
  }
  const studentId = auth.payload.userId;
  let filePath: string | null = null;

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

    await pool.query(`
      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_name text;
      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_path text;
      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_type text;
      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_size integer;
    `);

    if (file) {
      const uploadDirectory = path.join(process.cwd(), "private-uploads", "submissions");
      await mkdir(uploadDirectory, { recursive: true });
      filePath = path.join(uploadDirectory, `${crypto.randomUUID()}${path.extname(file.name).toLowerCase()}`);
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    }

    const result = await pool.query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, content, status, submitted_at, file_name, file_path, file_type, file_size)
       VALUES ($1, $2, $3, 'submitted', NOW(), $4, $5, $6, $7)
       RETURNING id, assignment_id, status, submitted_at`,
      [assignmentId, studentId, content || null, file?.name ?? null, filePath, file?.type ?? null, file?.size ?? null]
    );

    const row = result.rows[0];
    return Response.json(
      {
        id: row.id,
        assignment_id: row.assignment_id,
        submitted_at: row.submitted_at,
        status: row.status,
        file_name: file?.name ?? null,
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
    if (filePath) await unlink(filePath).catch(() => {});
    console.error("[api/student/assignments/[id]/submit POST] error:", err);
    return Response.json({ error: "Failed to submit assignment" }, { status: 500 });
  }
}
