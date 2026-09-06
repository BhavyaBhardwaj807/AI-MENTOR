import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

function makeRequest(path: string) {
  return new NextRequest(new URL(path, "http://localhost"));
}

describe("protected route proxy", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  test("redirects unauthenticated teacher pages to login with next path", async () => {
    getSessionMock.mockResolvedValue(null);
    const { proxy } = await import("../proxy");

    const response = await proxy(makeRequest("/teacher/dashboard?tab=classes"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fteacher%2Fdashboard%3Ftab%3Dclasses",
    );
  });

  test("redirects students away from teacher pages", async () => {
    getSessionMock.mockResolvedValue({ user: { role: "student" } });
    const { proxy } = await import("../proxy");

    const response = await proxy(makeRequest("/teacher/meetings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/student/dashboard");
  });

  test("redirects teachers away from student pages", async () => {
    getSessionMock.mockResolvedValue({ user: { role: "teacher" } });
    const { proxy } = await import("../proxy");

    const response = await proxy(makeRequest("/student/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/teacher/dashboard");
  });

  test("redirects authenticated users away from login", async () => {
    getSessionMock.mockResolvedValue({ user: { role: "teacher" } });
    const { proxy } = await import("../proxy");

    const response = await proxy(makeRequest("/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/teacher/dashboard");
  });

  test("allows authenticated meeting pages through", async () => {
    getSessionMock.mockResolvedValue({ user: { role: "student" } });
    const { proxy } = await import("../proxy");

    const response = await proxy(makeRequest("/meeting/session-123"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
