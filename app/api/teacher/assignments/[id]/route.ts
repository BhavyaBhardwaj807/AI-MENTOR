import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignmentSubmissions, assignments } from "@/lib/db/schema";
import { requireClassOwner } from "@/lib/auth/guards";

export async function DELETE(
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

    await db.delete(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, id));
    await db.delete(assignments).where(eq(assignments.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[teacher/assignments/[id]/DELETE] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
