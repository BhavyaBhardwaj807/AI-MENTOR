import { unlink } from "node:fs/promises";
import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("teacher");
  if (!auth.ok) return auth.error;

  const { id: assignmentId } = await params;
  if (!uuidRe.test(assignmentId))
    return Response.json({ error: "Invalid assignment ID" }, { status: 400 });

  const client = await pool.connect();
  let filePaths: string[] = [];
  try {
    const ownership = await client.query(
      "SELECT id FROM assignments WHERE id = $1 AND teacher_id = $2",
      [assignmentId, auth.payload.userId]
    );
    if (ownership.rowCount === 0) {
      const exists = await client.query("SELECT id FROM assignments WHERE id = $1", [assignmentId]);
      return Response.json({ error: exists.rowCount ? "Forbidden" : "Assignment not found" }, { status: exists.rowCount ? 403 : 404 });
    }

    const files = await client.query(
      "SELECT file_path FROM assignment_submissions WHERE assignment_id = $1 AND file_path IS NOT NULL",
      [assignmentId]
    );
    filePaths = files.rows.map((row) => row.file_path as string);

    await client.query("BEGIN");
    await client.query("DELETE FROM assignment_submissions WHERE assignment_id = $1", [assignmentId]);
    await client.query("DELETE FROM assignment_students WHERE assignment_id = $1", [assignmentId]);
    await client.query("DELETE FROM assignments WHERE id = $1 AND teacher_id = $2", [assignmentId, auth.payload.userId]);
    await client.query("COMMIT");

    await Promise.all(filePaths.map((filePath) => unlink(filePath).catch(() => {})));
    return Response.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[api/teacher/assignments/[id] DELETE] error:", err);
    return Response.json({ error: "Failed to delete assignment" }, { status: 500 });
  } finally {
    client.release();
  }
}