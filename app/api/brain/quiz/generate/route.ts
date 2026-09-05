import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quizzes, quizQuestions, concepts } from "@/lib/db/schema";
import { eq, ilike } from "drizzle-orm";
import { llmJsonCall } from "@/lib/llm";
import { CourseRetrievalAdapter } from "@/lib/retrieval/course-adapter";
import { MemoryRetrievalAdapter } from "@/lib/retrieval/memory-adapter";
import { RETRIEVAL } from "@/lib/brain/config";
import { brainLog as logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { z } from "zod";

interface GenerateQuizRequest {
  classId: string;
  sessionId?: string;
  studentId?: string;
  topic: string;
}

const QuizSchema = z.object({
  questions: z.array(z.object({
    questionText: z.string().describe("The text of the question"),
    options: z.record(z.string(), z.string()).describe("A map of options, e.g. { 'A': 'option text', 'B': 'option text' }"),
    correctAnswer: z.string().describe("The key of the correct option, e.g. 'A'"),
    difficulty: z.number().min(1).max(5).describe("Difficulty level from 1 to 5"),
  })).length(3),
});

type LLMQuizResult = z.infer<typeof QuizSchema>;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateQuizRequest;
    const { classId, sessionId, studentId, topic } = body;

    if (!classId || !topic) {
      return NextResponse.json({ error: "classId and topic are required" }, { status: 400 });
    }

    logger.info({ classId, topic }, "Generating quiz...");

    // 1. Retrieve context
    const courseAdapter = new CourseRetrievalAdapter();
    const courseContext = await courseAdapter.retrieve(topic, {
      classId,
      maxResults: 5,
      scoreThreshold: RETRIEVAL.scoreThreshold,
      tokenBudget: 1000,
    });

    const memoryAdapter = new MemoryRetrievalAdapter();
    const memoryContext = studentId ? await memoryAdapter.retrieve(topic, {
      classId,
      studentId,
      maxResults: 3,
      scoreThreshold: RETRIEVAL.scoreThreshold,
      tokenBudget: 500,
    }) : [];

    const contextText = [...courseContext, ...memoryContext]
      .map(c => `[Source: ${c.citation}]\n${c.content}`)
      .join("\n\n");

    // 2. Generate quiz questions
    const systemPrompt = `You are an expert teacher. Generate a 3-question multiple-choice quiz about "${topic}".
Use the provided course material and student memory to tailor the difficulty and focus.`;

    const { parsed } = await llmJsonCall<LLMQuizResult>({
      model: "gpt-4o-mini", // Fast model for generation
      maxTokens: 1000,
      schema: QuizSchema,
      maxRetries: 3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context:\n${contextText || "Use general knowledge if context is empty."}\n\nGenerate the quiz.` }
      ],
    });

    // 3. Find or create a Concept for the topic
    let conceptId: string | null = null;
    const existingConcepts = await db.query.concepts.findMany({
      where: ilike(concepts.name, `%${topic}%`),
      limit: 1,
    });
    
    if (existingConcepts.length > 0) {
      conceptId = existingConcepts[0].id;
    } else {
      const [newConcept] = await db.insert(concepts).values({
        classId,
        name: topic,
        description: `Auto-generated concept from quiz: ${topic}`,
      }).returning({ id: concepts.id });
      conceptId = newConcept.id;
    }

    // 4. Save Quiz and Questions to DB
    const [quiz] = await db.insert(quizzes).values({
      classId,
      sessionId: sessionId || null,
      generatedBy: "ai",
    }).returning({ id: quizzes.id });

    const insertData = parsed.questions.map(q => ({
      quizId: quiz.id,
      conceptId,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty,
    }));

    const savedQuestions = await db.insert(quizQuestions).values(insertData).returning();

    // 5. Notify AI and Frontend
    // Update Redis context so the AI knows about the active quiz
    if (sessionId) {
      try {
        const ctxKey = `classroom:${sessionId}:context`;
        const rawCtx = await redis.get(ctxKey);
        const ctx = rawCtx ? JSON.parse(rawCtx) : {};
        ctx.unanswered_questions = [
          ...(ctx.unanswered_questions || []),
          { text: `[SYSTEM NOTIFICATION]: A pop-up quiz about "${topic}" has just appeared on the student's screen. Encourage them to answer it!` }
        ];
        await redis.set(ctxKey, JSON.stringify(ctx), "EX", 14400); // 4 hours
      } catch (err) {
        logger.warn({ err }, "Failed to update Redis context with quiz notification");
      }
    }

    logger.info({ quizId: quiz.id, questions: savedQuestions.length }, "Quiz generated successfully");

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        questions: savedQuestions.map(q => ({
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
