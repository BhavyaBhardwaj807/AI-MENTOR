import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classMembers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { meetingSessions } from "@/lib/db/schema";
import { generateQuizDraft } from "@/lib/brain/quiz-generation";
import { brainLog as logger } from "@/lib/logger";
import { requireClassOwner } from "@/lib/auth/guards";

interface GenerateQuizRequest {
  classId: string;
  sessionId?: string;
  studentId?: string;
  topic: string;
}

function isTrustedBrainRequest(req: Request) {
  const secret = process.env.BRAIN_SERVER_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  return token === secret;
}

export async function POST(req: Request) {
  try {
    let body: Partial<GenerateQuizRequest>;
    try {
      body = await req.json() as Partial<GenerateQuizRequest>;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const classId = typeof body.classId === "string" ? body.classId.trim() : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : undefined;
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : undefined;
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";

    if (!classId || !topic || topic.length > 200) {
      return NextResponse.json({ error: "classId and topic are required" }, { status: 400 });
    }

    logger.info({ classId, topic }, "Generating quiz...");

    let actualClassId = classId;
    let actualSessionId = sessionId;

    // Handle frontend passing agoraChannel strings instead of UUIDs
    if (classId?.startsWith("agora_") || sessionId?.startsWith("agora_")) {
      const channel = classId?.startsWith("agora_") ? classId : sessionId;
      const meeting = await db.query.meetingSessions.findFirst({
        where: eq(meetingSessions.agoraChannel, channel!),
      });
      if (!meeting) return NextResponse.json({ error: "Invalid meeting channel" }, { status: 400 });
      actualClassId = meeting.classId;
      actualSessionId = meeting.id;
    }

    if (actualSessionId) {
      const meeting = await db.query.meetingSessions.findFirst({
        where: eq(meetingSessions.id, actualSessionId),
      });

      if (!meeting || meeting.classId !== actualClassId) {
        return NextResponse.json({ error: "Invalid meeting session" }, { status: 400 });
      }
    }

    const trustedBrain = isTrustedBrainRequest(req);
    if (!trustedBrain) {
      const access = await requireClassOwner(actualClassId);
      if (!access.ok) return access.response;
    }

    if (studentId) {
      const membership = await db.query.classMembers.findFirst({
        where: and(
          eq(classMembers.classId, actualClassId),
          eq(classMembers.studentId, studentId),
        ),
      });

      if (!membership) {
        return NextResponse.json({ error: "studentId must belong to the quiz class" }, { status: 400 });
      }
    }

    const result = await generateQuizDraft({
      classId: actualClassId,
      sessionId: actualSessionId,
      studentId,
      generatedBy: trustedBrain ? "ai" : "teacher",
      topic,
    });

    logger.info({ quizId: result.quiz.id, questions: result.quiz.questions.length }, "Quiz generated successfully");

    return NextResponse.json({
      quiz: {
        id: result.quiz.id,
        questions: result.quiz.questions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
        })), // omit correct answers for the frontend
      }
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to generate quiz");
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}
