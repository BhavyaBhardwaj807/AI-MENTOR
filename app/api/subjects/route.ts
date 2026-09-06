import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classMembers, classes } from "@/lib/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user && (session.user as { role?: string }).role === "teacher") {
      const teacherClasses = await db
        .select({
          id: classes.id,
          name: classes.name,
        })
        .from(classes)
        .where(eq(classes.teacherId, session.user.id));

      return NextResponse.json(teacherClasses);
    }

    if (session?.user && (session.user as { role?: string }).role === "student") {
      const studentClasses = await db
        .select({
          id: classes.id,
          name: classes.name,
        })
        .from(classMembers)
        .innerJoin(classes, eq(classMembers.classId, classes.id))
        .where(eq(classMembers.studentId, session.user.id));

      return NextResponse.json(studentClasses);
    }

    const rows = await db
      .select({ subject: classes.subject })
      .from(classes);

    const subjects = Array.from(new Set(rows.map((row) => row.subject)))
      .filter(Boolean)
      .sort()
      .map((subject) => ({ id: subject, name: subject }));

    return NextResponse.json(subjects);
  } catch (error) {
    console.error("[subjects/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
