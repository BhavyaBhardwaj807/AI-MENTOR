import { readFile } from "node:fs/promises";
import path from "node:path";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;
  const { id } = await params;

  try {
    const result = await pool.query(
      `SELECT sub.file_path, sub.file_name, sub.file_type
       FROM assignment_submissions sub
       JOIN assignment_students ast ON ast.assignment_id = sub.assignment_id AND ast.student_id = sub.student_id
       WHERE sub.assignment_id = $1 AND sub.student_id = $2`,
      [id, auth.payload.userId]
    );
    if (result.rowCount === 0 || !result.rows[0].file_path) return Response.json({ error: "File not found" }, { status: 404 });
    const file = await readFile(result.rows[0].file_path);
    return new Response(file, { headers: { "Content-Type": result.rows[0].file_type || "application/octet-stream", "Content-Disposition": `attachment; filename="${result.rows[0].file_name}"` } });
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}