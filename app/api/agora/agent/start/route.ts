import { startAgent, stopAllAgentsInChannel } from "@/lib/agora-conversational-ai";
import { agentStore } from "@/lib/agent-store";

const PLACEHOLDERS = ["your_rest_key_here", "your_rest_secret_here", "your_pipeline_id_here"];

export async function POST(request: Request) {
  const required = ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE", "AGORA_REST_KEY", "AGORA_REST_SECRET", "AGORA_AGENT_PIPELINE_ID", "LIVEAVATAR_API_KEY", "AGORA_AVATAR_ID"];
  const missing = required.filter((k) => !process.env[k] || PLACEHOLDERS.includes(process.env[k]!));
  if (missing.length) return Response.json({ error: `Configure these env vars in .env.local: ${missing.join(", ")}` }, { status: 500 });

  let body: { channelName?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "";
  if (!channelName) return Response.json({ error: "channelName is required" }, { status: 400 });

  // Best-effort: stop any stale running agents before starting fresh
  try { await stopAllAgentsInChannel(channelName); } catch (e) { console.warn("[AI] Pre-stop warning:", e); }
  agentStore.unregister(channelName);

  try {
    const { agentId } = await startAgent(channelName);
    const agentUid = parseInt(process.env.AGORA_AI_AGENT_UID || "999999", 10);
    const avatarUid = parseInt(process.env.AGORA_AVATAR_UID || "999998", 10);
    agentStore.register(channelName, agentId, agentUid);
    console.log(`[AI] Agent started — agentId: ${agentId}, agentUid: ${agentUid}, avatarUid: ${avatarUid}, channel: ${channelName}`);
    // Poll agent status after 3s to surface any avatar errors
    setTimeout(async () => {
      try {
        const appId = process.env.AGORA_APP_ID!;
        const auth = "Basic " + Buffer.from(`${process.env.AGORA_REST_KEY}:${process.env.AGORA_REST_SECRET}`).toString("base64");
        const r = await fetch(`https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${agentId}`, { headers: { Authorization: auth } });
        const d = await r.json();
        console.log("[AI:status] agent status poll:", JSON.stringify(d));
      } catch (e) { console.warn("[AI:status] poll failed:", e); }
    }, 8000);
    return Response.json({ success: true, agentId, agentUid, avatarUid, status: "joining" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start agent";
    console.error("[AI] startAgent error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
