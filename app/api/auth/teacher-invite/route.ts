import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

/**
 * POST /api/auth/teacher-invite
 * Sets the current user's role to "teacher".
 * No invite code required — just select teacher during signup.
 */
export async function POST() {
  const access = await requireUser();
  if (!access.ok) return access.response;

  await db
    .update(user)
    .set({ role: "teacher", updatedAt: new Date() })
    .where(eq(user.id, access.user.id));

  return NextResponse.json({ ok: true, role: "teacher" });
}
