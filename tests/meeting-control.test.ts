import { beforeEach, describe, expect, test, vi } from "vitest";

const requireMeetingAccessByChannelMock = vi.hoisted(() => vi.fn());
const startAgentMock = vi.hoisted(() => vi.fn());
const stopAgentByIdMock = vi.hoisted(() => vi.fn());
const stopAllAgentsInChannelMock = vi.hoisted(() => vi.fn());
const startSttTaskMock = vi.hoisted(() => vi.fn());
const stopSttTaskMock = vi.hoisted(() => vi.fn());
const initLiveContextMock = vi.hoisted(() => vi.fn());
const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}));
const updateMock = vi.hoisted(() => vi.fn());
const setMock = vi.hoisted(() => vi.fn());
const whereMock = vi.hoisted(() => vi.fn());
const findFirstMock = vi.hoisted(() => vi.fn());
const dreamAddMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/guards", () => ({
  requireMeetingAccessByChannel: requireMeetingAccessByChannelMock,
}));

vi.mock("@/lib/agora-conversational-ai", () => ({
  startAgent: startAgentMock,
  stopAgentById: stopAgentByIdMock,
  stopAllAgentsInChannel: stopAllAgentsInChannelMock,
}));

vi.mock("@/lib/agora-stt", () => ({
  startSttTask: startSttTaskMock,
  stopSttTask: stopSttTaskMock,
}));

vi.mock("@/lib/brain/live-context", () => ({
  initLiveContext: initLiveContextMock,
}));

vi.mock("@/lib/redis", () => ({
  redis: redisMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: updateMock,
    query: {
      meetingSessions: {
        findFirst: findFirstMock,
      },
    },
  },
}));

vi.mock("@/lib/queue", () => ({
  dreamQueue: {
    add: dreamAddMock,
  },
}));

function request(body: unknown) {
  return new Request("http://localhost/api/meeting/control", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function ownedAccess(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    user: { id: "teacher-1", role: "teacher" },
    classData: { id: "class-1", teacherId: "teacher-1" },
    meeting: {
      id: "session-1",
      classId: "class-1",
      agoraChannel: "channel-1",
      status: "live",
      agoraAgentId: null,
      agoraSttAgentId: null,
      ...overrides,
    },
  };
}

describe("meeting control API", () => {
  beforeEach(() => {
    requireMeetingAccessByChannelMock.mockReset();
    startAgentMock.mockReset();
    stopAgentByIdMock.mockReset();
    stopAllAgentsInChannelMock.mockReset();
    startSttTaskMock.mockReset();
    stopSttTaskMock.mockReset();
    initLiveContextMock.mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockReset();
    redisMock.del.mockReset();
    updateMock.mockReset();
    setMock.mockReset();
    whereMock.mockReset();
    findFirstMock.mockReset();
    dreamAddMock.mockReset();

    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: whereMock });
    whereMock.mockResolvedValue(undefined);
    redisMock.del.mockResolvedValue(1);
  });

  test("returns conflict when an AI instructor start is already in progress", async () => {
    requireMeetingAccessByChannelMock.mockResolvedValue(ownedAccess({ status: "live" }));
    redisMock.set.mockResolvedValue(null);
    findFirstMock.mockResolvedValue({
      id: "session-1",
      classId: "class-1",
      status: "live",
      agoraAgentId: null,
      agoraSttAgentId: null,
    });

    const { POST } = await import("../app/api/meeting/control/route");
    const response = await POST(request({ action: "start", channelName: "channel-1" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("AI Instructor is already starting");
    expect(startAgentMock).not.toHaveBeenCalled();
    expect(startSttTaskMock).not.toHaveBeenCalled();
  });

  test("keeps the AI instructor active when STT startup fails", async () => {
    requireMeetingAccessByChannelMock.mockResolvedValue(ownedAccess({ status: "live" }));
    redisMock.set.mockResolvedValue("OK");
    redisMock.get.mockResolvedValue("lock-token");
    startAgentMock.mockResolvedValue({ agentId: "agent-1" });
    startSttTaskMock.mockRejectedValue(new Error("STT acquire token failed"));

    const { POST } = await import("../app/api/meeting/control/route");
    const response = await POST(request({ action: "start", channelName: "channel-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      agentId: "agent-1",
      sttStatus: "degraded",
      sttError: "STT acquire token failed",
      replacedAgent: false,
      sessionId: "session-1",
      classId: "class-1",
    });
    expect(stopAgentByIdMock).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      agoraAgentId: "agent-1",
      agoraSttAgentId: undefined,
      status: "live",
    }));
  });

  test("marks the meeting ended even when Agora cleanup fails", async () => {
    requireMeetingAccessByChannelMock.mockResolvedValue(ownedAccess({
      status: "live",
      agoraAgentId: "agent-1",
      agoraSttAgentId: "stt-1",
    }));
    redisMock.get.mockResolvedValue("builder-token");
    stopAgentByIdMock.mockRejectedValue(new Error("agent stop failed"));
    stopAllAgentsInChannelMock.mockResolvedValue(undefined);
    stopSttTaskMock.mockRejectedValue(new Error("stt stop failed"));
    dreamAddMock.mockResolvedValue(undefined);

    const { POST } = await import("../app/api/meeting/control/route");
    const response = await POST(request({ action: "stop", channelName: "channel-1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, sessionId: "session-1" });
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      agoraAgentId: null,
      agoraSttAgentId: null,
      status: "ended",
    }));
    expect(dreamAddMock).toHaveBeenCalledWith(
      "dream-memories",
      { sessionId: "session-1" },
      { jobId: "dream-session-1" },
    );
  });

  test("starts the AI instructor subscribed to the teacher rtc uid", async () => {
    requireMeetingAccessByChannelMock.mockResolvedValue(ownedAccess({ status: "live" }));
    redisMock.set.mockResolvedValue("OK");
    redisMock.get.mockResolvedValue("lock-token");
    startAgentMock.mockResolvedValue({ agentId: "agent-1" });
    startSttTaskMock.mockResolvedValue({ taskId: "stt-1", builderToken: "builder-token" });

    const { POST } = await import("../app/api/meeting/control/route");
    const response = await POST(request({
      action: "start",
      channelName: "channel-1",
      rtcUid: "582902169",
    }));

    expect(response.status).toBe(200);
    expect(startAgentMock).toHaveBeenCalledWith("channel-1", "session-1", ["582902169"]);
  });

  test("force start replaces a stored stale AI instructor", async () => {
    requireMeetingAccessByChannelMock.mockResolvedValue(ownedAccess({
      status: "live",
      agoraAgentId: "old-agent",
      agoraSttAgentId: null,
    }));
    redisMock.set.mockResolvedValue("OK");
    redisMock.get.mockResolvedValue("lock-token");
    findFirstMock.mockResolvedValue({
      id: "session-1",
      classId: "class-1",
      status: "live",
      agoraAgentId: "old-agent",
      agoraSttAgentId: null,
    });
    stopAgentByIdMock.mockResolvedValue(undefined);
    stopAllAgentsInChannelMock.mockResolvedValue(undefined);
    startAgentMock.mockResolvedValue({ agentId: "new-agent" });
    startSttTaskMock.mockResolvedValue({ taskId: "stt-1", builderToken: "builder-token" });

    const { POST } = await import("../app/api/meeting/control/route");
    const response = await POST(request({
      action: "start",
      channelName: "channel-1",
      rtcUid: "582902169",
      forceRestart: true,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.replacedAgent).toBe(true);
    expect(stopAgentByIdMock).toHaveBeenCalledWith("old-agent");
    expect(stopAllAgentsInChannelMock).toHaveBeenCalledWith("channel-1");
    expect(startAgentMock).toHaveBeenCalledWith("channel-1", "session-1", ["582902169"]);
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      agoraAgentId: "new-agent",
      agoraSttAgentId: "stt-1",
      status: "live",
    }));
  });
});
