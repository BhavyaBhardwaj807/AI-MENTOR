export type CommandIntent = {
  isCommand: boolean;
  intent: "CREATE_QUIZ" | "NONE";
  args?: {
    topic?: string;
    questionCount?: number;
  };
};

export function parseQuizCommand(text: string): CommandIntent | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const asksForQuiz = /\b(create|generate|make|run|start|conduct|take|give|prepare|do)\b.*\b(quiz|test|questions?)\b/i.test(normalized)
    || /\b(quiz|test)\b.*\b(on|about|for|covering)\b/i.test(normalized);

  if (!asksForQuiz) return null;

  const topicMatch = normalized.match(/\b(?:on|about|for|covering)\s+(.+?)(?:[?.!]|$)/i);
  const questionCountMatch = normalized.match(/\b(\d{1,2})\s+(?:question|questions|quiz questions)\b/i);
  const topic = topicMatch?.[1]
    ?.replace(/^(a|an|the)\s+/i, "")
    .trim();

  return {
    isCommand: true,
    intent: "CREATE_QUIZ",
    args: {
      ...(topic ? { topic } : {}),
      ...(questionCountMatch ? { questionCount: Number(questionCountMatch[1]) } : {}),
    },
  };
}
