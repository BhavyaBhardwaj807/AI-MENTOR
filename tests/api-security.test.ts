import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/brain/live-context", () => ({ addTranscriptSegment: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  sttLog: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("legacy Agora agent endpoints", () => {
  test("start endpoint is deprecated", async () => {
    const { POST } = await import("../app/api/agora/agent/start/route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain("/api/meeting/control");
  });

  test("stop endpoint is deprecated", async () => {
    const { POST } = await import("../app/api/agora/agent/stop/route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toContain("/api/meeting/control");
  });
});

describe("Agora STT webhook security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("rejects requests without the shared webhook secret when one is configured", async () => {
    vi.stubEnv("AGORA_STT_WEBHOOK_SECRET", "test-secret");
    const { POST } = await import("../app/api/webhooks/agora/stt/route");

    const response = await POST(new Request("http://localhost/api/webhooks/agora/stt", {
      method: "POST",
      body: JSON.stringify({ eventType: 3 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});
