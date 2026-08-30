// In-memory store for active AI agents per room
// This maps roomId -> agent information
// For production, replace with Redis or database

export interface ActiveAgent {
  roomId: string;
  agentId: string;
  agentUid: number | string;
  status: "joining" | "joined" | "listening" | "speaking" | "stopped";
  createdAt: Date;
}

class AgentStore {
  private agents = new Map<string, ActiveAgent>();

  /**
   * Register a new agent for a room
   */
  register(
    roomId: string,
    agentId: string,
    agentUid: number | string
  ): ActiveAgent {
    const agent: ActiveAgent = {
      roomId,
      agentId,
      agentUid,
      status: "joining",
      createdAt: new Date(),
    };
    this.agents.set(roomId, agent);
    console.log(`[AI] Registered agent ${agentId} in room ${roomId}`);
    return agent;
  }

  /**
   * Get agent for a specific room
   */
  get(roomId: string): ActiveAgent | undefined {
    return this.agents.get(roomId);
  }

  /**
   * Check if a room has an active agent
   */
  exists(roomId: string): boolean {
    return this.agents.has(roomId);
  }

  /**
   * Update agent status
   */
  setStatus(roomId: string, status: ActiveAgent["status"]): void {
    const agent = this.agents.get(roomId);
    if (agent) {
      agent.status = status;
      console.log(`[AI] Room ${roomId}: agent status = ${status}`);
    }
  }

  /**
   * Remove agent from room
   */
  unregister(roomId: string): boolean {
    const agent = this.agents.get(roomId);
    if (agent) {
      console.log(`[AI] Unregistered agent ${agent.agentId} from room ${roomId}`);
      this.agents.delete(roomId);
      return true;
    }
    return false;
  }

  /**
   * Get all active agents
   */
  getAll(): ActiveAgent[] {
    return Array.from(this.agents.values());
  }
}

export const agentStore = new AgentStore();
