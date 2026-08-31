import type { IRemoteVideoTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";

export type MeetingVideoTrack = IRemoteVideoTrack | ILocalVideoTrack;

/**
 * A participant as the presentation layer needs to see them. The container
 * (MeetingRoom) maps Agora users onto this shape; nothing below the container
 * touches the Agora SDK directly except to play a video track it is handed.
 */
export type ParticipantVM = {
  /** Stable React key. */
  key: string;
  /** Display name, e.g. "You", "AI Mentor", "Guest 4821". */
  name: string;
  isLocal?: boolean;
  isAI?: boolean;
  micOn: boolean;
  cameraOn: boolean;
  speaking?: boolean;
  videoTrack?: MeetingVideoTrack;
  /** Preview-only background image used by the design harness; never set in the running app. */
  poster?: string;
};
