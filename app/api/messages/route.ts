import { NextResponse } from "next/server";
import { asc, and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { classMembers, classes, messages } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";

type MessageBody = {
  student_id?: unknown;
  teacher_id?: unknown;
  content?: unknown;
};

async function hasTeacherStudentLink(teacherId: string, studentId: string) {
  const row = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .innerJoin(classes, eq(classMembers.classId, classes.id))
    .where(
      and(
        eq(classes.teacherId, teacherId),
        eq(classMembers.studentId, studentId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  return Boolean(row);
}

function formatMessage(message: typeof messages.$inferSelect) {
  return {
    id: message.id,
    student_id: message.studentId,
    teacher_id: message.teacherId,
    sender_role: message.senderRole,
    content: message.content,
    created_at: message.createdAt,
  };
}

export async function GET(request: Request) {
  try {
    const access = await requireUser();
    if (!access.ok) return access.response;

    const { searchParams } = new URL(request.url);
    const role = access.user.role;
    let studentId = "";
    let teacherId = "";

    if (role === "teacher" || role === "admin") {
      studentId = searchParams.get("student_id")?.trim() ?? "";
      teacherId = access.user.id;
      if (!studentId) {
        return NextResponse.json({ error: "student_id is required" }, { status: 400 });
      }
    } else if (role === "student") {
      teacherId = searchParams.get("teacher_id")?.trim() ?? "";
      studentId = access.user.id;
      if (!teacherId) {
        return NextResponse.json({ error: "teacher_id is required" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!(await hasTeacherStudentLink(teacherId, studentId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.studentId, studentId),
          eq(messages.teacherId, teacherId),
        ),
      )
      .orderBy(asc(messages.createdAt));

    return NextResponse.json(rows.map(formatMessage));
  } catch (error) {
    console.error("[messages/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireUser();
    if (!access.ok) return access.response;

    let body: MessageBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 5000) {
      return NextResponse.json({ error: "content is required and must be 5000 characters or fewer" }, { status: 400 });
    }

    const role = access.user.role;
    let studentId = "";
    let teacherId = "";
    let senderRole: "teacher" | "student";

    if (role === "teacher" || role === "admin") {
      studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
      teacherId = access.user.id;
      senderRole = "teacher";
      if (!studentId) {
        return NextResponse.json({ error: "student_id is required" }, { status: 400 });
      }
    } else if (role === "student") {
      teacherId = typeof body.teacher_id === "string" ? body.teacher_id.trim() : "";
      studentId = access.user.id;
      senderRole = "student";
      if (!teacherId) {
        return NextResponse.json({ error: "teacher_id is required" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!(await hasTeacherStudentLink(teacherId, studentId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [created] = await db
      .insert(messages)
      .values({
        studentId,
        teacherId,
        senderRole,
        content,
      })
      .returning();

    return NextResponse.json(formatMessage(created));
  } catch (error) {
    console.error("[messages/POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
