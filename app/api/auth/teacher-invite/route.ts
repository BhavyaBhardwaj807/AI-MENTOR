import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: Request) {
  const inviteCode = process.env.TEACHER_SIGNUP_CODE;
  if (!inviteCode) {
    return NextResponse.json({ error: "Teacher signup is not enabled" }, { status: 404 });
  }

  const access = await requireUser();
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code || !constantTimeEqual(code, inviteCode)) {
    return NextResponse.json({ error: "Invalid teacher invite code" }, { status: 403 });
  }

  await db
    .update(user)
    .set({ role: "teacher", updatedAt: new Date() })
    .where(eq(user.id, access.user.id));

  return NextResponse.json({ ok: true, role: "teacher" });
}
