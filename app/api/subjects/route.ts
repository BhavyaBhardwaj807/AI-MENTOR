import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("SELECT id, name FROM subjects ORDER BY name ASC");
    return Response.json(result.rows);
  } catch (err) {
    console.error("[api/subjects] error:", err);
    return Response.json({ error: "Failed to fetch subjects" }, { status: 500 });
  }
}
