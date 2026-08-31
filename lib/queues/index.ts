import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

// BullMQ requires a dedicated connection with maxRetriesPerRequest: null
// We reuse the global Redis singleton which is already configured correctly.

function makeQueue(name: string) {
  return new Queue(name, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}

// Lazy singletons — only created when first accessed
const globalForQueues = global as typeof globalThis & {
  queues?: Record<string, Queue>;
};

if (!globalForQueues.queues) {
  globalForQueues.queues = {};
}

function getQueue(name: string): Queue {
  if (!globalForQueues.queues![name]) {
    globalForQueues.queues![name] = makeQueue(name);
  }
  return globalForQueues.queues![name];
}

export const Queues = {
  EMBED_DOCUMENTS: "embed-documents",
  CLASSIFY_TURN: "classify-turn",
  DREAM_SESSION: "dream-session",
  UPDATE_AGENT_CONTEXT: "update-agent-context",
  INDEX_CLASSROOM_EPISODES: "index-classroom-episodes",
  GENERATE_REPORT: "generate-report",
} as const;

export function getEmbedQueue() {
  return getQueue(Queues.EMBED_DOCUMENTS);
}
export function getClassifyQueue() {
  return getQueue(Queues.CLASSIFY_TURN);
}
export function getDreamQueue() {
  return getQueue(Queues.DREAM_SESSION);
}
export function getUpdateAgentQueue() {
  return getQueue(Queues.UPDATE_AGENT_CONTEXT);
}
