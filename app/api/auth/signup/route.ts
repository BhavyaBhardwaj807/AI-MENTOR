import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { signToken, setAuthCookie, type Role } from "@/lib/auth";

const VALID_ROLES: Role[] = ["student", "teacher"];

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; password?: unknown; role?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, email, password, role } = body;

  if (!name || typeof name !== "string" || name.trim().length < 1)
    return Response.json({ error: "name is required" }, { status: 400 });
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return Response.json({ error: "A valid email is required" }, { status: 400 });
  if (!password || typeof password !== "string" || password.length < 6)
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  if (!role || !VALID_ROLES.includes(role as Role))
    return Response.json({ error: "role must be 'student' or 'teacher'" }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rowCount && existing.rowCount > 0)
      return Response.json({ error: "Email already registered" }, { status: 409 });

    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name.trim(), normalizedEmail, password_hash, role]
    );

    const user = result.rows[0];
    const token = signToken({ userId: user.id, role: user.role });
    await setAuthCookie(token);

    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { status: 201 });
  } catch (err) {
    console.error("[auth/signup] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
