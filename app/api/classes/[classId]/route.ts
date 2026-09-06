import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classes, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireClassAccess } from "@/lib/auth/guards";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;

    const access = await requireClassAccess(classId);
    if (!access.ok) return access.response;

    const classData = await db
      .select({
        id: classes.id,
        name: classes.name,
        subject: classes.subject,
        description: classes.description,
        agentName: classes.agentName,
        joinCode: classes.joinCode,
        teacherId: classes.teacherId,
        teacherName: user.name,
      })
      .from(classes)
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(eq(classes.id, classId))
      .limit(1);

    if (classData.length === 0) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const isOwner = access.user.role === "admin" || classData[0].teacherId === access.user.id;
    const studentSafeClassData = {
      id: classData[0].id,
      name: classData[0].name,
      subject: classData[0].subject,
      description: classData[0].description,
      agentName: classData[0].agentName,
      teacherId: classData[0].teacherId,
      teacherName: classData[0].teacherName,
    };

    return NextResponse.json(isOwner ? classData[0] : studentSafeClassData);
  } catch (error) {
    console.error("[classes/[classId]/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
