export type SpeakingPolicyRole = "teacher" | "student" | "admin" | "unknown";
export type SpeakingPolicyCommand = "CREATE_QUIZ" | "NONE" | null | undefined;
export type SpeakingPolicyContext = {
  teacher_speaking?: boolean;
  confusion_signals?: Array<{ concept: string; count?: number }>;
  unanswered_questions?: Array<{ text: string }>;
  last_ai_spoke_at?: number;
};

export type SpeakingPolicyInput = {
  text: string;
  speakerRole: SpeakingPolicyRole;
  command: SpeakingPolicyCommand;
  context?: SpeakingPolicyContext | null;
  wakeWords?: string[];
  now?: number;
};

export type SpeakingPolicyDecision = {
  shouldSpeak: boolean;
  confidence: number;
  reason: "command" | "direct_address" | "direct_question" | "student_help" | "autonomous_context" | "low_confidence";
};

const DEFAULT_WAKE_WORDS = ["george", "mentor", "ai mentor"];
const COOLDOWN_MS = 8_000;
const MIN_CONFIDENCE_TO_SPEAK = 0.70;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function hasWakeWord(text: string, wakeWords: string[] = DEFAULT_WAKE_WORDS) {
  const normalized = text.toLowerCase();
  return wakeWords.some((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalized));
}

export function evaluateSpeakingPolicy(input: SpeakingPolicyInput): SpeakingPolicyDecision {
  const text = input.text.trim();
  const lower = text.toLowerCase();
  const context = input.context;
  const now = input.now ?? Date.now();

  if (!text) {
    return { shouldSpeak: false, confidence: 0, reason: "low_confidence" };
  }

  if (input.command && input.command !== "NONE") {
    return { shouldSpeak: true, confidence: 1, reason: "command" };
  }

  const addressed = hasWakeWord(text, input.wakeWords);
  const directQuestion = /\?(\s*)$/.test(text) || /\b(can|could|would|will|do|does|did|what|why|how|when|where|which)\b/i.test(text);
  const aiDirected =
    /\b(can|could|would|will)\s+(you|we)\b/i.test(text) ||
    /\b(please\s+)?(explain|answer|help|summarize|clarify|tell|show)\b/i.test(text);
  const studentHelp = input.speakerRole === "student" && /\b(i('| a)?m confused|i don'?t understand|help me|stuck|question)\b/i.test(lower);
  const likelyLecture =
    input.speakerRole === "teacher" &&
    /\b(today|now|next|remember|notice|class|students|let'?s|we are going to|we will)\b/i.test(lower) &&
    !addressed &&
    !aiDirected;
  const inCooldown = Boolean(context?.last_ai_spoke_at && now - context.last_ai_spoke_at < COOLDOWN_MS);

  let confidence = 0;
  if (addressed) confidence += 0.71; // Guarantees speaking if wake word used
  if (aiDirected) confidence += 0.2; // Reduced so it doesn't trigger just by asking a generic question without wake word
  if (directQuestion) confidence += 0.1;
  if (studentHelp) confidence += 0.3; 
  if (input.speakerRole === "teacher" || input.speakerRole === "admin") confidence += 0.05;
  if (input.speakerRole === "unknown") confidence -= 0.2; // Penalize unknown speakers heavily
  if (context?.teacher_speaking && input.speakerRole !== "teacher") confidence -= 0.4; // Don't interrupt teacher
  if (likelyLecture) confidence -= 0.5;
  if (inCooldown) confidence -= 0.5;

  const signalsArray = Array.isArray(context?.confusion_signals) ? context.confusion_signals : [];
  const hasAutonomousContext = Boolean(context?.unanswered_questions?.length || signalsArray.length);
  if (hasAutonomousContext && !context?.teacher_speaking && !inCooldown) confidence += 0.3; 

  confidence = clamp01(confidence);

  if (confidence >= MIN_CONFIDENCE_TO_SPEAK) {
    if (addressed) return { shouldSpeak: true, confidence, reason: "direct_address" };
    if (studentHelp) return { shouldSpeak: true, confidence, reason: "student_help" };
    if (hasAutonomousContext) return { shouldSpeak: true, confidence, reason: "autonomous_context" };
    return { shouldSpeak: true, confidence, reason: "direct_question" };
  }

  return { shouldSpeak: false, confidence, reason: "low_confidence" };
}
