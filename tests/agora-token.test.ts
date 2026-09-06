import { beforeEach, describe, expect, test, vi } from "vitest";

const createRtcTokenMock = vi.hoisted(() => vi.fn());
const requireMeetingAccessByIdMock = vi.hoisted(() => vi.fn());
const requireMeetingAccessByChannelMock = vi.hoisted(() => vi.fn());
const participantFindFirstMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const setMock = vi.hoisted(() => vi.fn());
const whereMock = vi.hoisted(() => vi.fn());
const redisMock = vi.hoisted(() => ({
  hset: vi.fn(),
  expire: vi.fn(),
}));

vi.mock("@/lib/agora", () => ({
  createRtcToken: createRtcTokenMock,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireMeetingAccessById: requireMeetingAccessByIdMock,
  requireMeetingAccessByChannel: requireMeetingAccessByChannelMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: updateMock,
    query: {
      sessionParticipants: {
        findFirst: participantFindFirstMock,
      },
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: redisMock,
}));

function request(body: unknown) {
  return new Request("http://localhost/api/agora/token", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Agora token API", () => {
  beforeEach(() => {
    vi.stubEnv("AGORA_APP_ID", "app-id");
    vi.stubEnv("AGORA_APP_CERTIFICATE", "app-cert");
    createRtcTokenMock.mockReset();
    requireMeetingAccessByIdMock.mockReset();
    requireMeetingAccessByChannelMock.mockReset();
    participantFindFirstMock.mockReset();
    updateMock.mockReset();
    setMock.mockReset();
    whereMock.mockReset();
    redisMock.hset.mockReset();
    redisMock.expire.mockReset();

    createRtcTokenMock.mockReturnValue("rtc-token");
    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: whereMock });
    whereMock.mockResolvedValue(undefined);
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
  });

  test("resolves the canonical Agora channel from a meeting id", async () => {
    requireMeetingAccessByIdMock.mockResolvedValue({
      ok: true,
      user: { id: "student-1", name: "Student One", role: "student" },
      classData: { id: "class-1", teacherId: "teacher-1" },
      meeting: {
        id: "meeting-1",
        classId: "class-1",
        agoraChannel: "agora_canonical",
        status: "live",
      },
    });
    participantFindFirstMock.mockResolvedValue({ agoraUid: "12345" });

    const { POST } = await import("../app/api/agora/token/route");
    const response = await POST(request({ meetingId: "meeting-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      appId: "app-id",
      channelName: "agora_canonical",
      token: "rtc-token",
      uid: 12345,
      sessionId: "meeting-1",
      classId: "class-1",
      role: "student",
      status: "live",
    });
    expect(requireMeetingAccessByIdMock).toHaveBeenCalledWith("meeting-1");
    expect(requireMeetingAccessByChannelMock).not.toHaveBeenCalled();
    expect(createRtcTokenMock).toHaveBeenCalledWith("agora_canonical", 12345, "app-id", "app-cert");
  });
});
