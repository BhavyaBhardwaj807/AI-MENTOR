import pool from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRole("student");
  if (!auth.ok) return auth.error;

  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM teacher_students ts
       JOIN users u ON u.id = ts.teacher_id
       WHERE ts.student_id = $1
         AND u.role = 'teacher'
       ORDER BY u.name ASC`,
      [auth.payload.userId]
    );
    return Response.json(result.rows);
  } catch (err) {
    console.error("[api/student/teachers] error:", err);
    return Response.json({ error: "Failed to fetch teachers" }, { status: 500 });
  }
}