import { createRtcToken } from "@/lib/agora";

export async function POST(request: Request) {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !appCertificate) return Response.json({ error: "AGORA_APP_ID and AGORA_APP_CERTIFICATE must be configured on the server." }, { status: 500 });

  let body: { channelName?: unknown; uid?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "";
  if (!channelName || Buffer.byteLength(channelName, "utf8") > 63) return Response.json({ error: "channelName is required and must be 63 bytes or fewer." }, { status: 400 });

  const requestedUid = body.uid === undefined ? undefined : Number(body.uid);
  if (requestedUid !== undefined && (!Number.isInteger(requestedUid) || requestedUid < 1 || requestedUid > 4_294_967_295)) return Response.json({ error: "uid must be an integer between 1 and 4294967295." }, { status: 400 });
  const uid = requestedUid ?? Math.floor(Math.random() * 4_294_967_294) + 1;
  const token = createRtcToken(channelName, uid, appId, appCertificate);
  return Response.json({ appId, channelName, token, uid });
}