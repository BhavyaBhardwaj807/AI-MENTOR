/**
 * lib/agora-stt.ts
 *
 * Wrapper for Agora Cloud Speech-to-Text (STT) REST APIs.
 */

import { RtcTokenBuilder, RtcRole } from "agora-token";
import { log as logger } from "./logger";

const BASE_URL = "https://api.agora.io/v1/projects";
const TOKEN_TTL = 3600;

function basicAuth(key: string, secret: string) {
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

/**
 * Start a Cloud STT task for a given channel.
 */
export async function startSttTask(
  channelName: string,
  sttUid: number
): Promise<{ taskId: string; builderToken: string }> {
  const appId = process.env.AGORA_APP_ID!;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;

  // 1. Acquire builder token
  const acquireRes = await fetch(`${BASE_URL}/${appId}/rtsc/speech-to-text/builderTokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(restKey, restSecret),
    },
    body: JSON.stringify({ instanceId: channelName }),
  });

  if (!acquireRes.ok) {
    const err = await acquireRes.text().catch(() => "");
    throw new Error(`STT acquire token failed: ${err}`);
  }

  const { tokenName: builderToken } = await acquireRes.json();

  // 2. Start STT task
  const rtcToken = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    sttUid,
    RtcRole.SUBSCRIBER,
    TOKEN_TTL,
    TOKEN_TTL
  );

  const startRes = await fetch(`${BASE_URL}/${appId}/rtsc/speech-to-text/tasks?builderToken=${builderToken}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(restKey, restSecret),
    },
    body: JSON.stringify({
      audio: {
        subscribeAudioUids: ["#allstream#"], // subscribe to all audio
      },
      config: {
        features: ["RECOGNIZE"],
        recognizeConfig: {
          language: "en-US",
          model: "Model",
          connectionTimeout: 60,
          output: {
            destinations: ["Webhook"],
            // Note: The actual webhook URL is configured in the Agora Console,
            // but we can pass arbitrary config if needed.
          }
        },
      },
      rtcConfig: {
        channelName,
        subBotUid: String(sttUid),
        subBotToken: rtcToken,
      }
    }),
  });

  if (!startRes.ok) {
    const err = await startRes.text().catch(() => "");
    throw new Error(`STT start task failed: ${err}`);
  }

  const { taskId } = await startRes.json();
  logger.info({ channelName, taskId }, "Agora STT task started");

  return { taskId, builderToken };
}

/**
 * Stop an ongoing STT task.
 */
export async function stopSttTask(taskId: string, builderToken: string): Promise<void> {
  const appId = process.env.AGORA_APP_ID!;
  const restKey = process.env.AGORA_REST_KEY!;
  const restSecret = process.env.AGORA_REST_SECRET!;

  const res = await fetch(`${BASE_URL}/${appId}/rtsc/speech-to-text/tasks/${taskId}?builderToken=${builderToken}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(restKey, restSecret),
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    logger.warn({ taskId, err }, "Failed to stop Agora STT task");
  } else {
    logger.info({ taskId }, "Agora STT task stopped");
  }
}
