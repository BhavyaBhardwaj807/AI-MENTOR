/**
 * lib/queue/index.ts
 *
 * BullMQ queues setup.
 */

import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const embedQueue = new Queue("embed-documents", {
  connection: redis,
});

export const classifyQueue = new Queue("classify-turn", {
  connection: redis,
});

export const dreamQueue = new Queue("dream-memories", {
  connection: redis,
});
