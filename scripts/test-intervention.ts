import "dotenv/config";
import { initLiveContext } from "../lib/brain/live-context";
import { redis } from "../lib/redis";
import { db } from "../lib/db";
import { classes, meetingSessions } from "../lib/db/schema";
import { startInterventionEngine } from "../workers/intervention-engine";

async function runTest() {
  console.log("Setting up intervention test...");

  const sessionId = "d290f1ee-6c54-4b01-90e6-d701748f0851";
  const classId = "d290f1ee-6c54-4b01-90e6-d701748f0852";
  const mockAgentId = "mock-agent-123";

  // Create a mock class
  await db.insert(classes).values({
    id: classId,
    name: "Test Class",
    subject: "Test Subject",
    createdAt: new Date(),
  }).onConflictDoNothing();

  // Create a dummy meeting session to resolve the agentId
  await db.insert(meetingSessions).values({
    id: sessionId,
    classId: classId,
    agoraChannel: "test_channel_intervention",
    agoraAgentId: mockAgentId,
  }).onConflictDoNothing();

  // Initialize live context
  await initLiveContext(sessionId, classId);

  // Manipulate the context to trigger the engine
  const ctxKey = `classroom:${sessionId}:context`;
  const rawCtx = await redis.get(ctxKey);
  const ctx = JSON.parse(rawCtx!);

  // Set teacher not speaking, and add an unanswered question
  ctx.teacher_speaking = false;
  ctx.unanswered_questions = [
    { text: "I don't understand how mass relates to force.", student_uid: "1001", asked_at: Date.now() }
  ];
  ctx.last_ai_spoke_at = Date.now() - 60000; // Spoke 60 seconds ago

  await redis.set(ctxKey, JSON.stringify(ctx));

  console.log("Starting Intervention Engine loop. It should trigger in ~3 seconds.");
  
  // Note: the `injectPrompt` will try to call the real Agora API and likely return a 404
  // since `mock-agent-123` doesn't exist, but we will see the logs!
  startInterventionEngine();

  // Let it run for a couple of cycles
  setTimeout(() => {
    console.log("Test finished.");
    process.exit(0);
  }, 5000);
}

runTest().catch(console.error);
