import { readFile } from "node:fs/promises";
import path from "node:path";
import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  const auth = await requireRole("teacher");
  if (!auth.ok) return auth.error;

  const { id: assignmentId, submissionId } = await params;
  if (!uuidRe.test(assignmentId) || !uuidRe.test(submissionId))
    return Response.json({ error: "Invalid assignment or submission ID" }, { status: 400 });

  try {
    const result = await pool.query(
      `SELECT sub.file_path, sub.file_name, sub.file_type
       FROM assignment_submissions sub
       JOIN assignments a ON a.id = sub.assignment_id
       JOIN assignment_students ast
         ON ast.assignment_id = sub.assignment_id
        AND ast.student_id = sub.student_id
       WHERE sub.id = $1
         AND sub.assignment_id = $2
         AND a.teacher_id = $3`,
      [submissionId, assignmentId, auth.payload.userId]
    );

    if (result.rowCount === 0) return Response.json({ error: "File not found" }, { status: 404 });
    const submission = result.rows[0];
    if (!submission.file_path || !submission.file_name)
      return Response.json({ error: "File not found" }, { status: 404 });

    const uploadRoot = path.resolve(process.cwd(), "private-uploads", "submissions");
    const filePath = path.resolve(submission.file_path);
    if (filePath !== uploadRoot && !filePath.startsWith(`${uploadRoot}${path.sep}`))
      return Response.json({ error: "File not found" }, { status: 404 });

    const file = await readFile(filePath);
    const isPdf = submission.file_type === "application/pdf";
    const disposition = isPdf ? "inline" : "attachment";
    const safeName = submission.file_name.replace(/[\\"\r\n]/g, "_");
    return new Response(file, {
      headers: {
        "Content-Type": submission.file_type || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[api/teacher/assignments/[id]/submissions/[submissionId]/file GET] error:", err);
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}