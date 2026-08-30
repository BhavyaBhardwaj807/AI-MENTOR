import { RtcRole, RtcTokenBuilder } from "agora-token";

export const TOKEN_EXPIRATION_SECONDS = 60 * 60;

export function createRtcToken(channelName: string, uid: number, appId: string, appCertificate: string) {
  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    TOKEN_EXPIRATION_SECONDS,
    TOKEN_EXPIRATION_SECONDS,
  );
}