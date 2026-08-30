import { createAgoraAI } from "@/lib/agora-conversational-ai";
import { agentStore } from "@/lib/agent-store";

/**
 * POST /api/ai/start
 * 
 * Starts an AI agent in the specified meeting room.
 * 
 * Request:
 * {
 *   "roomId": "abc123",
 *   "channelName": "abc123"  // Same as roomId usually
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "agentId": "...",
 *   "agentUid": 999999,
 *   "status": "joining"
 * }
 */
export async function POST(request: Request) {
  try {
    // Validate environment variables
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!appId || !appCertificate) {
      return Response.json(
        {
          error: "AGORA_APP_ID and AGORA_APP_CERTIFICATE must be configured",
        },
        { status: 500 }
      );
    }

    if (!openaiApiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY must be configured for AI agent" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { roomId, channelName } = body;

    if (!roomId || !channelName) {
      return Response.json(
        { error: "roomId and channelName are required" },
        { status: 400 }
      );
    }

    console.log(
      `[AI] POST /api/ai/start - Room: ${roomId}, Channel: ${channelName}`
    );

    // Check if agent already exists for this room
    const existingAgent = agentStore.get(roomId);
    if (existingAgent && existingAgent.status !== "stopped") {
      console.log(
        `[AI] Agent already exists in room ${roomId}, returning existing`
      );
      return Response.json({
        success: true,
        agentId: existingAgent.agentId,
        agentUid: existingAgent.agentUid,
        status: existingAgent.status,
        message: "Agent already running in this room",
      });
    }

    // Generate agent UID (use fixed value for consistency)
    const agentUid =
      parseInt(process.env.AGORA_AI_AGENT_UID || String(999999), 10);

    // Create Agora AI client
    const agoraAI = createAgoraAI({
      appId,
      appCertificate,
      openaiApiKey,
      systemPrompt: process.env.AI_SYSTEM_PROMPT,
    });

    // Start the agent via Agora REST API
    const response = await agoraAI.startAgent({
      roomId,
      channelName,
      agentUid,
      remoteUids: [], // Will subscribe to all users in channel
      enableStringUid: false,
    });

    // Register agent in our store
    agentStore.register(roomId, response.agentId, agentUid);

    console.log(`[AI] Agent started successfully - ID: ${response.agentId}`);

    return Response.json({
      success: true,
      agentId: response.agentId,
      agentUid,
      status: "joining",
    });
  } catch (error) {
    console.error("[AI] Error in POST /api/ai/start:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return Response.json(
      {
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}
