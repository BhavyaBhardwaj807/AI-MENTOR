import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classMembers, quizQuestions, quizAttempts, quizzes, masteryRecords } from "@/lib/db/schema";
import { inArray, eq, and } from "drizzle-orm";
import { brainLog as logger } from "@/lib/logger";
import { requireRole } from "@/lib/auth/guards";
import { qdrant, COLLECTIONS } from "@/lib/qdrant";
import { generateEmbedding } from "@/lib/embeddings";
import { v4 as uuidv4 } from "uuid";

interface SubmitQuizRequest {
  quizId: string;
  answers: Record<string, string>; // questionId -> answer (e.g. "A")
}

function isOptionMap(options: unknown): options is Record<string, string> {
  return (
    !!options &&
    typeof options === "object" &&
    !Array.isArray(options) &&
    Object.values(options).every((value) => typeof value === "string")
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitQuizRequest;
    const { quizId, answers } = body;

    if (!quizId || !answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const access = await requireRole("student");
    if (!access.ok) return access.response;

    const studentId = access.user.id;

    const quiz = await db.query.quizzes.findFirst({
      where: eq(quizzes.id, quizId),
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    if (quiz.status !== "published") {
      return NextResponse.json({ error: "Quiz is not accepting submissions" }, { status: 409 });
    }

    const membership = await db.query.classMembers.findFirst({
      where: and(
        eq(classMembers.classId, quiz.classId),
        eq(classMembers.studentId, studentId),
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingAttempt = await db.query.quizAttempts.findFirst({
      where: and(
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.studentId, studentId),
      ),
    });

    if (existingAttempt) {
      return NextResponse.json({ error: "Quiz already submitted" }, { status: 409 });
    }

    const questionIds = Object.keys(answers);
    if (questionIds.length === 0) {
      return NextResponse.json({ error: "No answers provided" }, { status: 400 });
    }

    // 1. Fetch questions to check correct answers
    const questions = await db.query.quizQuestions.findMany({
      where: inArray(quizQuestions.id, questionIds),
    });

    if (questions.length !== questionIds.length || questions.some((q) => q.quizId !== quizId)) {
      return NextResponse.json({ error: "Invalid quiz answers" }, { status: 400 });
    }

    const attemptsData: Array<typeof quizAttempts.$inferInsert> = [];
    const masteryUpdates: Record<string, { correct: number; total: number }> = {};

    let totalCorrect = 0;

    for (const q of questions) {
      const given = answers[q.id];
      if (typeof given !== "string" || given.length > 100 || !isOptionMap(q.options) || !(given in q.options)) {
        return NextResponse.json({ error: "Invalid quiz answers" }, { status: 400 });
      }

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

    await db.transaction(async (tx) => {
      // Re-check inside the transaction so two quick submissions cannot both pass the first read.
      const attemptInTransaction = await tx.query.quizAttempts.findFirst({
        where: and(
          eq(quizAttempts.quizId, quizId),
          eq(quizAttempts.studentId, studentId),
        ),
      });

      if (attemptInTransaction) {
        throw new Error("DUPLICATE_QUIZ_SUBMISSION");
      }

      await tx.insert(quizAttempts).values(attemptsData);

      // Update Mastery Records (Simple heuristic: move confidence by 0.1 per question)
      for (const [conceptId, stats] of Object.entries(masteryUpdates)) {
        const ratio = stats.correct / stats.total;
        const confidenceChange = ratio >= 0.5 ? 0.1 : -0.1;

        const existingMastery = await tx.query.masteryRecords.findFirst({
          where: and(
            eq(masteryRecords.studentId, studentId),
            eq(masteryRecords.conceptId, conceptId)
          ),
        });

        let newConfidence = ratio >= 0.5 ? 0.5 : 0.2;
        const evidenceStr = `Quiz ${quizId} result: ${stats.correct}/${stats.total} correct.`;

        if (existingMastery) {
          newConfidence = Math.max(0, Math.min(1, existingMastery.confidence + confidenceChange));
          await tx.update(masteryRecords)
            .set({
              confidence: newConfidence,
              evidence: evidenceStr,
              lastUpdated: new Date(),
            })
            .where(eq(masteryRecords.id, existingMastery.id));
        } else {
          await tx.insert(masteryRecords).values({
            studentId,
            conceptId,
            confidence: newConfidence,
            evidence: evidenceStr,
          });
        }
        
        // Push the quiz result into Qdrant for real-time AI personalization
        try {
          const conceptRecord = await tx.query.concepts.findFirst({
            where: eq(masteryRecords.id, conceptId)
          });
          const conceptName = conceptRecord ? conceptRecord.name : conceptId;
          const memoryText = `Student ${studentId} took a quiz on '${conceptName}' and scored ${stats.correct}/${stats.total}. This indicates ${ratio >= 0.5 ? "mastery" : "confusion"}.`;
          
          const vector = await generateEmbedding(memoryText);
          const qdrantPointId = uuidv4();
          
          await qdrant.upsert(COLLECTIONS.STUDENT_MEMORIES, {
            wait: true,
            points: [
              {
                id: qdrantPointId,
                vector,
                payload: {
                  student_id: studentId,
                  class_id: quiz.classId,
                  concept: conceptName,
                  event_type: ratio >= 0.5 ? "mastery" : "confusion",
                  content: memoryText,
                }
              }
            ]
          });
        } catch (err) {
          logger.error({ err, studentId, conceptId }, "Failed to push quiz mastery to Qdrant");
        }
      }
    });

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
    if (error instanceof Error && error.message === "DUPLICATE_QUIZ_SUBMISSION") {
      return NextResponse.json({ error: "Quiz already submitted" }, { status: 409 });
    }

    logger.error({ err: error }, "Failed to submit quiz");
    return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 });
  }
}
