import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quizQuestions, quizAttempts, masteryRecords } from "@/lib/db/schema";
import { inArray, eq, and } from "drizzle-orm";
import { brainLog as logger } from "@/lib/logger";

interface SubmitQuizRequest {
  quizId: string;
  studentId: string;
  answers: Record<string, string>; // questionId -> answer (e.g. "A")
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitQuizRequest;
    const { quizId, studentId, answers } = body;

    if (!quizId || !studentId || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const questionIds = Object.keys(answers);
    if (questionIds.length === 0) {
      return NextResponse.json({ error: "No answers provided" }, { status: 400 });
    }

    // 1. Fetch questions to check correct answers
    const questions = await db.query.quizQuestions.findMany({
      where: inArray(quizQuestions.id, questionIds),
    });

    const attemptsData = [];
    const masteryUpdates: Record<string, { correct: number; total: number }> = {};

    let totalCorrect = 0;

    for (const q of questions) {
      const given = answers[q.id];
      const isCorrect = given === q.correctAnswer;
      if (isCorrect) totalCorrect++;

      attemptsData.push({
        quizId,
        studentId,
        questionId: q.id,
        answerGiven: given,
        isCorrect,
      });

      // Track concept mastery changes
      if (q.conceptId) {
        if (!masteryUpdates[q.conceptId]) {
          masteryUpdates[q.conceptId] = { correct: 0, total: 0 };
        }
        masteryUpdates[q.conceptId].total++;
        if (isCorrect) masteryUpdates[q.conceptId].correct++;
      }
    }

    // 2. Save attempts
    await db.insert(quizAttempts).values(attemptsData);

    // 3. Update Mastery Records (Simple heuristic: move confidence by 0.1 per question)
    for (const [conceptId, stats] of Object.entries(masteryUpdates)) {
      const ratio = stats.correct / stats.total;
      const confidenceChange = ratio >= 0.5 ? 0.1 : -0.1; // Simple bump

      const existingMastery = await db.query.masteryRecords.findFirst({
        where: and(
          eq(masteryRecords.studentId, studentId),
          eq(masteryRecords.conceptId, conceptId)
        ),
      });

      if (existingMastery) {
        let newConfidence = Math.max(0, Math.min(1, existingMastery.confidence + confidenceChange));
        await db.update(masteryRecords)
          .set({
            confidence: newConfidence,
            evidence: `Quiz ${quizId} result: ${stats.correct}/${stats.total}`,
            lastUpdated: new Date(),
          })
          .where(eq(masteryRecords.id, existingMastery.id));
      } else {
        await db.insert(masteryRecords).values({
          studentId,
          conceptId,
          confidence: ratio >= 0.5 ? 0.5 : 0.2, // Baseline based on quiz
          evidence: `Initial quiz ${quizId} result: ${stats.correct}/${stats.total}`,
        });
      }
    }

    logger.info({ studentId, quizId, score: totalCorrect }, "Quiz submitted");

    return NextResponse.json({
      success: true,
      score: totalCorrect,
      total: questions.length,
      feedback: questions.map(q => ({
        questionId: q.id,
        isCorrect: answers[q.id] === q.correctAnswer,
        correctAnswer: q.correctAnswer,
      }))
    });

  } catch (error) {
    logger.error({ err: error }, "Failed to submit quiz");
    return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 });
  }
}
