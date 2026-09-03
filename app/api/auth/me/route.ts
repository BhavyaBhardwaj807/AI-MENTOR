import pool from "@/lib/db";
import { getAuthPayload } from "@/lib/auth";

export async function GET() {
  const payload = await getAuthPayload();
  if (!payload) return Response.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const result = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = $1",
      [payload.userId]
    );

    if (!result.rowCount || result.rowCount === 0)
      return Response.json({ error: "User not found" }, { status: 401 });

    return Response.json({ user: result.rows[0] });
  } catch (err) {
    console.error("[auth/me] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
