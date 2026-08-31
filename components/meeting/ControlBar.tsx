"use client";

import type { ReactNode } from "react";
import type { AgentStatus } from "./useMeeting";
import {
  MicIcon, MicOffIcon, VideoIcon, VideoOffIcon,
  ScreenShareIcon, CallEndIcon, AiIcon,
} from "./icons";
import styles from "./meeting.module.css";

type ButtonState = "default" | "danger" | "active";

function ControlButton({
  label, onClick, disabled, state = "default", children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  state?: ButtonState;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.control}
      data-state={state}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export default function ControlBar({
  micOn, cameraOn, onToggleMic, onToggleCamera, onLeave,
  agentStatus, onStartAgent,
}: {
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  agentStatus?: AgentStatus;
  onStartAgent?: () => void;
}) {
  const agentLabel =
    agentStatus === "active" ? "AI Mentor is in the room"
    : agentStatus === "starting" ? "Adding AI Mentor…"
    : "Add AI Mentor";

  return (
    <div className={styles.controlBar} role="toolbar" aria-label="Meeting controls">
      <div className={styles.controlGroup}>
        <ControlButton
          label={micOn ? "Turn off microphone" : "Turn on microphone"}
          onClick={onToggleMic}
          state={micOn ? "default" : "danger"}
        >
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </ControlButton>

        <ControlButton
          label={cameraOn ? "Turn off camera" : "Turn on camera"}
          onClick={onToggleCamera}
          state={cameraOn ? "default" : "danger"}
        >
          {cameraOn ? <VideoIcon /> : <VideoOffIcon />}
        </ControlButton>

        <ControlButton label="Screen sharing is not available yet" disabled>
          <ScreenShareIcon />
        </ControlButton>

        {agentStatus !== undefined && (
          <ControlButton
            label={agentLabel}
            onClick={agentStatus === "idle" ? onStartAgent : undefined}
            disabled={agentStatus !== "idle"}
            state={agentStatus === "active" ? "active" : "default"}
          >
            <AiIcon />
          </ControlButton>
        )}
      </div>

      <button
        type="button"
        className={styles.leaveButton}
        onClick={onLeave}
        aria-label="Leave meeting"
        title="Leave meeting"
      >
        <CallEndIcon />
        <span className={styles.leaveLabel}>Leave</span>
      </button>
    </div>
  );
}
