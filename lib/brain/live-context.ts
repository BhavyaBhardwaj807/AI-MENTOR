/**
 * lib/brain/live-context.ts
 *
 * Manages the live classroom context in Redis.
 */

import { redis } from "@/lib/redis";
import { ClassroomContext, RecentUtterance } from "./types";
import { classifyQueue } from "@/lib/queue";

const MAX_RECENT_UTTERANCES = 15;
const CONTEXT_TTL = 3600 * 4; // 4 hours

function getContextKey(sessionId: string) {
  return `classroom:${sessionId}:context`;
}

export async function getLiveContext(sessionId: string): Promise<ClassroomContext | null> {
  const data = await redis.get(getContextKey(sessionId));
  if (!data) return null;
  return JSON.parse(data) as ClassroomContext;
}

export async function initLiveContext(sessionId: string, classId: string) {
  const ctx: ClassroomContext = {
    session_id: sessionId,
    class_id: classId,
    teacher_speaking: false,
    active_student_uids: [],
    intervention_score: 0,
    confusion_signals: [],
    unanswered_questions: [],
    recent_utterances: [],
  };
  await redis.set(getContextKey(sessionId), JSON.stringify(ctx), "EX", CONTEXT_TTL);
}

export async function addTranscriptSegment(
  sessionId: string,
  uid: string,
  role: "teacher" | "student" | "ai",
  text: string,
  isFinal: boolean
) {
  const key = getContextKey(sessionId);
  
  // Script to safely update the recent_utterances list in Redis
  const script = `
    local ctx = redis.call("GET", KEYS[1])
    if not ctx then return nil end
    local parsed = cjson.decode(ctx)
    
    local utterance = {
      uid = ARGV[1],
      role = ARGV[2],
      text = ARGV[3],
      timestamp = tonumber(ARGV[4])
    }
    
    if ARGV[5] == "true" then
      table.insert(parsed.recent_utterances, utterance)
      if #parsed.recent_utterances > tonumber(ARGV[6]) then
        table.remove(parsed.recent_utterances, 1)
      end
    end
    
    if ARGV[2] == "teacher" then
      parsed.teacher_speaking = true
      parsed.teacher_uid = ARGV[1]
    else
      parsed.teacher_speaking = false
    end
    
    local new_ctx = cjson.encode(parsed)
    redis.call("SETEX", KEYS[1], tonumber(ARGV[7]), new_ctx)
    return new_ctx
  `;

  await redis.eval(
    script,
    1,
    key,
    uid,
    role,
    text,
    Date.now().toString(),
    isFinal ? "true" : "false",
    MAX_RECENT_UTTERANCES.toString(),
    CONTEXT_TTL.toString()
  );

  // If final, send to classify worker to extract concepts/confusion
  if (isFinal) {
    await classifyQueue.add(
      "classify-turn",
      { sessionId, uid, role, text, timestamp: Date.now() },
      { removeOnComplete: true, removeOnFail: 100 }
    );
  }
}
