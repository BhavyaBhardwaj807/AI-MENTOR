import { expect, test } from "vitest";
import { assembleContext } from "../lib/brain/context-assembler";
import { CourseRetrievalAdapter } from "../lib/retrieval/course-adapter";

test("CourseRetrievalAdapter has correct name and type", () => {
  const adapter = new CourseRetrievalAdapter();
  expect(adapter.name).toBe("CourseMaterialAdapter");
  expect(adapter.sourceType).toBe("course");
});

test("Context assembler returns empty gracefully when no classId is provided", async () => {
  const result = await assembleContext("What is force?", {
    classId: "", // Empty class ID should skip retrieval
    maxResults: 5,
    scoreThreshold: 0.5,
    tokenBudget: 1000,
  });

  expect(result.results.length).toBe(0);
  expect(result.text).toBe("No relevant context found.");
});
