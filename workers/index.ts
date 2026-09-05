/**
 * workers/index.ts
 *
 * Entry point for starting all background workers.
 * Run this in a separate process in production.
 */

import "dotenv/config";
import { brainLog as logger } from "@/lib/logger";
import { embedWorker } from "./embed-documents";
import { classifyWorker } from "./classify-turn";
import { dreamWorker } from "./dream-memories";
import { startInterventionEngine } from "./intervention-engine";

logger.info("Starting background workers...");
startInterventionEngine();

embedWorker.on("ready", () => {
  logger.info("Embed worker ready");
});

embedWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Embed Job failed");
});

classifyWorker.on("ready", () => {
  logger.info("Classify worker ready");
});

classifyWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Classify Job failed");
});

dreamWorker.on("ready", () => {
  logger.info("Dream worker ready");
});

dreamWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Dream Job failed");
});

const gracefulShutdown = async () => {
  logger.info("Shutting down workers...");
  await Promise.all([
    embedWorker.close(), 
    classifyWorker.close(),
    dreamWorker.close()
  ]);
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
