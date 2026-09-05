/**
 * workers/intervention-engine.ts
 *
 * Scans active sessions and triggers the AI Mentor to speak
 * when learning opportunities (confusion, unanswered questions)
 * coincide with conversational pauses.
 */

import { getActiveSessions, getLiveContext, setLastAiSpokeAt } from "@/lib/brain/live-context";
import { injectPrompt } from "@/lib/agora-conversational-ai";
import { db } from "@/lib/db";
import { meetingSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { brainLog } from "@/lib/logger";

const INTERVENTION_INTERVAL_MS = 3000;
const COOLDOWN_MS = 30000;

export async function startInterventionEngine() {
  brainLog.info("[InterventionEngine] Starting background loop");

  setInterval(async () => {
    try {
      const activeSessions = await getActiveSessions();

      for (const sessionId of activeSessions) {
        const ctx = await getLiveContext(sessionId);
        if (!ctx) continue;

        // Condition 1: Teacher is not speaking
        if (ctx.teacher_speaking) continue;

        // Condition 2: Cooldown has passed
        const lastSpoke = ctx.last_ai_spoke_at || 0;
        if (Date.now() - lastSpoke < COOLDOWN_MS) continue;

        // Condition 3: There is something to address
        const hasConfusion = ctx.confusion_signals && ctx.confusion_signals.length > 0;
        const hasQuestion = ctx.unanswered_questions && ctx.unanswered_questions.length > 0;

        if (!hasConfusion && !hasQuestion) continue;

        // We have an intervention opportunity!
        // Find the agent ID for this session
        const sessionRecord = await db.query.meetingSessions.findFirst({
          where: eq(meetingSessions.id, sessionId),
        });

        if (!sessionRecord || !sessionRecord.agoraAgentId) {
          continue;
        }

        // Build the synthetic prompt
        let prompt = "";
        if (hasQuestion) {
          const q = ctx.unanswered_questions[0];
          prompt = `[SYSTEM MESSAGE: A student asked: "${q.text}". The teacher has finished speaking. Please answer the student concisely.]`;
          // Note: In a real system we would pop the question from the Redis context here
        } else if (hasConfusion) {
          const c = ctx.confusion_signals[0];
          prompt = `[SYSTEM MESSAGE: Students seem confused about "${c.concept}". The teacher has paused. Please briefly clarify this concept.]`;
          // Note: In a real system we would clear or decay the confusion signal here
        }

        brainLog.info({ sessionId, prompt }, "[InterventionEngine] Triggering AI intervention");

        // Inject the prompt into the running Agent
        await injectPrompt(sessionRecord.agoraAgentId, prompt);

        // Update the cooldown state
        await setLastAiSpokeAt(sessionId);
      }
    } catch (err) {
      brainLog.error({ err }, "[InterventionEngine] Error in loop");
    }
  }, INTERVENTION_INTERVAL_MS);
}
