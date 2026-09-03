import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { signToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { email, password } = body;

  if (!email || typeof email !== "string")
    return Response.json({ error: "email is required" }, { status: 400 });
  if (!password || typeof password !== "string")
    return Response.json({ error: "password is required" }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (!result.rowCount || result.rowCount === 0)
      return Response.json({ error: "Invalid email or password" }, { status: 401 });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return Response.json({ error: "Invalid email or password" }, { status: 401 });

    const token = signToken({ userId: user.id, role: user.role });
    await setAuthCookie(token);

    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("[auth/login] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
