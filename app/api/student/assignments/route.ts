import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignmentSubmissions, assignments, classMembers, classes } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";

export async function GET() {
  try {
    const access = await requireRole("student");
    if (!access.ok) return access.response;

    const allAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        due_date: assignments.dueDate,
        created_at: assignments.createdAt,
        status: sql<string>`coalesce(${assignmentSubmissions.status}, 'pending')`,
        submitted_at: assignmentSubmissions.submittedAt,
        subject: { id: classes.id, name: classes.name },
      })
      .from(assignments)
      .innerJoin(
        classMembers,
        and(
          eq(assignments.classId, classMembers.classId),
          eq(classMembers.studentId, access.user.id),
        ),
      )
      .innerJoin(classes, eq(assignments.classId, classes.id))
      .leftJoin(
        assignmentSubmissions,
        and(
          eq(assignmentSubmissions.assignmentId, assignments.id),
          eq(assignmentSubmissions.studentId, access.user.id),
        ),
      );

    return NextResponse.json(allAssignments);
  } catch (error) {
    console.error("[student/assignments] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
