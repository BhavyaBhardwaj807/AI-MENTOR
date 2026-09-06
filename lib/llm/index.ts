/**
 * lib/llm/index.ts
 *
 * Unified LLM client.
 * Wraps OpenAI-compatible API calls with streaming + non-streaming modes.
 * Each subsystem specifies which model to use via brain config.
 */

import { LLM_API_KEY, LLM_BASE_URL } from "@/lib/brain/config";
import { z } from "zod";

// ── Types ──────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: false;
  signal?: AbortSignal;
}

export interface LLMStreamOptions {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  stream: true;
  signal?: AbortSignal;
}

export interface LLMResponse {
  content: string;
  tokens_in: number;
  tokens_out: number;
  model: string;
}

// ── Non-streaming call ─────────────────────────────────────────────────

export async function llmCall(options: LLMCallOptions): Promise<LLMResponse> {
  const {
    model,
    messages,
    maxTokens = 500,
    temperature = 0.7,
    signal,
  } = options;

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM call failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? "",
    tokens_in: data.usage?.prompt_tokens ?? 0,
    tokens_out: data.usage?.completion_tokens ?? 0,
    model: data.model ?? model,
  };
}

// ── Streaming call (async generator) ───────────────────────────────────

export async function* llmStream(
  options: LLMStreamOptions,
): AsyncGenerator<string> {
  const {
    model,
    messages,
    maxTokens = 200,
    temperature = 0.7,
    signal,
  } = options;

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM stream failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const d = trimmed.slice(6);
      if (d === "[DONE]") return;
      try {
        const c = JSON.parse(d)?.choices?.[0]?.delta?.content;
        if (c) yield c;
      } catch {
        /* skip malformed SSE chunks */
      }
    }
  }
}

// ── Structured JSON call (for extraction / classification) ─────────────

/**
 * Call the LLM and parse the response using Zod.
 * Implements a retry loop (up to 3 tries) if the LLM returns invalid JSON or fails validation.
 */
export async function llmJsonCall<T>(
  options: LLMCallOptions & { schema?: z.ZodType<T>, maxRetries?: number },
): Promise<{ parsed: T; raw: LLMResponse }> {
  const maxRetries = options.maxRetries ?? 3;
  let attempts = 0;
  let lastError: Error | null = null;
  const currentMessages = [...options.messages];

  // Inject initial JSON instruction
  const systemMsgIdx = currentMessages.findIndex((m) => m.role === "system");
  const jsonInstruction = "\n\nRespond ONLY with valid JSON matching the requested schema. No markdown code blocks, no explanation, no backticks.";
  
  if (systemMsgIdx >= 0) {
    currentMessages[systemMsgIdx] = {
      ...currentMessages[systemMsgIdx],
      content: currentMessages[systemMsgIdx].content + jsonInstruction,
    };
  } else {
    currentMessages.unshift({ role: "system", content: jsonInstruction });
  }

  while (attempts < maxRetries) {
    attempts++;
    
    const raw = await llmCall({ ...options, messages: currentMessages });

    // Strip markdown code fences if present
    let cleanContent = raw.content.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
    }

    try {
      const parsedObj = JSON.parse(cleanContent);
      
      // If a Zod schema is provided, validate it
      if (options.schema) {
        const result = options.schema.safeParse(parsedObj);
        if (!result.success) {
          throw new Error(`Schema validation failed: ${result.error.message}`);
        }
        return { parsed: result.data, raw };
      }
      
      return { parsed: parsedObj as T, raw };
    } catch (err) {
      lastError = err as Error;
      
      // If we failed, append the error as a user message to prompt correction
      currentMessages.push({ role: "assistant", content: raw.content });
      currentMessages.push({ 
        role: "user", 
        content: `Your previous response failed validation with error: ${lastError.message}\nPlease correct the JSON and try again.` 
      });
    }
  }

  throw new Error(`LLM JSON parse/validation failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}
