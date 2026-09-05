"use client";

import Link from "next/link";
import { useMeeting } from "./useMeeting";
import MeetingStage from "./MeetingStage";
import { MeetingStateScreen } from "./MeetingStateScreen";
import { QuizModal } from "../quiz/QuizModal";
import type { ParticipantVM } from "./types";
import styles from "./meeting.module.css";

// The AI Mentor always joins on these fixed UIDs (voice agent + LiveAvatar
// video). Treat them as the AI even before this client's own start call
// resolves their UIDs, so a mentor started elsewhere still reads as the mentor.
const DEFAULT_AI_UIDS = [999999, 999998];

function guestName(uid: string | number) {
  return `Guest ${String(uid).slice(-4)}`;
}

export default function MeetingRoom({ roomId }: { roomId: string }) {
  const m = useMeeting(roomId);
  const connected = m.status === "Live" && Boolean(m.localUid);

  if (m.left) {
    return (
      <MeetingStateScreen variant="left" title="You left the meeting">
        <Link className={styles.primaryBtn} href="/">Return home</Link>
        <Link className={styles.secondaryBtn} href={`/meeting/${roomId}`}>Rejoin</Link>
      </MeetingStateScreen>
    );
  }

  if (m.error) {
    if (m.errorKind === "permission") {
      return (
        <MeetingStateScreen variant="permission" title="Camera and microphone blocked" message={m.error}>
          <button className={styles.primaryBtn} onClick={() => window.location.reload()}>Try again</button>
          <Link className={styles.secondaryBtn} href="/">Back home</Link>
        </MeetingStateScreen>
      );
    }
    return (
      <MeetingStateScreen variant="error" title="Could not join this room" message={m.error}>
        <Link className={styles.primaryBtn} href="/">Back home</Link>
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
    participants.push({
      key: "local",
      name: "You",
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
      name: guestName(u.uid),
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
      name: "AI Mentor",
      isAI: true,
      micOn: true,
      cameraOn: Boolean(aiRep?.hasVideo),
      videoTrack: aiRep?.videoTrack,
      speaking: aiSpeaking,
    });
  }

  const handleGenerateQuiz = async () => {
    const topic = window.prompt("Enter quiz topic (e.g. Newton's laws):", "physics");
    if (!topic) return;
    try {
      await fetch("/api/brain/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: roomId,
          sessionId: roomId, // Using roomId as sessionId for MVP
          topic,
        }),
      });
      // The QuizModal component will pick this up via polling
    } catch (err) {
      console.error("Failed to generate quiz", err);
      alert("Failed to generate quiz");
    }
  };

  return (
    <>
      <MeetingStage
        roomId={roomId}
        status={m.status}
        connected={connected}
        participants={participants}
        micOn={m.microphoneOn}
        cameraOn={m.cameraOn}
        onToggleMic={() => void m.toggleMicrophone()}
        onToggleCamera={() => void m.toggleCamera()}
        onLeave={() => void m.leave()}
        agentStatus={m.agentStatus}
        onStartAgent={() => void m.startAiMentor()}
        onGenerateQuiz={handleGenerateQuiz}
      />
      {/* Quiz Modal active overlay */}
      <QuizModal classId={roomId} sessionId={roomId} studentId="student_123" />
    </>
  );
}
