import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetingSessions } from "@/lib/db/schema";
import { requireMeetingOwnerById } from "@/lib/auth/guards";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    const access = await requireMeetingOwnerById(id);
    if (!access.ok) return access.response;

    if (access.meeting.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending meetings can be cancelled" },
        { status: 409 },
      );
    }

    await db.delete(meetingSessions).where(eq(meetingSessions.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[teacher/meetings/[id]/DELETE] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
