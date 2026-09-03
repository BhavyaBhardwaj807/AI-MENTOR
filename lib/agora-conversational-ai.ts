import { RtcTokenBuilder, RtcRole } from "agora-token";

const BASE_URL = "https://api.agora.io/api/conversational-ai-agent/v2";
const TOKEN_TTL = 3600;

function basicAuth(key: string, secret: string) {
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

function agentToken(appId: string, appCertificate: string, channelName: string, uid: number) {
  return RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, RtcRole.PUBLISHER, TOKEN_TTL, TOKEN_TTL);
}

export async function startAgent(channelName: string): Promise<{ agentId: string }> {
  const appId = process.env.AGORA_APP_ID!;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;
  const pipelineId = process.env.AGORA_AGENT_PIPELINE_ID!;
  const agentUid = parseInt(process.env.AGORA_AI_AGENT_UID || "999999", 10);
  const avatarUid = parseInt(process.env.AGORA_AVATAR_UID || "999998", 10);
  const avatarId = process.env.AGORA_AVATAR_ID;
  const liveAvatarApiKey = process.env.LIVEAVATAR_API_KEY;
  const avatarEnabled = !!(avatarId && liveAvatarApiKey);

  const token = agentToken(appId, appCertificate, channelName, agentUid);
  const avatarToken = avatarEnabled ? agentToken(appId, appCertificate, channelName, avatarUid) : null;

  console.log("[Avatar:backend] --- TOKEN VERIFICATION ---");
  console.log("[Avatar:backend] appId         :", appId);
  console.log("[Avatar:backend] channelName   :", channelName);
  console.log("[Avatar:backend] agentUid      :", agentUid, "(type:", typeof agentUid, ")");
  console.log("[Avatar:backend] avatarUid     :", avatarUid, "(type:", typeof avatarUid, ")");
  console.log("[Avatar:backend] uids_distinct :", agentUid !== avatarUid);
  console.log("[Avatar:backend] agent_token   :", token ? token.slice(0, 16) + "...[redacted]" : "MISSING");
  console.log("[Avatar:backend] avatar_token  :", avatarToken ? avatarToken.slice(0, 16) + "...[redacted]" : "MISSING");
  console.log("[Avatar:backend] avatar_enabled:", avatarEnabled);
  console.log("[Avatar:backend] avatar_id     :", avatarId ? avatarId.slice(0, 8) + "...[redacted]" : "MISSING");
  console.log("[Avatar:backend] api_key       :", liveAvatarApiKey ? liveAvatarApiKey.slice(0, 8) + "...[redacted]" : "MISSING");

  const avatarBlock = avatarEnabled ? {
    enable: true,
    vendor: "liveavatar",
    params: {
      api_key: liveAvatarApiKey,
      avatar_id: avatarId,
      quality: "medium",
      agora_uid: String(avatarUid),
      agora_token: avatarToken,
      disable_idle_timeout: false,
      activity_idle_timeout: 60,
    },
  } : undefined;

  const body = {
    name: `mentor-${Date.now()}`,
    pipeline_id: pipelineId,
    properties: {
      channel: channelName,
      token,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: ["0"],
      idle_timeout: 120,
    },
    ...(avatarBlock ? { avatar: avatarBlock } : {}),
  };

  console.log("[Avatar:backend] --- PAYLOAD VERIFICATION ---");
  console.log("[Avatar:backend] channelName    :", channelName);
  console.log("[Avatar:backend] agentUid       :", agentUid);
  console.log("[Avatar:backend] avatarUid      :", avatarUid);
  console.log("[Avatar:backend] uids_distinct  :", agentUid !== avatarUid);
  console.log("[Avatar:backend] avatar_enabled :", avatarEnabled);
  console.log("[Avatar:backend] avatar_id      :", avatarId ? avatarId.slice(0, 8) + "...[redacted]" : "MISSING");
  console.log("[Avatar:backend] quality        : medium");
  console.log("[Avatar:backend] avatar_token   :", avatarToken ? "present for uid=" + avatarUid : "MISSING");
  console.log("[Avatar:backend] api_key        :", liveAvatarApiKey ? "present (" + liveAvatarApiKey.slice(0, 4) + "...[redacted])" : "MISSING");
  console.log("[Avatar:backend] avatar_at_top  : true");

  const endpoint = `${BASE_URL}/projects/${appId}/join`;
  console.log("[Avatar:backend] --- JOIN REQUEST ---");
  console.log("[Avatar:backend] endpoint      :", endpoint);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuth(restKey, restSecret) },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  console.log("[Avatar:backend] --- JOIN RESPONSE ---");
  console.log("[Avatar:backend] http_status   :", res.status);
  console.log("[Avatar:backend] agent_id      :", data.agent_id ?? "MISSING");
  console.log("[Avatar:backend] status        :", data.status ?? "MISSING");
  console.log("[Avatar:backend] full_response :", JSON.stringify(data));

  if (!res.ok) throw new Error(`Agora agent start failed (${res.status}): ${JSON.stringify(data)}`);

  return { agentId: data.agent_id };
}

export async function stopAgentById(agentId: string): Promise<void> {
  const appId = process.env.AGORA_APP_ID!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;
  const res = await fetch(`${BASE_URL}/projects/${appId}/agents/${agentId}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuth(restKey, restSecret) },
    body: "{}",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn(`[AI] stopAgentById ${agentId} failed (${res.status}):`, JSON.stringify(data));
  }
}

export async function stopAllAgentsInChannel(channelName: string): Promise<void> {
  const appId = process.env.AGORA_APP_ID!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;
  const res = await fetch(`${BASE_URL}/projects/${appId}/agents?channel=${encodeURIComponent(channelName)}`, {
    method: "GET",
    headers: { Authorization: basicAuth(restKey, restSecret) },
  });
  if (!res.ok) { console.warn("[AI] Could not list agents for channel", channelName, res.status); return; }
  const data = await res.json().catch(() => ({}));
  // Agora may return agents under different keys depending on API version
  const raw = data.agents ?? data.data ?? data.list ?? data;
  const agents: { agent_id: string; status?: string }[] = Array.isArray(raw) ? raw : [];
  console.log("[AI] list agents raw response:", JSON.stringify(data));
  const running = agents.filter((a) => !a.status || a.status === "RUNNING");
  console.log(`[AI] Found ${running.length} running agent(s) in channel ${channelName}, stopping`);
  await Promise.all(running.map((a) => stopAgentById(a.agent_id)));
}
