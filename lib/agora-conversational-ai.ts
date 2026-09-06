import { RtcTokenBuilder, RtcRole } from "agora-token";

const BASE_URL = "https://api.agora.io/api/conversational-ai-agent/v2";
const TOKEN_TTL = 3600;

function basicAuth(key: string, secret: string) {
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

function agentToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
) {
  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    TOKEN_TTL,
    TOKEN_TTL,
  );
}

export async function startAgent(
  channelName: string,
  sessionId?: string,
  remoteRtcUids: string[] = ["*"],
): Promise<{ agentId: string }> {
  const appId = process.env.AGORA_APP_ID!;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;
  const agentUid = parseInt(process.env.AGORA_AI_AGENT_UID || "999999", 10);

  // LLM — routed through our Brain Server
  // The brain server speaks the OpenAI Chat Completions SSE protocol,
  // so Agora treats it identically to a direct LLM provider.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const llmUrl = `${appUrl}/api/brain/chat`;
  const llmApiKey = process.env.BRAIN_SERVER_SECRET || "";
  const llmModel = process.env.LLM_MODEL || "gpt-4o-mini";

  // TTS — Agora managed mode (MiniMax) — no TTS API key required
  // Falls back to BYOK OpenAI TTS if TTS_API_KEY (or LLM_API_KEY) is set
  const ttsApiKey = process.env.TTS_API_KEY || process.env.LLM_API_KEY;
  const useByokTts = Boolean(ttsApiKey);

  const token = agentToken(appId, appCertificate, channelName, agentUid);
  if (!llmApiKey) {
    throw new Error("BRAIN_SERVER_SECRET must be configured before starting the AI Mentor.");
  }

  console.log("[Agent:backend] --- CONFIG ---");
  console.log("[Agent:backend] appId        :", appId);
  console.log("[Agent:backend] channelName  :", channelName);
  console.log("[Agent:backend] agentUid     :", agentUid);
  console.log("[Agent:backend] remoteUids   :", remoteRtcUids.join(","));
  console.log("[Agent:backend] llmUrl       :", llmUrl);
  console.log("[Agent:backend] llmModel     :", llmModel);
  console.log("[Agent:backend] tts mode     :", useByokTts ? "byok (openai)" : "managed (minimax)");
  console.log("[Agent:backend] llmApiKey    :", llmApiKey ? llmApiKey.slice(0, 8) + "...[redacted]" : "MISSING");

  // TTS block — managed (free, no key) or BYOK if TTS_API_KEY is set
  const ttsBlock = useByokTts
    ? {
        vendor: "openai" as const,
        params: {
          url: "https://api.aicredits.in/v1/audio/speech",
          api_key: ttsApiKey,
          model: "openai/tts-1",
          voice: process.env.TTS_VOICE || "alloy",
        },
      }
    : {
        // Agora managed MiniMax TTS — no API key needed, covered by Agora's plan
        credential_mode: "managed" as const,
        vendor: "minimax" as const,
        params: {
          url: "wss://api.minimax.io/ws/v1/t2a_v2",
          model: "speech-2.6-turbo",
          voice_setting: {
            voice_id: "English_captivating_female1",
          },
        },
      };

  const sessionMarker = sessionId ? `[SESSION:${sessionId}]\n` : "";

  const body = {
    name: `mentor-${Date.now()}`,
    properties: {
      channel: channelName,
      token,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: remoteRtcUids,
      idle_timeout: 120,

      // ASR — Agora ARES, free, no key needed
      asr: {
        vendor: "ares",
        language: "en-US",
      },

      // LLM — your OpenAI-compatible provider
      llm: {
        url: llmUrl,
        api_key: llmApiKey,
	        system_messages: [
	          {
	            role: "system",
	            content:
	              `${sessionMarker}You are an AI Mentor in a live classroom. You are a concise, helpful teaching assistant. Keep responses to 1–3 sentences unless the user asks for more. Never interrupt the teacher.`,
	          },
	        ],
        greeting_message: "Hi, I'm your AI Mentor. Ask me anything about the lesson.",
        failure_message: "Sorry, I'm having trouble responding right now.",
        params: { model: llmModel },
        max_history: 20,
      },

      // TTS
      tts: ttsBlock,
    },
  };

  const endpoint = `${BASE_URL}/projects/${appId}/join`;
  console.log("[Agent:backend] POST", endpoint);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(restKey, restSecret),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  console.log("[Agent:backend] http_status :", res.status);
  console.log("[Agent:backend] agent_id    :", data.agent_id ?? "MISSING");
  console.log("[Agent:backend] status      :", data.status ?? "MISSING");
  console.log("[Agent:backend] response    :", JSON.stringify(data));

  if (!res.ok) {
    throw new Error(`Agora agent start failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return { agentId: data.agent_id };
}

export async function stopAgentById(agentId: string): Promise<void> {
  const appId = process.env.AGORA_APP_ID!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;
  const res = await fetch(
    `${BASE_URL}/projects/${appId}/agents/${agentId}/leave`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(restKey, restSecret),
      },
      body: "{}",
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn(
      `[AI] stopAgentById ${agentId} failed (${res.status}):`,
      JSON.stringify(data),
    );
  }
}

export async function injectPrompt(agentId: string, prompt: string): Promise<void> {
  const appId = process.env.AGORA_APP_ID!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;
  const res = await fetch(
    `${BASE_URL}/projects/${appId}/agents/${agentId}/think`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(restKey, restSecret),
      },
      body: JSON.stringify({
        text: prompt,
        on_listening_action: "inject",
        on_thinking_action: "ignore",
        on_speaking_action: "ignore",
      }),
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn(`[AI] injectPrompt ${agentId} failed (${res.status}):`, JSON.stringify(data));
  }
}

export async function stopAllAgentsInChannel(channelName: string): Promise<void> {
  const appId = process.env.AGORA_APP_ID!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;
  const res = await fetch(
    `${BASE_URL}/projects/${appId}/agents?channel=${encodeURIComponent(channelName)}`,
    {
      method: "GET",
      headers: { Authorization: basicAuth(restKey, restSecret) },
    },
  );
  if (!res.ok) {
    console.warn("[AI] Could not list agents for channel", channelName, res.status);
    return;
  }
  const data = await res.json().catch(() => ({}));
  const raw = data.agents ?? data.data ?? data.list ?? data;
  const agents: { agent_id: string; status?: string }[] = Array.isArray(raw) ? raw : [];
  console.log("[AI] list agents raw response:", JSON.stringify(data));
  const running = agents.filter((a) => !a.status || a.status === "RUNNING");
  console.log(`[AI] Found ${running.length} running agent(s) in channel ${channelName}, stopping`);
  await Promise.all(running.map((a) => stopAgentById(a.agent_id)));
}
