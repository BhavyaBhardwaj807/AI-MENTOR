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

  test("upgrades the authenticated user to teacher", async () => {
    requireUserMock.mockResolvedValue({ ok: true, user: { id: "user-1", role: "student" } });
    const { POST } = await import("../app/api/auth/teacher-invite/route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, role: "teacher" });
    expect(updateMock).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ role: "teacher" }));
    expect(whereMock).toHaveBeenCalledOnce();
  });
});
