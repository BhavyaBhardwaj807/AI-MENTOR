import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { concepts, quizQuestions, quizzes, studentMemories } from "@/lib/db/schema";
import { RETRIEVAL } from "@/lib/brain/config";
import { llmJsonCall } from "@/lib/llm";
import { brainLog as logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { CourseRetrievalAdapter } from "@/lib/retrieval/course-adapter";
import { MemoryRetrievalAdapter } from "@/lib/retrieval/memory-adapter";
import { getLiveContext } from "@/lib/brain/live-context";

function normalizeOptions(value: unknown): Record<string, string> | unknown {
  if (Array.isArray(value)) {
    return Object.fromEntries(value.slice(0, 4).map((option, index) => [
      String.fromCharCode(65 + index),
      String(option),
    ]));
  }

  return value;
}

const QuizQuestionSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  return {
    questionText: record.questionText ?? record.question ?? record.text ?? record.prompt,
    options: normalizeOptions(record.options ?? record.choices ?? record.answers),
    correctAnswer: record.correctAnswer ?? record.correct_answer ?? record.answer,
    difficulty: record.difficulty ?? 2,
  };
}, z.object({
  questionText: z.string().describe("The text of the question"),
  options: z.record(z.string(), z.string()).describe("A map of options, e.g. { 'A': 'option text', 'B': 'option text' }"),
  correctAnswer: z.string().describe("The key of the correct option, e.g. 'A'"),
  difficulty: z.number().min(1).max(5).describe("Difficulty level from 1 to 5"),
}));

const QuizSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return { questions: value };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.questions)) return record;
    if (record.quiz && typeof record.quiz === "object" && Array.isArray((record.quiz as Record<string, unknown>).questions)) {
      return { questions: (record.quiz as Record<string, unknown>).questions };
    }
    if (Array.isArray(record.items)) return { questions: record.items };
  }

  return value;
}, z.object({
  questions: z.array(QuizQuestionSchema).length(3),
}));

type LLMQuizResult = z.infer<typeof QuizSchema>;

export type GenerateQuizDraftInput = {
  classId: string;
  sessionId?: string;
  studentId?: string;
  topic: string;
  generatedBy: "ai" | "teacher";
};

async function getClassMemoryContext(classId: string) {
  const rows = await db
    .select({
      content: studentMemories.content,
      memoryType: studentMemories.memoryType,
      confidence: studentMemories.confidence,
      createdAt: studentMemories.createdAt,
      concept: concepts.name,
    })
    .from(studentMemories)
    .leftJoin(concepts, eq(studentMemories.conceptId, concepts.id))
    .where(eq(studentMemories.classId, classId))
    .orderBy(desc(studentMemories.createdAt))
    .limit(12);

  if (rows.length === 0) return "";

  return rows
    .map((row) => {
      const concept = row.concept ? `Concept: ${row.concept}` : "Concept: unknown";
      const confidence = typeof row.confidence === "number" ? `confidence ${row.confidence.toFixed(2)}` : "confidence unknown";
      return `- [${row.memoryType}; ${confidence}; ${concept}] ${row.content}`;
    })
    .join("\n");
}

async function getLiveQuizContext(sessionId?: string) {
  if (!sessionId) return "";

  const liveContext = await getLiveContext(sessionId);
  if (!liveContext) return "";

  const lines = ["Live session context:"];
  if (liveContext.current_topic) lines.push(`- Current topic: ${liveContext.current_topic}`);
  if (liveContext.current_subtopic) lines.push(`- Current subtopic: ${liveContext.current_subtopic}`);
  const signalsArray = Array.isArray(liveContext.confusion_signals) ? liveContext.confusion_signals : [];
  if (signalsArray.length) {
    lines.push(`- Confusion signals: ${signalsArray.map((signal) => `${signal.concept} (${signal.count})`).join(", ")}`);
  }
  if (liveContext.unanswered_questions?.length) {
    lines.push(`- Unanswered questions: ${liveContext.unanswered_questions.slice(0, 3).map((question) => question.text).join(" | ")}`);
  }
  if (liveContext.recent_utterances?.length) {
    lines.push("- Recent dialogue:");
    for (const utterance of liveContext.recent_utterances.slice(-8)) {
      lines.push(`  [${utterance.role.toUpperCase()}] ${utterance.text}`);
    }
  }

  return lines.join("\n");
}

export async function generateQuizDraft(input: GenerateQuizDraftInput) {
  const { classId, sessionId, studentId, topic, generatedBy } = input;

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

  const [classMemoryContext, liveQuizContext] = await Promise.all([
    getClassMemoryContext(classId),
    getLiveQuizContext(sessionId),
  ]);

  const retrievalContextText = [...courseContext, ...memoryContext]
    .map(c => `[Source: ${c.citation}]\n${c.content}`)
    .join("\n\n");

  const contextText = [
    retrievalContextText && `Retrieved course/student context:\n${retrievalContextText}`,
    classMemoryContext && `Class learning memory signals:\n${classMemoryContext}`,
    liveQuizContext,
  ].filter(Boolean).join("\n\n");

  const [quiz] = await db.insert(quizzes).values({
    classId,
    sessionId: sessionId || null,
    generatedBy,
    status: "generating",
  }).returning({ id: quizzes.id });

  const systemPrompt = `You are an expert teacher. Generate a 3-question multiple-choice quiz about "${topic}".
Use the provided course material and student memory to tailor the difficulty and focus.
Return exactly this JSON shape:
{"questions":[{"questionText":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"A","difficulty":2}]}`;

  let parsed: LLMQuizResult;
  try {
    const result = await llmJsonCall<LLMQuizResult>({
      model: "gpt-4o-mini",
      maxTokens: 1000,
      schema: QuizSchema,
      maxRetries: 3,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context:\n${contextText || "Use general knowledge if context is empty."}\n\nGenerate the quiz from the current lesson context. Prefer questions that test known weak points or recent discussion when available.` },
      ],
    });
    parsed = result.parsed;
  } catch (error) {
    await db.update(quizzes).set({ status: "failed" }).where(eq(quizzes.id, quiz.id));
    throw error;
  }

  let conceptId: string | null = null;
  const existingConcepts = await db.query.concepts.findMany({
    where: and(
      eq(concepts.classId, classId),
      ilike(concepts.name, `%${topic}%`),
    ),
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

  const savedQuestions = await db.insert(quizQuestions).values(parsed.questions.map(q => ({
    quizId: quiz.id,
    conceptId,
    questionText: q.questionText,
    options: q.options,
    correctAnswer: q.correctAnswer,
    difficulty: q.difficulty,
  }))).returning();

  await db.update(quizzes).set({ status: "draft" }).where(eq(quizzes.id, quiz.id));

  if (sessionId) {
    try {
      const ctxKey = `classroom:${sessionId}:context`;
      const rawCtx = await redis.get(ctxKey);
      const ctx = rawCtx ? JSON.parse(rawCtx) : {};
      ctx.unanswered_questions = [
        ...(ctx.unanswered_questions || []),
        { text: `[SYSTEM NOTIFICATION]: A pop-up quiz about "${topic}" has just appeared on the student's screen. Encourage them to answer it!` },
      ];
      await redis.set(ctxKey, JSON.stringify(ctx), "EX", 14400);
    } catch (err) {
      logger.warn({ err }, "Failed to update Redis context with quiz notification");
    }
  }

  return {
    quiz: {
      id: quiz.id,
      questions: savedQuestions,
    },
  };
}
