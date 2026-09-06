export async function POST() {
  return Response.json(
    {
      error: "Deprecated endpoint. Start the AI Mentor through /api/meeting/control so meeting ownership, idempotency, STT, and database state stay consistent.",
    },
    { status: 410 },
  );
}
