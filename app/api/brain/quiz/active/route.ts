import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quizzes, quizQuestions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const sessionId = searchParams.get("sessionId");

  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  try {
    // Find the most recently generated quiz for this class/session
    let condition = eq(quizzes.classId, classId);
    if (sessionId) {
      condition = and(condition, eq(quizzes.sessionId, sessionId)) as any;
    }

    const recentQuiz = await db.query.quizzes.findFirst({
      where: condition,
      orderBy: [desc(quizzes.createdAt)],
    });

    if (!recentQuiz) {
      return NextResponse.json({ quiz: null });
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
        createdAt: recentQuiz.createdAt,
        questions: questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
        })),
      }
    });

  } catch (error) {
    console.error("Failed to fetch active quiz:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
