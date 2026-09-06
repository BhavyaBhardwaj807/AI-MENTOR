/**
 * lib/retrieval/live-context-adapter.ts
 *
 * Retrieval adapter that simply injects the live Redis context
 * (teacher speaking status, confusion, recent utterances).
 * This doesn't use vectors; it just formats the current state.
 */

import { getLiveContext } from "@/lib/brain/live-context";
import { RetrievalAdapter, QueryContext, RetrievalResult, SourceType } from "./types";

export class LiveContextAdapter implements RetrievalAdapter {
  readonly name = "LiveContextAdapter";
  readonly sourceType: SourceType = "live_context";

  async retrieve(
    query: string,
    context: QueryContext,
  ): Promise<RetrievalResult[]> {
    if (!context.sessionId) {
      return [];
    }

    const liveContext = await getLiveContext(context.sessionId);

    if (!liveContext) {
      return [];
    }

    // Format the live context into a single highly-scored result
    const lines = ["Live Classroom State:"];
    lines.push(`- Teacher Speaking: ${liveContext.teacher_speaking ? "Yes" : "No"}`);

    const signalsArray = Array.isArray(liveContext.confusion_signals) ? liveContext.confusion_signals : [];
    if (signalsArray.length > 0) {
      lines.push(`- Confused Concepts Detected: ${signalsArray.map(c => c.concept).join(", ")}`);
    }

    if (liveContext.recent_utterances && liveContext.recent_utterances.length > 0) {
      lines.push(`- Recent Dialogue:`);
      const recent = liveContext.recent_utterances.slice(-5); // last 5 turns
      for (const u of recent) {
        lines.push(`  [${u.role.toUpperCase()}]: ${u.text}`);
      }
    }

    return [
      {
        content: lines.join("\n"),
        source: `redis:classroom:${context.sessionId}`,
        sourceType: this.sourceType,
        score: 1.0, // Always max score so it gets included
        permissions: "class",
        metadata: { liveContext },
        citation: "Live Classroom Context",
      }
    ];
  }
}
