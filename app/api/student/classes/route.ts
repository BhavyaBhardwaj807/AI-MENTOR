import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { classMembers, classes, user } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";

export async function GET() {
  try {
    const access = await requireRole("student");
    if (!access.ok) return access.response;

    const enrollments = await db
      .select({
        id: classes.id,
        name: classes.name,
        subject: classes.subject,
        agentName: classes.agentName,
        teacherName: user.name,
      })
      .from(classMembers)
      .innerJoin(classes, eq(classMembers.classId, classes.id))
      .innerJoin(user, eq(classes.teacherId, user.id))
      .where(eq(classMembers.studentId, access.user.id));

    return NextResponse.json(enrollments);
  } catch (error) {
    console.error("[student/classes/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
