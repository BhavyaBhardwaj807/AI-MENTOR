/**
 * workers/dream-memories.ts
 *
 * Worker for extracting long-term memories and learning events from 
 * a completed session's transcripts.
 */

import { Worker, Job } from "bullmq";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";
import { 
  transcriptSegments, 
  learningEvents, 
  studentMemories,
  meetingSessions,
  sessionParticipants
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { llmJsonCall } from "@/lib/llm";
import { LLM_DREAM_MODEL } from "@/lib/brain/config";
import { generateEmbedding } from "@/lib/embeddings";
import { qdrant, COLLECTIONS } from "@/lib/qdrant";
import { v4 as uuidv4 } from "uuid";
import { brainLog } from "@/lib/logger";
import { runQuery } from "@/lib/neo4j";

interface DreamJobData {
  sessionId: string;
}

interface ExtractedMemory {
  student_id: string; // The agoraUid or db userId
  concept: string;
  event_type: "mastery" | "confusion" | "partial" | "question" | "breakthrough";
  evidence: string;
  confidence: number;
}

export const dreamWorker = new Worker<DreamJobData>(
  "dream-memories",
  async (job: Job<DreamJobData>) => {
    const { sessionId } = job.data;
    const log = brainLog.child({ session_id: sessionId, worker: "dream" });
    log.info("Starting memory extraction (dreaming)");

    // 1. Fetch transcripts
    const transcripts = await db.query.transcriptSegments.findMany({
      where: eq(transcriptSegments.sessionId, sessionId),
      orderBy: (ts, { asc }) => [asc(ts.startedAtMs)],
    });

    if (transcripts.length === 0) {
      log.info("No transcripts found for session, aborting dream");
      return;
    }

    // Combine transcripts into a readable format for the LLM
    const dialogue = transcripts
      .map(t => `[${t.speakerRole}] (UID: ${t.speakerUid}): ${t.content}`)
      .join("\n");

    // We can chunk this if the dialogue is too long (left as exercise for production scale)
    // For now, assume it fits in context.
    
    // 2. Fetch session and class info
    const session = await db.query.meetingSessions.findFirst({
      where: eq(meetingSessions.id, sessionId),
    });
    
    if (!session) throw new Error("Session not found");

    // 3. Prompt LLM to extract memories
    try {
      const { parsed } = await llmJsonCall<{ memories: ExtractedMemory[] }>({
        model: LLM_DREAM_MODEL,
        messages: [
          {
            role: "system",
            content: `You are an educational data extractor. Read the following classroom transcript and identify long-term learning events for each student (by UID). 
Focus on:
1. "mastery" - clear evidence the student understands a concept.
2. "confusion" - the student is actively struggling with a concept.
3. "breakthrough" - the "aha" moment where confusion turns to mastery.

Respond ONLY with JSON matching this schema:
{
  "memories": [
    {
      "student_id": "string",
      "concept": "string",
      "event_type": "mastery" | "confusion" | "partial" | "question" | "breakthrough",
      "evidence": "string (exact quote or summary)",
      "confidence": 0.0-1.0
    }
  ]
}`
          },
          { role: "user", content: dialogue }
        ]
      });

      if (!parsed.memories || parsed.memories.length === 0) {
        log.info("No actionable memories extracted");
        return;
      }

      log.info({ extractedCount: parsed.memories.length }, "Extracted memories");

      // 4. Process each memory
      for (const mem of parsed.memories) {
        // Resolve student UID to database userId
        const participant = await db.query.sessionParticipants.findFirst({
          where: and(
            eq(sessionParticipants.sessionId, sessionId),
            eq(sessionParticipants.agoraUid, mem.student_id)
          )
        });

        // Fallback to storing by UID if we don't have a mapped user (e.g. anonymous joins)
        const studentIdToStore = participant ? participant.userId : mem.student_id;

        // Write to Postgres learningEvents
        await db.insert(learningEvents).values({
          sessionId,
          studentId: studentIdToStore,
          eventType: mem.event_type,
          evidence: mem.evidence,
          confidence: mem.confidence,
        });

        // Generate Memory Text for Vector DB
        const memoryText = `Student ${mem.student_id} showed ${mem.event_type} regarding '${mem.concept}'. Evidence: "${mem.evidence}"`;
        const qdrantPointId = uuidv4();
        
        let memoryType: "mastery" | "confusion" | "explanation_worked" | "explanation_failed" = "confusion";
        if (mem.event_type === "mastery") memoryType = "mastery";
        if (mem.event_type === "breakthrough") memoryType = "explanation_worked";

        // Write to Postgres studentMemories (Relational reference)
        await db.insert(studentMemories).values({
          studentId: studentIdToStore,
          classId: session.classId,
          memoryType,
          content: memoryText,
          confidence: mem.confidence,
          qdrantPointId,
        });

        // Embed and Upsert to Qdrant
        const vector = await generateEmbedding(memoryText);
        
        await qdrant.upsert(COLLECTIONS.STUDENT_MEMORIES, {
          wait: true,
          points: [
            {
              id: qdrantPointId,
              vector,
              payload: {
                student_id: studentIdToStore,
                class_id: session.classId,
                concept: mem.concept,
                event_type: mem.event_type,
                content: memoryText,
              }
            }
          ]
        });

        // Write to Neo4j
        const relType = mem.event_type === "mastery" || mem.event_type === "breakthrough" ? "MASTERED" : "WEAK_ON";
        const cypher = `
          MERGE (s:Student {id: $studentId})
          MERGE (c:Concept {name: $concept, classId: $classId})
          MERGE (s)-[r:${relType}]->(c)
          SET r.confidence = $confidence, r.updatedAt = timestamp()
        `;
        
        try {
          await runQuery(cypher, {
            studentId: studentIdToStore,
            concept: mem.concept,
            classId: session.classId,
            confidence: mem.confidence,
          });
        } catch (err) {
          log.error({ err }, "Failed to write memory to Neo4j");
        }
      }

      log.info("Dreaming complete, memories persisted");

    } catch (err) {
      log.error({ err }, "Failed to extract or persist memories");
      throw err;
    }
  },
  { connection: redis, concurrency: 1 }
);
