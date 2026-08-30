import { createAgoraAI } from "@/lib/agora-conversational-ai";
import { agentStore } from "@/lib/agent-store";

/**
 * POST /api/ai/stop
 * 
 * Stops an AI agent in the specified meeting room.
 * 
 * Request:
 * {
 *   "roomId": "abc123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Agent stopped"
 * }
 */
export async function POST(request: Request) {
  try {
    // Validate environment variables
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!appId || !appCertificate || !openaiApiKey) {
      return Response.json(
        { error: "Server configuration incomplete" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { roomId } = body;

    if (!roomId) {
      return Response.json({ error: "roomId is required" }, { status: 400 });
    }

    console.log(`[AI] POST /api/ai/stop - Room: ${roomId}`);

    // Get agent for this room
    const agent = agentStore.get(roomId);

    if (!agent) {
      console.log(`[AI] No active agent found for room ${roomId}`);
      return Response.json({
        success: true,
        message: "No active agent in this room",
      });
    }

    // Create Agora AI client
    const agoraAI = createAgoraAI({
      appId,
      appCertificate,
      openaiApiKey,
    });

    // Stop the agent via Agora REST API
    try {
      await agoraAI.stopAgent(agent.agentId);
    } catch (error) {
      // If agent already stopped or doesn't exist, log but continue
      console.warn(`[AI] Warning stopping agent: ${error}`);
    }

    // Unregister agent from our store
    agentStore.unregister(roomId);

    console.log(`[AI] Agent stopped successfully`);

    return Response.json({
      success: true,
      message: "Agent stopped",
    });
  } catch (error) {
    console.error("[AI] Error in POST /api/ai/stop:", error);

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
