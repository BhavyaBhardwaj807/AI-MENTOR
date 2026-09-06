"use client";

import Link from "next/link";
import { useMeeting, type ParticipantMetadata } from "./useMeeting";
import { MeetingStateScreen } from "./MeetingStateScreen";
import { useAuth } from "@/hooks/useAuth";
import MeetingStage from "./MeetingStage";
import { QuizModal } from "../quiz/QuizModal";
import { TeacherSidePanel } from "../quiz/TeacherSidePanel";
import type { ParticipantVM } from "./types";

// The AI Mentor always joins on these fixed UIDs (voice agent + LiveAvatar
// video). Treat them as the AI even before this client's own start call
// resolves their UIDs, so a mentor started elsewhere still reads as the mentor.
const DEFAULT_AI_UIDS = [999999, 999998];

function guestName(uid: string | number, meta?: Record<string, ParticipantMetadata>) {
  const name = meta?.[String(uid)]?.name;
  if (name) {
    return name;
  }
  return `Guest ${String(uid).slice(-4)}`;
}

export default function MeetingRoom({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const dashboardHref = user?.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";

  const m = useMeeting(roomId);
  const connected = m.status === "Live" && Boolean(m.localUid);
  const resolvedChannelName = m.channelName || roomId;
  const resolvedClassId = m.classId || roomId;
  const resolvedSessionId = m.sessionId || roomId;

  if (m.endedByHost) {
    return (
      <MeetingStateScreen variant="left" title="Meeting Ended">
        <p className="text-on-surface-variant text-[14px] mb-4">The host has ended this meeting for everyone.</p>
        <Link
          className="h-11 px-6 bg-ag-primary hover:bg-ag-primary/90 text-ag-on-primary text-[14px] font-medium rounded-lg transition-colors flex items-center justify-center shadow-sm"
          href={dashboardHref}
        >
          Return to Dashboard
        </Link>
      </MeetingStateScreen>
    );
  }

  if (m.left) {
    return (
      <MeetingStateScreen variant="left" title="You left the meeting">
        <Link
          className="h-11 px-6 bg-ag-primary hover:bg-ag-primary/90 text-ag-on-primary text-[14px] font-medium rounded-lg transition-colors flex items-center justify-center shadow-sm"
          href={dashboardHref}
        >
          Return to Dashboard
        </Link>
        <Link
          className="h-11 px-6 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[14px] font-medium rounded-lg transition-colors border border-outline-variant/30 flex items-center justify-center shadow-sm"
          href={`/meeting/${roomId}`}
        >
          Rejoin Meeting
        </Link>
      </MeetingStateScreen>
    );
  }

  if (m.error) {
    if (m.errorKind === "permission") {
      return (
        <MeetingStateScreen variant="permission" title="Camera and microphone blocked" message={m.error}>
          <button
            className="h-11 px-6 bg-ag-primary hover:bg-ag-primary/90 text-ag-on-primary text-[14px] font-medium rounded-lg transition-colors flex items-center justify-center shadow-sm"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <Link
            className="h-11 px-6 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[14px] font-medium rounded-lg transition-colors border border-outline-variant/30 flex items-center justify-center shadow-sm"
            href={dashboardHref}
          >
            Back to Dashboard
          </Link>
        </MeetingStateScreen>
      );
    }
    return (
      <MeetingStateScreen variant="error" title="Could not join this room" message={m.error}>
        <Link
          className="h-11 px-6 bg-ag-primary hover:bg-ag-primary/90 text-ag-on-primary text-[14px] font-medium rounded-lg transition-colors flex items-center justify-center shadow-sm"
          href={dashboardHref}
        >
          Back to Dashboard
        </Link>
      </MeetingStateScreen>
    );
  }

  if (!connected) {
    return (
      <MeetingStateScreen variant="loading" title="Joining room" message={`Connecting you to ${roomId}…`} />
    );
  }

  // --- Build the participant list the presentation layer renders ---
  const aiUids = new Set<number>(DEFAULT_AI_UIDS);
  if (m.agentUid != null) aiUids.add(m.agentUid);
  if (m.avatarUid != null) aiUids.add(m.avatarUid);

  const humans = m.remoteUsers.filter((u) => !aiUids.has(Number(u.uid)));
  const aiUsers = m.remoteUsers.filter((u) => aiUids.has(Number(u.uid)));
  // One AI Mentor tile: prefer the member publishing video (the LiveAvatar).
  const aiRep = aiUsers.find((u) => u.hasVideo) ?? aiUsers[0];
  const aiSpeaking = aiUsers.some((u) => u.uid === m.activeSpeakerUid);

  const participants: ParticipantVM[] = [];

  if (m.localUid) {
    const localName = user?.name?.trim() || guestName(m.localUid, m.participantMeta);
    participants.push({
      key: "local",
      name: `${localName} (You)`,
      isLocal: true,
      micOn: m.microphoneOn,
      cameraOn: m.cameraOn,
      videoTrack: m.localVideoTrack,
      speaking: m.activeSpeakerUid === m.localUid,
    });
  }

  for (const u of humans) {
    participants.push({
      key: String(u.uid),
      name: guestName(u.uid, m.participantMeta),
      micOn: Boolean(u.hasAudio),
      cameraOn: Boolean(u.hasVideo),
      videoTrack: u.videoTrack,
      speaking: m.activeSpeakerUid === u.uid,
    });
  }

  // Show the AI Mentor tile once it has been started (or if one is already
  // present), presented as a normal participant — not a floating overlay.
  if (m.agentStatus !== "idle" || aiUsers.length > 0) {
    participants.push({
      key: "ai-mentor",
      name: m.agentName || "AI Mentor",
      isAI: true,
      micOn: true,
      cameraOn: Boolean(aiRep?.hasVideo),
      videoTrack: aiRep?.videoTrack,
      speaking: aiSpeaking,
    });
  }

  // Quiz generation is now triggered entirely via Voice Commands to the AI Co-Teacher (Phase 2 & 3).

  const handleEndMeetingForAll = async () => {
    if (!confirm("Are you sure you want to end this meeting for everyone?")) return;
    try {
      await fetch(`/api/meeting/${resolvedChannelName}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended" })
      });
      // The local client will pick this up via polling or we can just leave directly
      m.leave();
    } catch (err) {
      console.error("Failed to end meeting", err);
    }
  };

  return (
    <>
      <MeetingStage
        roomId={resolvedChannelName}
        status={m.status}
        connected={connected}
        participants={participants}
        micOn={m.microphoneOn}
        cameraOn={m.cameraOn}
        onToggleMic={() => void m.toggleMicrophone()}
        onToggleCamera={() => void m.toggleCamera()}
        onLeave={() => void m.leave()}
        agentStatus={m.agentStatus}
        onToggleAgent={user?.role === "teacher" ? (m.agentStatus === "active" ? () => void m.stopAgent() : () => void m.startAiMentor()) : undefined}
        onEndMeeting={user?.role === "teacher" ? handleEndMeetingForAll : undefined}
        notice={m.agentStatus === "active" && !m.microphoneOn ? "Your microphone is muted. The AI Mentor cannot hear your voice commands." : undefined}
      />
      {/* Role-based Quiz UI */}
      {user?.role === "teacher" ? (
        <TeacherSidePanel classId={resolvedClassId} sessionId={resolvedSessionId} />
      ) : (
        <QuizModal classId={resolvedClassId} sessionId={resolvedSessionId} />
      )}
    </>
  );
}
