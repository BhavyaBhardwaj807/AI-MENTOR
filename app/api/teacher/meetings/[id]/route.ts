import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("teacher");
  if (!auth.ok) return auth.error;
  const { id } = await params;
  if (!uuidRe.test(id)) return Response.json({ error: "Invalid meeting ID" }, { status: 400 });

  try {
    await pool.query("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT FALSE");
    const result = await pool.query(
      `UPDATE meetings SET is_cancelled = TRUE
       WHERE id = $1 AND teacher_id = $2
       RETURNING id`,
      [id, auth.payload.userId]
    );
    if (result.rowCount === 0) {
      const exists = await pool.query("SELECT id FROM meetings WHERE id = $1", [id]);
      return Response.json({ error: exists.rowCount ? "Forbidden" : "Meeting not found" }, { status: exists.rowCount ? 403 : 404 });
    }
    return Response.json({ success: true });
  } catch (err) {
    console.error("[api/teacher/meetings/[id] DELETE] error:", err);
    return Response.json({ error: "Failed to cancel meeting" }, { status: 500 });
  }
}