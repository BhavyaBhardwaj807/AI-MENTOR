"use client";

import MeetingHeader from "./MeetingHeader";
import ParticipantGrid from "./ParticipantGrid";
import ControlBar from "./ControlBar";
import type { ParticipantVM } from "./types";
import type { AgentStatus } from "./useMeeting";
import styles from "./meeting.module.css";

export type MeetingStageProps = {
  roomId: string;
  status: string;
  connected: boolean;
  participants: ParticipantVM[];
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  agentStatus?: AgentStatus;
  onStartAgent?: () => void;
  onGenerateQuiz?: () => void;
};

/**
 * Pure presentational shell for the in-call experience. Takes a fully-resolved
 * list of participants plus control handlers — it never touches Agora. This is
 * what both the live container and the design harness render.
 */
export default function MeetingStage({
  roomId, status, connected, participants,
  micOn, cameraOn, onToggleMic, onToggleCamera, onLeave,
  agentStatus, onStartAgent, onGenerateQuiz,
}: MeetingStageProps) {
  return (
    <div className={styles.stage}>
      <MeetingHeader
        roomId={roomId}
        connected={connected}
        status={status}
        participantCount={participants.length}
      />
      <main className={styles.stageMain}>
        <ParticipantGrid participants={participants} />
      </main>
      <ControlBar
        micOn={micOn}
        cameraOn={cameraOn}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onLeave={onLeave}
        agentStatus={agentStatus}
        onStartAgent={onStartAgent}
        onGenerateQuiz={onGenerateQuiz}
      />
    </div>
  );
}
