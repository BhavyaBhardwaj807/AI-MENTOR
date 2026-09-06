import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requireUserMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const setMock = vi.hoisted(() => vi.fn());
const whereMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/guards", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: updateMock,
  },
}));

describe("teacher invite API", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    updateMock.mockReset();
    setMock.mockReset();
    whereMock.mockReset();
    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: whereMock });
    whereMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns 404 when teacher signup is disabled", async () => {
    vi.stubEnv("TEACHER_SIGNUP_CODE", "");
    const { POST } = await import("../app/api/auth/teacher-invite/route");

    const response = await POST(new Request("http://localhost/api/auth/teacher-invite", {
      method: "POST",
      body: JSON.stringify({ code: "invite" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Teacher signup is not enabled");
    expect(requireUserMock).not.toHaveBeenCalled();
  });

  test("rejects invalid invite codes", async () => {
    vi.stubEnv("TEACHER_SIGNUP_CODE", "correct-code");
    requireUserMock.mockResolvedValue({ ok: true, user: { id: "user-1", role: "student" } });
    const { POST } = await import("../app/api/auth/teacher-invite/route");

    const response = await POST(new Request("http://localhost/api/auth/teacher-invite", {
      method: "POST",
      body: JSON.stringify({ code: "wrong-code" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Invalid teacher invite code");
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("upgrades the authenticated user with a valid invite code", async () => {
    vi.stubEnv("TEACHER_SIGNUP_CODE", "correct-code");
    requireUserMock.mockResolvedValue({ ok: true, user: { id: "user-1", role: "student" } });
    const { POST } = await import("../app/api/auth/teacher-invite/route");

    const response = await POST(new Request("http://localhost/api/auth/teacher-invite", {
      method: "POST",
      body: JSON.stringify({ code: "correct-code" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, role: "teacher" });
    expect(updateMock).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ role: "teacher" }));
    expect(whereMock).toHaveBeenCalledOnce();
  });
});
