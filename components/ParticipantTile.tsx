"use client";

import { useEffect, useRef } from "react";
import type { IRemoteVideoTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";

type VideoTrack = IRemoteVideoTrack | ILocalVideoTrack;

export default function ParticipantTile({ uid, videoTrack, hasAudio, hasVideo = Boolean(videoTrack), isLocal, label }: { uid: string | number; videoTrack?: VideoTrack; hasAudio: boolean; hasVideo?: boolean; isLocal?: boolean; label?: string }) {
  const videoElement = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!videoTrack || !videoElement.current) return; videoTrack.play(videoElement.current); return () => videoTrack.stop(); }, [videoTrack]);
  const displayName = isLocal ? "You" : (label ?? `User ${uid}`);
  return <article className="participant-tile">
    <div ref={videoElement} className="participant-video">
      {!videoTrack && <span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span>}
    </div>
    <div className="participant-meta">
      <span className="participant-name"><span className="person-icon" aria-hidden="true">●</span>{displayName}</span>
      <span className="participant-status">
        <span className={hasAudio ? "mic-on" : "mic-off"}>{hasAudio ? "Mic on" : "Mic off"}</span>
        <span className={hasVideo ? "camera-on" : "camera-off"}>{hasVideo ? "Camera on" : "Camera off"}</span>
      </span>
    </div>
  </article>;
}