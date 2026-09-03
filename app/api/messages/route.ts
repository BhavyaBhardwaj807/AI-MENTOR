import pool from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 5000;

async function ensureMessageTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teacher_student_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      teacher_id uuid NOT NULL REFERENCES users(id),
      student_id uuid NOT NULL REFERENCES users(id),
      sender_role varchar(20) NOT NULL CHECK (sender_role IN ('teacher', 'student')),
      content text NOT NULL CHECK (length(trim(content)) > 0),
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const url = new URL(request.url);
  const requestedStudentId = url.searchParams.get("student_id");
  const requestedTeacherId = url.searchParams.get("teacher_id");

  if ((requestedStudentId && !uuidRe.test(requestedStudentId)) || (requestedTeacherId && !uuidRe.test(requestedTeacherId)))
    return Response.json({ error: "Invalid user ID" }, { status: 400 });

  try {
    await ensureMessageTable();
    const params: string[] = [auth.payload.userId];
    let query = `
      SELECT m.id, m.teacher_id, m.student_id, m.sender_role, m.content, m.created_at,
             t.name AS teacher_name, s.name AS student_name
      FROM teacher_student_messages m
      JOIN users t ON t.id = m.teacher_id
      JOIN users s ON s.id = m.student_id
      WHERE `;

    if (auth.payload.role === "student") {
      query += "m.student_id = $1";
      if (requestedTeacherId) { params.push(requestedTeacherId); query += " AND m.teacher_id = $2"; }
    } else {
      query += "m.teacher_id = $1";
      if (requestedStudentId) { params.push(requestedStudentId); query += " AND m.student_id = $2"; }
    }
    query += " ORDER BY m.created_at ASC";

    const result = await pool.query(query, params);
    return Response.json(result.rows.map((row) => ({
      id: row.id,
      teacher_id: row.teacher_id,
      student_id: row.student_id,
      sender_role: row.sender_role,
      content: row.content,
      created_at: row.created_at,
      teacher: { id: row.teacher_id, name: row.teacher_name },
      student: { id: row.student_id, name: row.student_name },
    })));
  } catch (err) {
    console.error("[api/messages GET] error:", err);
    return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  let body: { teacher_id?: unknown; student_id?: unknown; content?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (typeof body.content !== "string" || body.content.trim().length === 0 || body.content.trim().length > MAX_MESSAGE_LENGTH)
    return Response.json({ error: `content is required and must be at most ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 });

  const targetId = auth.payload.role === "student" ? body.teacher_id : body.student_id;
  if (typeof targetId !== "string" || !uuidRe.test(targetId))
    return Response.json({ error: "A valid conversation participant is required" }, { status: 400 });

  const teacherId = auth.payload.role === "teacher" ? auth.payload.userId : targetId;
  const studentId = auth.payload.role === "student" ? auth.payload.userId : targetId;

  try {
    await ensureMessageTable();
    const relationship = await pool.query(
      `SELECT 1 FROM teacher_students WHERE teacher_id = $1 AND student_id = $2`,
      [teacherId, studentId]
    );
    if (relationship.rowCount === 0) return Response.json({ error: "You are not connected to this user" }, { status: 403 });

    const result = await pool.query(
      `INSERT INTO teacher_student_messages (teacher_id, student_id, sender_role, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, teacher_id, student_id, sender_role, content, created_at`,
      [teacherId, studentId, auth.payload.role, body.content.trim()]
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[api/messages POST] error:", err);
    return Response.json({ error: "Failed to send message" }, { status: 500 });
  }
}