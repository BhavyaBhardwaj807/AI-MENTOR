import { stopAgentById, stopAllAgentsInChannel } from "@/lib/agora-conversational-ai";
import { agentStore } from "@/lib/agent-store";

export async function POST(request: Request) {
  let body: { channelName?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "";
  if (!channelName) return Response.json({ error: "channelName is required" }, { status: 400 });

  const agent = agentStore.get(channelName);
  if (agent) {
    try { await stopAgentById(agent.agentId); } catch (e) { console.warn("[AI] Stop warning:", e); }
    agentStore.unregister(channelName);
  } else {
    // No local record — stop all running agents on Agora's side anyway
    await stopAllAgentsInChannel(channelName);
  }

  return Response.json({ success: true });
}
