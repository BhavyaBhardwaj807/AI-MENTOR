import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quizzes, quizQuestions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { meetingSessions } from "@/lib/db/schema";
import { requireClassAccess } from "@/lib/auth/guards";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const sessionId = searchParams.get("sessionId");

  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  try {
    let actualClassId = classId;
    let actualSessionId = sessionId;

    // Handle frontend passing agoraChannel strings instead of UUIDs
    if (classId?.startsWith("agora_") || sessionId?.startsWith("agora_")) {
      const channel = classId?.startsWith("agora_") ? classId : sessionId;
      const meeting = await db.query.meetingSessions.findFirst({
        where: eq(meetingSessions.agoraChannel, channel!),
      });
      if (!meeting) return NextResponse.json({ quiz: null });
      actualClassId = meeting.classId;
      actualSessionId = meeting.id;
    }

    const access = await requireClassAccess(actualClassId);
    if (!access.ok) return access.response;

    const isTeacher = access.user.role === "admin" || access.classData.teacherId === access.user.id;

    // Find the most recently generated quiz for this class/session
    const condition = actualSessionId
      ? and(eq(quizzes.classId, actualClassId), eq(quizzes.sessionId, actualSessionId))
      : eq(quizzes.classId, actualClassId);

    const recentQuiz = await db.query.quizzes.findFirst({
      where: condition,
      orderBy: [desc(quizzes.createdAt)],
    });

    if (!recentQuiz) {
      return NextResponse.json({ quiz: null });
    }

    if (!isTeacher && recentQuiz.status !== "published") {
      return NextResponse.json({ quiz: null }); // hide drafts/generating from students
    }

    // Don't show quizzes older than 1 hour as "active"
    if (Date.now() - new Date(recentQuiz.createdAt || "").getTime() > 60 * 60 * 1000) {
      return NextResponse.json({ quiz: null });
    }

    const questions = await db.query.quizQuestions.findMany({
      where: eq(quizQuestions.quizId, recentQuiz.id),
    });

    return NextResponse.json({
      quiz: {
        id: recentQuiz.id,
        status: recentQuiz.status,
        createdAt: recentQuiz.createdAt,
        questions: questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: isTeacher ? q.correctAnswer : undefined, // only send correct answers to teacher
        })),
      },
    });

  } catch (error) {
    console.error("Failed to fetch active quiz:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
