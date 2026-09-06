import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { classMembers, classes } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";

type JoinClassBody = {
  joinCode?: unknown;
};

function isUniqueViolation(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}

export async function POST(request: Request) {
  try {
    const access = await requireRole("student");
    if (!access.ok) return access.response;

    let body: JoinClassBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const joinCode = typeof body.joinCode === "string" ? body.joinCode.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(joinCode)) {
      return NextResponse.json({ error: "Join code must be 6 letters or numbers" }, { status: 400 });
    }

    const targetClass = await db.query.classes.findFirst({
      where: eq(classes.joinCode, joinCode),
    });

    if (!targetClass) {
      return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
    }

    const existing = await db.query.classMembers.findFirst({
      where: and(
        eq(classMembers.classId, targetClass.id),
        eq(classMembers.studentId, access.user.id),
      ),
    });

    if (existing) {
      return NextResponse.json({ error: "You are already in this class" }, { status: 409 });
    }

    try {
      await db.insert(classMembers).values({
        classId: targetClass.id,
        studentId: access.user.id,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "You are already in this class" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      class: {
        id: targetClass.id,
        name: targetClass.name,
        subject: targetClass.subject,
        agentName: targetClass.agentName,
        teacherId: targetClass.teacherId,
      },
    });
  } catch (error) {
    console.error("[student/classes/join] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
