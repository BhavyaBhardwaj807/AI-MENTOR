import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quizzes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { brainLog } from "@/lib/logger";
import { requireClassOwner } from "@/lib/auth/guards";

export async function POST(req: Request) {
  try {
    const { quizId } = await req.json();
    if (!quizId) return NextResponse.json({ error: "Missing quizId" }, { status: 400 });

    const quiz = await db.query.quizzes.findFirst({
      where: eq(quizzes.id, quizId),
    });

    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

    const access = await requireClassOwner(quiz.classId);
    if (!access.ok) return access.response;

    await db.update(quizzes).set({ status: "published" }).where(eq(quizzes.id, quizId));

    brainLog.info({ quizId }, "Quiz published");
    return NextResponse.json({ success: true });
  } catch (e) {
    brainLog.error({ err: e }, "Failed to publish quiz");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
