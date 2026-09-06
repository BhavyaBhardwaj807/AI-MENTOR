import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, inArray, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { classMembers, classes, meetingSessions, user } from "@/lib/db/schema";
import { requireClassOwner, requireRole } from "@/lib/auth/guards";

type CreateMeetingBody = {
  title?: unknown;
  classId?: unknown;
  scheduled_at?: unknown;
  duration_minutes?: unknown;
  student_ids?: unknown;
};

function toMeetingResponse(
  session: typeof meetingSessions.$inferSelect,
  classData: Pick<typeof classes.$inferSelect, "id" | "name">,
  durationMinutes = 60,
) {
  return {
    id: session.id,
    title: session.topic,
    meeting_id: session.agoraChannel,
    scheduled_at: session.startedAt ?? session.createdAt,
    duration_minutes: durationMinutes,
    status: session.status,
    subject: { id: classData.id, name: classData.name },
  };
}

function parseScheduledAt(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export async function GET() {
  try {
    const access = await requireRole("teacher");
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
      .innerJoin(classes, eq(meetingSessions.classId, classes.id))
      .innerJoin(user, eq(classes.teacherId, user.id))
      .where(eq(classes.teacherId, access.user.id));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("[teacher/meetings/GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: CreateMeetingBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const classId = typeof body.classId === "string" ? body.classId.trim() : "";
    const scheduledAt = parseScheduledAt(body.scheduled_at);
    const durationMinutes = typeof body.duration_minutes === "number" && Number.isFinite(body.duration_minutes)
      ? Math.max(1, Math.min(480, Math.floor(body.duration_minutes)))
      : 60;

    if (!title || title.length > 200 || !classId) {
      return NextResponse.json({ error: "title and classId are required" }, { status: 400 });
    }
    if (scheduledAt === undefined) {
      return NextResponse.json({ error: "scheduled_at must be a valid ISO date when provided" }, { status: 400 });
    }

    const access = await requireClassOwner(classId);
    if (!access.ok) return access.response;

    const studentIds = Array.isArray(body.student_ids)
      ? body.student_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())
      : [];

    if (studentIds.length > 0) {
      const uniqueStudentIds = Array.from(new Set(studentIds));
      const enrolled = await db
        .select({ studentId: classMembers.studentId })
        .from(classMembers)
        .where(
          and(
            eq(classMembers.classId, classId),
            inArray(classMembers.studentId, uniqueStudentIds),
          ),
        );
      const enrolledIds = new Set(enrolled.map((row) => row.studentId));
      if (uniqueStudentIds.some((studentId) => !enrolledIds.has(studentId))) {
        return NextResponse.json({ error: "Meetings can only invite students enrolled in the class" }, { status: 400 });
      }
    }

    const channelName = `agora_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const [newSession] = await db
      .insert(meetingSessions)
      .values({
        classId,
        agoraChannel: channelName,
        topic: title,
        status: "pending",
        startedAt: scheduledAt,
      })
      .returning();

    return NextResponse.json(toMeetingResponse(newSession, access.classData, durationMinutes));
  } catch (error) {
    console.error("[teacher/meetings/POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
