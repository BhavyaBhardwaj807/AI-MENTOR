/**
 * workers/embed-documents.ts
 *
 * Worker for processing uploaded course materials.
 * 1. Extracts text from file.
 * 2. Chunks text.
 * 3. Generates embeddings.
 * 4. Upserts to Qdrant.
 */

import { Worker, Job } from "bullmq";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";
import { courseMaterials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { storage } from "@/lib/storage";
import { extractText } from "@/lib/ingest/extractors";
import { chunkText } from "@/lib/ingest/chunker";
import { generateEmbeddingsBatch } from "@/lib/embeddings";
import { qdrant, COLLECTIONS } from "@/lib/qdrant";
import { v4 as uuidv4 } from "uuid";
import { log as logger } from "@/lib/logger";

interface EmbedJobData {
  materialId: string;
}

export const embedWorker = new Worker<EmbedJobData>(
  "embed-documents",
  async (job: Job<EmbedJobData>) => {
    const { materialId } = job.data;
    logger.info({ materialId }, "Starting embed job");

    // 1. Fetch material record
    const material = await db.query.courseMaterials.findFirst({
      where: eq(courseMaterials.id, materialId),
    });

    if (!material) {
      throw new Error(`Material ${materialId} not found`);
    }

    try {
      await db
        .update(courseMaterials)
        .set({ embedStatus: "processing" })
        .where(eq(courseMaterials.id, materialId));

      // 2. Read file
      const buffer = await storage.read(material.storagePath);

      // 3. Extract text
      const text = await extractText(buffer, material.mimeType);

      // 4. Chunk
      const chunks = chunkText(text);
      if (chunks.length === 0) {
        throw new Error("No text extracted");
      }

      // 5. Generate Embeddings in batches of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const embeddings = await generateEmbeddingsBatch(batch.map(c => c.text));

        // 6. Upsert to Qdrant
        const points = batch.map((chunk, idx) => ({
          id: uuidv4(),
          vector: embeddings[idx],
          payload: {
            material_id: materialId,
            class_id: material.classId,
            content: chunk.text,
            chunk_index: chunk.index,
            source: material.fileName,
          },
        }));

        await qdrant.upsert(COLLECTIONS.COURSE_KNOWLEDGE, {
          wait: true,
          points,
        });
      }

      await db
        .update(courseMaterials)
        .set({
          embedStatus: "done",
          chunkCount: chunks.length,
        })
        .where(eq(courseMaterials.id, materialId));

      logger.info({ materialId, chunks: chunks.length }, "Embed job complete");

    } catch (err) {
      logger.error({ materialId, err }, "Embed job failed");
      await db
        .update(courseMaterials)
        .set({ embedStatus: "failed" })
        .where(eq(courseMaterials.id, materialId));
      throw err;
    }
  },
  { connection: redis, concurrency: 2 }
);
