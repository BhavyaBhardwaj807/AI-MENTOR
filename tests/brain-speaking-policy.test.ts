import { describe, expect, test } from "vitest";
import { evaluateSpeakingPolicy } from "../lib/brain/speaking-policy";

describe("brain speaking policy", () => {
  test("does not answer ordinary teacher lecture speech", () => {
    const decision = evaluateSpeakingPolicy({
      text: "Today we are going to talk about MongoDB indexes and query planning.",
      speakerRole: "teacher",
      command: null,
      context: { teacher_speaking: true, confusion_signals: [], unanswered_questions: [] },
      now: 1_000,
    });

    expect(decision.shouldSpeak).toBe(false);
    expect(decision.reason).toBe("low_confidence");
  });

  test("answers direct wake-word requests", () => {
    const decision = evaluateSpeakingPolicy({
      text: "George, can you explain MongoDB indexes?",
      speakerRole: "teacher",
      command: null,
      context: { teacher_speaking: true, confusion_signals: [], unanswered_questions: [] },
      now: 1_000,
    });

    expect(decision.shouldSpeak).toBe(true);
    expect(decision.reason).toBe("direct_address");
  });

  test("always allows teacher commands", () => {
    const decision = evaluateSpeakingPolicy({
      text: "Can we have a quiz on MongoDB?",
      speakerRole: "teacher",
      command: "CREATE_QUIZ",
      context: { teacher_speaking: true, confusion_signals: [], unanswered_questions: [] },
      now: 1_000,
    });

    expect(decision.shouldSpeak).toBe(true);
    expect(decision.confidence).toBe(1);
  });
});
