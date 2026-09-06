import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { classMembers, classes, meetingSessions, user } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";

export async function GET() {
  try {
    const access = await requireRole("student");
    if (!access.ok) return access.response;

    const sessions = await db
      .select({
        id: meetingSessions.id,
        title: meetingSessions.topic,
        meeting_id: meetingSessions.agoraChannel,
        scheduled_at: sql<Date>`coalesce(${meetingSessions.startedAt}, ${meetingSessions.createdAt})`,
        duration_minutes: sql<number>`60`,
        status: meetingSessions.status,
        subject: { id: classes.id, name: classes.name },
        teacher: { id: user.id, name: user.name },
      })
      .from(meetingSessions)
      .innerJoin(
        classMembers,
        and(
          eq(meetingSessions.classId, classMembers.classId),
          eq(classMembers.studentId, access.user.id),
        ),
      )
      .innerJoin(classes, eq(meetingSessions.classId, classes.id))
      .leftJoin(user, eq(classes.teacherId, user.id));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("[student/meetings] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
