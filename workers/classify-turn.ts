/**
 * workers/classify-turn.ts
 *
 * Worker for classifying user turns in a live meeting.
 * Extracts intent, concepts, and confusion signals using the LLM.
 */

import { Worker, Job } from "bullmq";
import { redis } from "@/lib/redis";
import { llmJsonCall } from "@/lib/llm";
import { LLM_CLASSIFY_MODEL } from "@/lib/brain/config";
import { log as logger } from "@/lib/logger";

interface ClassifyJobData {
  sessionId: string;
  uid: string;
  role: "teacher" | "student" | "ai";
  text: string;
  timestamp: number;
}

interface ClassificationResult {
  intent: "factual" | "conceptual" | "confusion" | "command" | "chitchat";
  concepts: string[];
  is_confused: boolean;
  confusion_reason?: string;
}

export const classifyWorker = new Worker<ClassifyJobData>(
  "classify-turn",
  async (job: Job<ClassifyJobData>) => {
    const { sessionId, uid, role, text } = job.data;
    
    // Only classify student turns for confusion
    if (role !== "student" || text.length < 10) {
      return;
    }

    try {
      const { parsed } = await llmJsonCall<ClassificationResult>({
        model: LLM_CLASSIFY_MODEL,
        messages: [
          {
            role: "system",
            content: `Analyze the student's speech. Extract the intent, any academic concepts mentioned, and determine if the student is confused.
Respond with JSON matching this schema:
{
  "intent": "factual" | "conceptual" | "confusion" | "command" | "chitchat",
  "concepts": ["string"],
  "is_confused": boolean,
  "confusion_reason": "string (optional)"
}`
          },
          { role: "user", content: text }
        ]
      });

      if (parsed.is_confused && parsed.concepts.length > 0) {
        logger.info({ sessionId, uid, concepts: parsed.concepts }, "Detected student confusion");
        
        // Update live context in Redis with confusion signal
        const key = `classroom:${sessionId}:context`;
        
        const script = `
          local ctx = redis.call("GET", KEYS[1])
          if not ctx then return nil end
          local parsed = cjson.decode(ctx)
          
          if not parsed.confusion_signals then
            parsed.confusion_signals = {}
          end
          
          -- Add confusion signal for the first concept
          local concept = ARGV[1]
          local found = false
          for i, signal in ipairs(parsed.confusion_signals) do
            if signal.concept == concept then
              signal.count = signal.count + 1
              found = true
              break
            end
          end
          
          if not found then
            table.insert(parsed.confusion_signals, { concept = concept, count = 1 })
          end
          
          local new_ctx = cjson.encode(parsed)
          redis.call("SETEX", KEYS[1], 14400, new_ctx)
          return new_ctx
        `;

        await redis.eval(script, 1, key, parsed.concepts[0]);
      }

    } catch (err) {
      logger.error({ err, text }, "Failed to classify turn");
    }
  },
  { connection: redis, concurrency: 5 }
);
