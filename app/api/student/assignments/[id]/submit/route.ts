import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignmentSubmissions, assignments, classMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { storage } from "@/lib/storage";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRole("student");
    if (!access.ok) return access.response;

    const { id } = await props.params;
    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.id, id),
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const membership = await db.query.classMembers.findFirst({
      where: and(
        eq(classMembers.classId, assignment.classId),
        eq(classMembers.studentId, access.user.id),
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (assignment.dueDate && assignment.dueDate.getTime() < Date.now()) {
      return NextResponse.json({ error: "Assignment is closed" }, { status: 409 });
    }

    const existingSubmission = await db.query.assignmentSubmissions.findFirst({
      where: and(
        eq(assignmentSubmissions.assignmentId, id),
        eq(assignmentSubmissions.studentId, access.user.id),
      ),
    });

    if (existingSubmission?.status === "submitted") {
      return NextResponse.json({ error: "Assignment already submitted" }, { status: 409 });
    }

    const formData = await request.formData();
    const content = formData.get("content");
    const file = formData.get("file");

    const contentText = typeof content === "string" ? content.trim() : "";
    const upload = file instanceof File && file.size > 0
      ? await storage.save(file.name, Buffer.from(await file.arrayBuffer()), file.type)
      : null;

    if (!contentText && !upload) {
      return NextResponse.json({ error: "Add an answer or a file" }, { status: 400 });
    }

    if (contentText.length > 10_000) {
      return NextResponse.json({ error: "Answer is too long" }, { status: 400 });
    }

    const submittedAt = new Date();
    const values = {
      status: "submitted" as const,
      content: contentText || null,
      fileName: upload && file instanceof File ? file.name : null,
      filePath: upload?.storagePath ?? null,
      fileType: upload && file instanceof File ? file.type : null,
      fileSize: upload?.sizeBytes ?? null,
      submittedAt,
    };

    try {
      if (existingSubmission) {
        await db
          .update(assignmentSubmissions)
          .set(values)
          .where(
            and(
              eq(assignmentSubmissions.assignmentId, id),
              eq(assignmentSubmissions.studentId, access.user.id),
            ),
          );
      } else {
        await db.insert(assignmentSubmissions).values({
          assignmentId: id,
          studentId: access.user.id,
          ...values,
        });
      }
    } catch (error) {
      if (upload) {
        await storage.delete(upload.storagePath).catch((cleanupError) => {
          console.error("[student/assignments/[id]/submit/POST] upload cleanup failed:", cleanupError);
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      submitted_at: submittedAt,
    });
  } catch (error) {
    console.error("[student/assignments/[id]/submit/POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
