import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  assignmentSubmissions,
  assignments,
  classMembers,
  classes,
} from "@/lib/db/schema";
import { storage } from "@/lib/storage";

function isSafeStoragePath(path: string) {
  return path.length > 0
    && !path.startsWith("/")
    && !path.startsWith("\\")
    && !path.split(/[\\/]/).includes("..");
}

export async function GET(request: Request) {
  try {
    const access = await requireUser();
    if (!access.ok) return access.response;

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path") || "";

    if (!isSafeStoragePath(path)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const row = await db
      .select({
        submission: assignmentSubmissions,
        assignment: assignments,
        classData: classes,
      })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .innerJoin(classes, eq(assignments.classId, classes.id))
      .where(eq(assignmentSubmissions.filePath, path))
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const isTeacher = row.classData.teacherId === access.user.id;
    const isOwnerStudent = row.submission.studentId === access.user.id;
    const isAdmin = access.user.role === "admin";

    let isMember = false;
    if (access.user.role === "student") {
      const membership = await db.query.classMembers.findFirst({
        where: and(
          eq(classMembers.classId, row.assignment.classId),
          eq(classMembers.studentId, access.user.id),
        ),
      });
      isMember = Boolean(membership);
    }

    if (!isAdmin && !isTeacher && !(isOwnerStudent && isMember)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const file = await storage.read(path);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": row.submission.fileType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${row.submission.fileName || "assignment-file"}"`,
      },
    });
  } catch (error) {
    console.error("[files/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
