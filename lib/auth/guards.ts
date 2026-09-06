import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classMembers, classes, meetingSessions } from "@/lib/db/schema";

export type AppRole = "teacher" | "student" | "admin";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

type SessionGuardSuccess = {
  ok: true;
  user: SessionUser;
};

type MeetingAccessSuccess = SessionGuardSuccess & {
  meeting: typeof meetingSessions.$inferSelect;
  classData: typeof classes.$inferSelect;
};

export type GuardResult<T extends SessionGuardSuccess = SessionGuardSuccess> =
  | T
  | GuardFailure;

export function authError(message = "Unauthorized", status = 401): GuardFailure {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status }),
  };
}

export async function requireUser(): Promise<GuardResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return authError();
  }

  return { ok: true, user: session.user as SessionUser };
}

export async function requireRole(role: AppRole): Promise<GuardResult> {
  const result = await requireUser();
  if (!result.ok) return result;

  if (result.user.role !== role && result.user.role !== "admin") {
    return authError("Forbidden", 403);
  }

  return result;
}

export async function requireClassOwner(
  classId: string,
): Promise<GuardResult<SessionGuardSuccess & { classData: typeof classes.$inferSelect }>> {
  const result = await requireRole("teacher");
  if (!result.ok) return result;

  const classData = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
  });

  if (!classData) return authError("Class not found", 404);
  if (result.user.role !== "admin" && classData.teacherId !== result.user.id) {
    return authError("Forbidden", 403);
  }

  return { ok: true, user: result.user, classData };
}

export async function requireClassAccess(
  classId: string,
): Promise<GuardResult<SessionGuardSuccess & { classData: typeof classes.$inferSelect }>> {
  const result = await requireUser();
  if (!result.ok) return result;

  const classData = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
  });

  if (!classData) return authError("Class not found", 404);

  if (result.user.role === "admin" || classData.teacherId === result.user.id) {
    return { ok: true, user: result.user, classData };
  }

  if (result.user.role === "student") {
    const membership = await db.query.classMembers.findFirst({
      where: and(
        eq(classMembers.classId, classId),
        eq(classMembers.studentId, result.user.id),
      ),
    });

    if (membership) {
      return { ok: true, user: result.user, classData };
    }
  }

  return authError("Forbidden", 403);
}

export async function requireMeetingAccessByChannel(
  channelName: string,
  options: { allowEnded?: boolean } = {},
): Promise<GuardResult<MeetingAccessSuccess>> {
  const result = await requireUser();
  if (!result.ok) return result;

  const row = await db
    .select({
      meeting: meetingSessions,
      classData: classes,
    })
    .from(meetingSessions)
    .innerJoin(classes, eq(meetingSessions.classId, classes.id))
    .where(eq(meetingSessions.agoraChannel, channelName))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) return authError("Meeting not found", 404);
  if (!options.allowEnded && row.meeting.status === "ended") {
    return authError("Meeting has ended", 409);
  }

  if (result.user.role === "admin" || row.classData.teacherId === result.user.id) {
    return { ok: true, user: result.user, meeting: row.meeting, classData: row.classData };
  }

  if (result.user.role === "student") {
    const membership = await db.query.classMembers.findFirst({
      where: and(
        eq(classMembers.classId, row.meeting.classId),
        eq(classMembers.studentId, result.user.id),
      ),
    });

    if (membership) {
      return { ok: true, user: result.user, meeting: row.meeting, classData: row.classData };
    }
  }

  return authError("Forbidden", 403);
}

export async function requireMeetingAccessById(
  meetingId: string,
  options: { allowEnded?: boolean } = {},
): Promise<GuardResult<MeetingAccessSuccess>> {
  const result = await requireUser();
  if (!result.ok) return result;

  const row = await db
    .select({
      meeting: meetingSessions,
      classData: classes,
    })
    .from(meetingSessions)
    .innerJoin(classes, eq(meetingSessions.classId, classes.id))
    .where(eq(meetingSessions.id, meetingId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) return authError("Meeting not found", 404);
  if (!options.allowEnded && row.meeting.status === "ended") {
    return authError("Meeting has ended", 409);
  }

  if (result.user.role === "admin" || row.classData.teacherId === result.user.id) {
    return { ok: true, user: result.user, meeting: row.meeting, classData: row.classData };
  }

  if (result.user.role === "student") {
    const membership = await db.query.classMembers.findFirst({
      where: and(
        eq(classMembers.classId, row.meeting.classId),
        eq(classMembers.studentId, result.user.id),
      ),
    });

    if (membership) {
      return { ok: true, user: result.user, meeting: row.meeting, classData: row.classData };
    }
  }

  return authError("Forbidden", 403);
}

export async function requireMeetingOwnerById(
  meetingId: string,
): Promise<GuardResult<MeetingAccessSuccess>> {
  const result = await requireRole("teacher");
  if (!result.ok) return result;

  const row = await db
    .select({
      meeting: meetingSessions,
      classData: classes,
    })
    .from(meetingSessions)
    .innerJoin(classes, eq(meetingSessions.classId, classes.id))
    .where(eq(meetingSessions.id, meetingId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) return authError("Meeting not found", 404);
  if (result.user.role !== "admin" && row.classData.teacherId !== result.user.id) {
    return authError("Forbidden", 403);
  }

  return { ok: true, user: result.user, meeting: row.meeting, classData: row.classData };
}
