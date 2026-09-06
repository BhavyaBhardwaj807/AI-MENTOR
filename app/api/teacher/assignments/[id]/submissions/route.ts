import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignmentSubmissions, assignments, user } from "@/lib/db/schema";
import { requireClassOwner } from "@/lib/auth/guards";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;

    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.id, id),
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const access = await requireClassOwner(assignment.classId);
    if (!access.ok) return access.response;

    const rows = await db
      .select({
        studentId: user.id,
        name: user.name,
        email: user.email,
        status: assignmentSubmissions.status,
        content: assignmentSubmissions.content,
        submittedAt: assignmentSubmissions.submittedAt,
        fileName: assignmentSubmissions.fileName,
        filePath: assignmentSubmissions.filePath,
        fileType: assignmentSubmissions.fileType,
      })
      .from(assignmentSubmissions)
      .innerJoin(user, eq(assignmentSubmissions.studentId, user.id))
      .where(eq(assignmentSubmissions.assignmentId, id));

    return NextResponse.json(
      rows.map((row) => ({
        student: {
          id: row.studentId,
          name: row.name,
          email: row.email,
        },
        status: row.status,
        submitted_at: row.submittedAt,
        content: row.content,
        file: row.filePath
          ? {
              name: row.fileName,
              url: `/api/files?path=${encodeURIComponent(row.filePath)}`,
              type: row.fileType,
            }
          : null,
      })),
    );
  } catch (error) {
    console.error("[teacher/assignments/[id]/submissions/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
