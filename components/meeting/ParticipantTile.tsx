"use client";

import { useEffect, useRef } from "react";
import type { ParticipantVM } from "./types";
import { AiIcon, MicOffIcon } from "./icons";
import styles from "./meeting.module.css";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ParticipantTile({ participant }: { participant: ParticipantVM }) {
  const { name, isLocal, isAI, micOn, cameraOn, speaking, videoTrack, poster } = participant;
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = videoRef.current;
    if (!cameraOn || !videoTrack || !container) return;
    videoTrack.play(container);
    return () => { try { videoTrack.stop(); } catch { /* track may already be stopped */ } };
  }, [videoTrack, cameraOn]);

  const posterFill = poster && cameraOn && !videoTrack;
  const showAvatar = !cameraOn || (!videoTrack && !poster);

  return (
    <div
      className={`${styles.tile}${speaking ? " " + styles.tileSpeaking : ""}`}
      data-ai={isAI || undefined}
    >
      <div
        className={styles.tileVideo}
        ref={videoRef}
        style={posterFill ? { backgroundImage: `url(${poster})` } : undefined}
      >
        {showAvatar && (
          <div className={styles.avatar} data-ai={isAI || undefined}>
            {isAI ? <AiIcon size={36} /> : <span>{initials(name)}</span>}
          </div>
        )}
      </div>

      <div className={styles.tileFooter}>
        <span className={styles.tileName}>
          {isAI && <AiIcon size={15} className={styles.tileNameIcon} />}
          <span className={styles.tileNameText}>{name}</span>
        </span>
        {!micOn && (
          <span className={styles.tileMuted} title="Microphone off" aria-label="Microphone off">
            <MicOffIcon size={15} />
          </span>
        )}
      </div>
    </div>
  );
}
