import { describe, expect, test } from "vitest";
import { parseQuizCommand } from "../lib/brain/quiz-command";

describe("brain quiz command parser", () => {
  test("recognizes teacher voice requests to run a quiz", () => {
    expect(parseQuizCommand("Okay. Can you take a quiz on physics?")).toEqual({
      isCommand: true,
      intent: "CREATE_QUIZ",
      args: {
        topic: "physics",
      },
    });
  });

  test("ignores generic quiz discussion", () => {
    expect(parseQuizCommand("I have a question about yesterday's quiz score.")).toBeNull();
  });
});
