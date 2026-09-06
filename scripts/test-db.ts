/**
 * scripts/test-db.ts
 *
 * Verifies that the database schema is working by creating a test user,
 * class, and session. We will use this to test our APIs.
 */

import { db } from "../lib/db";
import { user, classes, meetingSessions } from "../lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { brainLog as logger } from "../lib/logger";

async function main() {
  logger.info("Starting DB verification...");

  try {
    // 1. Create a Teacher
    const teacherId = uuidv4();
    await db.insert(user).values({
      id: teacherId,
      name: "Test Teacher",
      email: `teacher_${Date.now()}@test.com`,
      emailVerified: true,
      role: "teacher",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    logger.info({ teacherId }, "Teacher created");

    // 2. Create a Class
    const [cls] = await db.insert(classes).values({
      name: "Physics 101 (Test)",
      subject: "Physics",
      teacherId,
    }).returning();
    logger.info({ classId: cls.id }, "Class created");

    // 3. Create a Session
    const [session] = await db.insert(meetingSessions).values({
      classId: cls.id,
      agoraChannel: `test_channel_${Date.now()}`,
      topic: "Newton's Laws",
      status: "pending",
    }).returning();
    logger.info({ sessionId: session.id }, "Session created");

    logger.info("DB verification successful!");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "DB verification failed");
    process.exit(1);
  }
}

main();
