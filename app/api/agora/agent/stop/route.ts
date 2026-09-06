export async function POST() {
  return Response.json(
    {
      error: "Deprecated endpoint. Stop the AI Mentor through /api/meeting/control so meeting ownership, STT cleanup, and database state stay consistent.",
    },
    { status: 410 },
  );
}
