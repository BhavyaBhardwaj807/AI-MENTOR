import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { classes } from "@/lib/db/schema";
import { requireClassOwner, requireRole } from "@/lib/auth/guards";

type CreateClassBody = {
  name?: unknown;
  subject?: unknown;
  description?: unknown;
};

type UpdateClassBody = {
  classId?: unknown;
  agentName?: unknown;
};

async function generateJoinCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const joinCode = randomBytes(3).toString("hex").toUpperCase();
    const existing = await db.query.classes.findFirst({
      where: eq(classes.joinCode, joinCode),
    });
    if (!existing) return joinCode;
  }

  throw new Error("Could not allocate unique class join code");
}

function asBoundedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length > maxLength) return "";
  return text;
}

export async function GET() {
  try {
    const access = await requireRole("teacher");
    if (!access.ok) return access.response;

    const teacherClasses = await db
      .select({
        id: classes.id,
        name: classes.name,
        subject: classes.subject,
        agentName: classes.agentName,
        joinCode: classes.joinCode,
      })
      .from(classes)
      .where(eq(classes.teacherId, access.user.id));

    return NextResponse.json(teacherClasses);
  } catch (error) {
    console.error("[teacher/classes] GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireRole("teacher");
    if (!access.ok) return access.response;

    let body: CreateClassBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const name = asBoundedText(body.name, 120);
    const subject = asBoundedText(body.subject, 120);
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;

    if (!name || !subject) {
      return NextResponse.json({ error: "Name and subject are required" }, { status: 400 });
    }

    const [newClass] = await db
      .insert(classes)
      .values({
        teacherId: access.user.id,
        name,
        subject,
        description,
        joinCode: await generateJoinCode(),
      })
      .returning();

    return NextResponse.json(newClass);
  } catch (error) {
    console.error("[teacher/classes/POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    let body: UpdateClassBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const classId = asBoundedText(body.classId, 80);
    const agentName = asBoundedText(body.agentName, 80);

    if (!classId || !agentName) {
      return NextResponse.json({ error: "classId and agentName are required" }, { status: 400 });
    }

    const access = await requireClassOwner(classId);
    if (!access.ok) return access.response;

    await db
      .update(classes)
      .set({ agentName })
      .where(eq(classes.id, access.classData.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[teacher/classes] PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
