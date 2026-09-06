/**
 * scripts/e2e-pipeline.ts
 *
 * Full End-to-End Test for the AI-MENTOR Backend.
 * Requires the Next.js server to be running (npm run dev).
 */

import { v4 as uuidv4 } from "uuid";
import { brainLog as logger } from "../lib/logger";

const API_BASE = "http://localhost:3000/api";
const brainSecret = process.env.BRAIN_SERVER_SECRET;
const sttSecret = process.env.AGORA_STT_WEBHOOK_SECRET;

async function main() {
  if (!brainSecret) {
    throw new Error("BRAIN_SERVER_SECRET must be set to run scripts/e2e-pipeline.ts");
  }
  if (!sttSecret) {
    throw new Error("AGORA_STT_WEBHOOK_SECRET must be set to run scripts/e2e-pipeline.ts");
  }

  logger.info("Starting E2E Pipeline Test...");

  const sessionId = uuidv4();
  const studentUid = uuidv4();

  // 1. Simulate STT Webhook
  logger.info("1. Simulating STT Webhook (Student speaks)");
  const webhookBody = {
    eventType: 3,
    payload: {
      taskId: "test-stt-task",
      channelName: sessionId,
      sequence: 1,
      recognizeResult: {
        uid: studentUid,
        streamId: 1,
        words: [
          { text: "What", startMs: 0, durationMs: 100, isFinal: false },
          { text: "is", startMs: 100, durationMs: 100, isFinal: false },
          { text: "velocity?", startMs: 200, durationMs: 200, isFinal: true }
        ]
      }
    }
  };

  const sttRes = await fetch(`${API_BASE}/webhooks/agora/stt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sttSecret}`,
    },
    body: JSON.stringify(webhookBody),
  });

  if (!sttRes.ok) {
    logger.error(`STT Webhook failed: ${sttRes.status}`);
  } else {
    logger.info("STT Webhook processed successfully");
  }

  // Wait a second for Redis to update
  await new Promise(r => setTimeout(r, 1000));

  // 2. Simulate Brain Chat Request (Conversational AI Agent)
  logger.info("2. Simulating Brain Chat Request");
  const chatBody = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `[SESSION:${sessionId}] You are an AI Mentor.` },
      { role: "user", content: "What is velocity?", metadata: { user: studentUid } }
    ],
    stream: true,
  };

  try {
    const chatRes = await fetch(`${API_BASE}/brain/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${brainSecret}`,
      },
      body: JSON.stringify(chatBody),
    });

    if (!chatRes.ok) {
      logger.error(`Brain Chat failed: ${chatRes.status}`);
      const errText = await chatRes.text();
      logger.error(`Response: ${errText}`);
    } else {
      logger.info("Brain Chat started streaming...");
      // Read the stream
      const reader = chatRes.body?.getReader();
      const dec = new TextDecoder();
      let streamOutput = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value);
        streamOutput += chunk;
      }

      logger.info("Stream read complete.");
      if (streamOutput.includes("[DONE]")) {
        logger.info("Brain Chat successfully responded via SSE.");
      } else {
        logger.warn("Stream may have ended unexpectedly.");
      }
    }
  } catch (err) {
    logger.error({ err }, "Brain Chat fetch threw an error");
  }

  logger.info("E2E Pipeline Test Finished.");
}

main();
