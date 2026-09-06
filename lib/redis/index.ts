import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Global singleton — reuse across hot-reloads in dev
const globalForRedis = global as typeof globalThis & { redis?: Redis };

function createRedis() {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    // During `next build` there is no Redis — suppress the noise
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    console.error("[Redis] connection error:", err.message);
  });

  return client;
}

export const redis: Redis =
  globalForRedis.redis ?? (globalForRedis.redis = createRedis());
