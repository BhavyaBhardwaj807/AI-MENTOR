import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { classMembers, classes, user } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";

export async function GET(request: Request) {
  try {
    const access = await requireRole("teacher");
    if (!access.ok) return access.response;

    const { searchParams } = new URL(request.url);
    const filterClassId = searchParams.get("classId")?.trim();

    const teacherClasses = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.teacherId, access.user.id));

    let classIds = teacherClasses.map((classRow) => classRow.id);

    if (filterClassId) {
      if (!classIds.includes(filterClassId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      classIds = [filterClassId];
    }

    if (classIds.length === 0) {
      return NextResponse.json([]);
    }

    const enrollments = await db
      .select({ studentId: classMembers.studentId })
      .from(classMembers)
      .where(inArray(classMembers.classId, classIds));

    const uniqueStudentIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.studentId)));
    if (uniqueStudentIds.length === 0) {
      return NextResponse.json([]);
    }

    const students = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      })
      .from(user)
      .where(inArray(user.id, uniqueStudentIds));

    return NextResponse.json(students);
  } catch (error) {
    console.error("[teacher/students] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
