import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { classMembers, classes, user } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";

export async function GET() {
  try {
    const access = await requireRole("student");
    if (!access.ok) return access.response;

    const enrollments = await db
      .select({ classId: classMembers.classId })
      .from(classMembers)
      .where(eq(classMembers.studentId, access.user.id));

    const classIds = enrollments.map((enrollment) => enrollment.classId);
    if (classIds.length === 0) {
      return NextResponse.json([]);
    }

    const enrolledClasses = await db
      .select({ teacherId: classes.teacherId })
      .from(classes)
      .where(inArray(classes.id, classIds));

    const teacherIds = Array.from(new Set(
      enrolledClasses
        .map((classRow) => classRow.teacherId)
        .filter((id): id is string => id !== null),
    ));

    if (teacherIds.length === 0) {
      return NextResponse.json([]);
    }

    const teachers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      })
      .from(user)
      .where(inArray(user.id, teacherIds));

    return NextResponse.json(teachers);
  } catch (error) {
    console.error("[student/teachers] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
