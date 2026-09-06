import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  assignmentSubmissions,
  assignments,
  classMembers,
  classes,
} from "@/lib/db/schema";
import { requireClassOwner, requireRole } from "@/lib/auth/guards";

export async function GET() {
  try {
    const access = await requireRole("teacher");
    if (!access.ok) return access.response;

    const rows = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueDate: assignments.dueDate,
        createdAt: assignments.createdAt,
        classId: classes.id,
        className: classes.name,
      })
      .from(assignments)
      .innerJoin(classes, eq(assignments.classId, classes.id))
      .where(eq(classes.teacherId, access.user.id));

    const result = await Promise.all(
      rows.map(async (assignment) => {
        const submissions = await db
          .select({ status: assignmentSubmissions.status })
          .from(assignmentSubmissions)
          .where(eq(assignmentSubmissions.assignmentId, assignment.id));

        const submitted = submissions.filter((submission) => submission.status === "submitted").length;

        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.dueDate,
          created_at: assignment.createdAt,
          subject: { id: assignment.classId, name: assignment.className },
          submission_stats: {
            total: submissions.length,
            submitted,
            pending: submissions.length - submitted,
          },
        };
      }),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[teacher/assignments/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const classId = typeof body.subject_id === "string" ? body.subject_id : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const dueDate = typeof body.due_date === "string" && body.due_date
      ? new Date(body.due_date)
      : null;
    const rawStudentIds: unknown[] = Array.isArray(body.student_ids)
      ? body.student_ids
      : [];
    const studentIds = rawStudentIds
      .filter((id: unknown): id is string => typeof id === "string")
      .filter((id) => id.length > 0);

    if (!classId || !title || studentIds.length === 0) {
      return NextResponse.json(
        { error: "Class, title, and at least one student are required" },
        { status: 400 },
      );
    }

    const access = await requireClassOwner(classId);
    if (!access.ok) return access.response;

    const enrollments = await db
      .select({ studentId: classMembers.studentId })
      .from(classMembers)
      .where(
        and(
          eq(classMembers.classId, classId),
          inArray(classMembers.studentId, studentIds),
        ),
      );

    const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
    if (studentIds.some((studentId) => !enrolledIds.has(studentId))) {
      return NextResponse.json(
        { error: "Assignments can only be created for enrolled students" },
        { status: 403 },
      );
    }

    const [assignment] = await db
      .insert(assignments)
      .values({
        classId,
        title,
        description,
        dueDate,
      })
      .returning();

    await db.insert(assignmentSubmissions).values(
      studentIds.map((studentId) => ({
        assignmentId: assignment.id,
        studentId,
        status: "pending" as const,
      })),
    );

    return NextResponse.json({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      due_date: assignment.dueDate,
      created_at: assignment.createdAt,
      subject: { id: access.classData.id, name: access.classData.name },
      submission_stats: {
        total: studentIds.length,
        submitted: 0,
        pending: studentIds.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[teacher/assignments/POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
