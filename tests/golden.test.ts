import { expect, test } from "vitest";

test("Golden eval dataset exists", async () => {
  const data = await import("./fixtures/golden-eval.json");
  expect(data.default.length).toBeGreaterThan(0);
});
