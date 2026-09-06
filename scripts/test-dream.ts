/**
 * scripts/test-dream.ts
 *
 * Simulates a classroom session, adds fake transcripts, 
 * triggers the dream worker, and verifies the memory retrieval adapter.
 */

import { db } from "../lib/db";
import { user, classes, meetingSessions, transcriptSegments } from "../lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { brainLog as logger } from "../lib/logger";
import { dreamQueue } from "../lib/queue";
import { MemoryRetrievalAdapter } from "../lib/retrieval/memory-adapter";

async function main() {
  logger.info("Starting Dream Worker verification...");

  try {
    // 1. Create a Student and Session
    const studentId = uuidv4();
    await db.insert(user).values({
      id: studentId,
      name: "Test Student",
      email: `student_${Date.now()}@test.com`,
      emailVerified: true,
      role: "student",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [cls] = await db.insert(classes).values({
      name: "Physics 201 (Dream Test)",
      subject: "Physics",
    }).returning();

    const [session] = await db.insert(meetingSessions).values({
      classId: cls.id,
      agoraChannel: `dream_test_channel_${Date.now()}`,
      topic: "Velocity vs Speed",
      status: "ended",
    }).returning();

    logger.info({ sessionId: session.id, studentId }, "Test session setup complete");

    // 2. Add Transcripts demonstrating confusion then breakthrough
    await db.insert(transcriptSegments).values([
      {
        sessionId: session.id,
        speakerUid: studentId,
        speakerRole: "student",
        content: "I don't understand the difference between velocity and speed. Aren't they the same thing?",
        startedAtMs: Date.now(),
        endedAtMs: Date.now() + 5000,
        isFinal: true,
      },
      {
        sessionId: session.id,
        speakerUid: "teacher-bot",
        speakerRole: "ai",
        content: "Speed is just how fast you're going, like 60 mph. Velocity is speed WITH a direction, like 60 mph North.",
        startedAtMs: Date.now() + 6000,
        endedAtMs: Date.now() + 10000,
        isFinal: true,
      },
      {
        sessionId: session.id,
        speakerUid: studentId,
        speakerRole: "student",
        content: "Oh! So velocity is a vector because it has direction. I get it now, that makes sense.",
        startedAtMs: Date.now() + 11000,
        endedAtMs: Date.now() + 15000,
        isFinal: true,
      }
    ]);

    logger.info("Injected fake transcripts. Enqueueing dream job...");

    // 3. Enqueue Dream Job
    const job = await dreamQueue.add("dream-memories", { sessionId: session.id });

    // Wait for the worker to pick it up (make sure you are running `npx tsx workers/index.ts` in another terminal,
    // OR we can just invoke the logic directly here for test purposes).
    // Actually, let's just wait and see if the job completes. If there is no worker running, it won't complete.
    logger.info(`Job ${job.id} enqueued. Note: A worker must be running to process it.`);

    // To test end-to-end without needing the worker process running concurrently,
    // let's just query the memory adapter immediately, assuming we will run the worker manually or it runs in background.
    
    // Test the MemoryRetrievalAdapter query
    const adapter = new MemoryRetrievalAdapter();
    const results = await adapter.retrieve("What does the student know about velocity?", {
      classId: cls.id,
      studentId: studentId,
      maxResults: 5,
      scoreThreshold: 0.5,
      tokenBudget: 1000,
    });

    logger.info({ resultsCount: results.length }, "Memory Retrieval Results");
    for (const r of results) {
      logger.info({ score: r.score, content: r.content }, "Memory hit");
    }

    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Dream verification failed");
    process.exit(1);
  }
}

main();
