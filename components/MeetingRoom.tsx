"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import ParticipantTile from "./ParticipantTile";
import MeetingControls from "./MeetingControls";

export default function MeetingRoom({ roomId }: { roomId: string }) {
  const client = useRef<IAgoraRTCClient | null>(null);
  const localTracks = useRef<[IMicrophoneAudioTrack?, ICameraVideoTrack?]>([]);
  const localUidRef = useRef<string | number>("");
  const initializedRef = useRef(false);
  const cleanupTimerRef = useRef<number | null>(null);
  const sessionRef = useRef<{
    client: IAgoraRTCClient;
    tracks: [IMicrophoneAudioTrack?, ICameraVideoTrack?];
    joined: boolean;
    cancelled: boolean;
  } | null>(null);
  const [localUid, setLocalUid] = useState<string | number>("");
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack>();
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [status, setStatus] = useState("Joining room...");
  const [error, setError] = useState("");
  const [left, setLeft] = useState(false);
  const [agentUid, setAgentUid] = useState<number | null>(null);
  const [avatarUid, setAvatarUid] = useState<number | null>(null);
  const [agentStatus, setAgentStatus] = useState<"idle" | "starting" | "active">("idle");
  const agentActiveRef = useRef(false);
  const avatarVideoRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const silenceWarnedRef = useRef(false);
  const SILENCE_THRESHOLD = 5;   // volume 0-100; below this = silent
  const SILENCE_TIMEOUT_MS = 10_000;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) { window.clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  }, []);

  const cleanupSession = useCallback(async (showLeft: boolean) => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    const session = sessionRef.current;
    if (!session) {
      if (showLeft) setLeft(true);
      return;
    }

    session.cancelled = true;
    sessionRef.current = null;
    initializedRef.current = false;

    if (session.joined) {
      try { await session.client.unpublish(session.tracks.filter(Boolean) as (IMicrophoneAudioTrack | ICameraVideoTrack)[]); } catch { /* The client may already be leaving. */ }
    }
    session.tracks.forEach((track) => track?.close());
    session.client.removeAllListeners();
    localTracks.current = [];
    localUidRef.current = "";
    setLocalVideoTrack(undefined);
    setLocalUid("");
    setRemoteUsers([]);
    try { await session.client.leave(); } catch { /* The client may not have joined yet. */ }
    if (client.current === session.client) client.current = null;
    agentActiveRef.current = false;
    clearSilenceTimer();
    silenceWarnedRef.current = false;
    if (showLeft) setLeft(true);
  }, [clearSilenceTimer]);

  const stopAgent = useCallback(async () => {
    agentActiveRef.current = false;
    clearSilenceTimer();
    silenceWarnedRef.current = false;
    try { await fetch("/api/agora/agent/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelName: roomId }) }); } catch { /* best-effort */ }
    setAgentUid(null);
    setAvatarUid(null);
    setAgentStatus("idle");
  }, [roomId, clearSilenceTimer]);

  const leave = useCallback(async () => {
    if (agentStatus === "active") await stopAgent();
    void cleanupSession(true);
  }, [cleanupSession, agentStatus, stopAgent]);

  async function startAiMentor() {
    if (agentStatus !== "idle") return;
    setAgentStatus("starting");
    try {
      const res = await fetch("/api/agora/agent/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelName: roomId }) });
      const data = await res.json();
      console.log("[AI] /api/agora/agent/start response:", JSON.stringify(data));
      if (!res.ok) throw new Error(data.error || "Failed to start agent");
      setAgentUid(data.agentUid);
      setAvatarUid(data.avatarUid ?? null);
      setAgentStatus("active");
      agentActiveRef.current = true;
      silenceWarnedRef.current = false;
      window.setTimeout(() => {
        const c = client.current;
        if (!agentActiveRef.current || !c) return;
        const avatarUser = c.remoteUsers.find((u) => u.uid === 999998);
        if (!avatarUser) {
          console.warn("[Avatar:timeout] No LiveAvatar video received from UID 999998 after 15 seconds. UID 999998 never appeared as a remote user. Problem is upstream — LiveAvatar is not joining the Agora channel.");
        } else if (!avatarUser.hasVideo) {
          console.warn("[Avatar:timeout] No LiveAvatar video received from UID 999998 after 15 seconds. UID 999998 joined but has NOT published video. LiveAvatar joined audio-only or video publish failed.");
        } else {
          console.log("[Avatar:timeout] UID 999998 has video — if screen is black, problem is rendering.");
        }
      }, 15000);
      // Arm the initial silence timer — resets whenever volume-indicator fires audible levels
      silenceTimerRef.current = window.setTimeout(() => {
        if (!agentActiveRef.current) return;
        silenceWarnedRef.current = true;
        console.warn("[AI:audio] No audible speech detected for 10 seconds. Check microphone permissions, selected microphone, mute state, and Agora audio publishing.");
      }, SILENCE_TIMEOUT_MS);
    } catch (e) {
      console.error("[AI] Failed to start agent:", e);
      setAgentStatus("idle");
    }
  }

  useEffect(() => {
    const scheduleCleanup = () => {
      cleanupTimerRef.current = window.setTimeout(() => { void cleanupSession(false); }, 0);
    };

    if (initializedRef.current) {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      return scheduleCleanup;
    }

    initializedRef.current = true;
    const meetingClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    client.current = meetingClient;
    const session = { client: meetingClient, tracks: [] as [IMicrophoneAudioTrack?, ICameraVideoTrack?], joined: false, cancelled: false };
    sessionRef.current = session;
    console.log("[Agora] Creating client");
    const AVATAR_UID = 999998;
    const avatarVideoReceivedRef = { current: false };

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      console.log(`[Avatar:publish] UID=${user.uid} mediaType=${mediaType}`);
      if (user.uid === localUidRef.current || session.cancelled) return;
      console.log(`[Avatar:subscribe] UID=${user.uid} mediaType=${mediaType} — attempting`);
      try {
        await meetingClient.subscribe(user, mediaType);
        console.log(`[Avatar:subscribe] UID=${user.uid} mediaType=${mediaType} — SUCCESS`);
      } catch (err) {
        console.error(`[Avatar:subscribe] UID=${user.uid} mediaType=${mediaType} — FAILED`, err);
        return;
      }
      if (session.cancelled || user.uid === localUidRef.current) return;
      if (mediaType === "audio") {
        console.log(`[Avatar:audio] UID=${user.uid} audioTrack exists: ${!!user.audioTrack}`);
        user.audioTrack?.play();
      }
      if (mediaType === "video") {
        console.log(`[Avatar:video] UID=${user.uid} videoTrack exists: ${!!user.videoTrack}`);
        if (user.uid === AVATAR_UID) {
          console.log(`[Avatar:video] UID 999998 video track received`);
          avatarVideoReceivedRef.current = true;
          const track = user.videoTrack;
          const trackId = track ? (typeof (track as { getTrackId?: () => string }).getTrackId === "function" ? (track as { getTrackId: () => string }).getTrackId() : "n/a") : "none";
          console.log(`[Avatar:video] UID 999998 trackId=${trackId}`);
          const container = avatarVideoRef.current;
          console.log(`[Avatar:video] avatarVideoRef exists: ${!!container}, dimensions: ${container ? container.offsetWidth + "x" + container.offsetHeight : "n/a"}`);
          if (track && container) {
            try {
              console.log(`[Avatar:video] UID 999998 video.play() called`);
              track.play(container);
              console.log(`[Avatar:video] UID 999998 video.play() completed`);
            } catch (playErr) {
              console.error(`[Avatar:video] UID 999998 video.play() FAILED`, playErr);
            }
          } else {
            console.warn(`[Avatar:video] Cannot play — track: ${!!track}, container: ${!!container}`);
          }
        }
      }
      setRemoteUsers((users) => users.some((item) => item.uid === user.uid) ? users.map((item) => item.uid === user.uid ? user : item) : [...users, user]);
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      console.log(`[Avatar:unpublish] UID=${user.uid} mediaType=${mediaType}`);
      if (mediaType === "video" && user.uid === AVATAR_UID) {
        console.log(`[Avatar:video] UID 999998 video track stopped/unpublished`);
        avatarVideoReceivedRef.current = false;
        if (avatarVideoRef.current) avatarVideoRef.current.innerHTML = "";
      }
      setRemoteUsers((users) => users.map((item) => item.uid === user.uid ? { ...item, [mediaType === "audio" ? "audioTrack" : "videoTrack"]: undefined, [mediaType === "audio" ? "hasAudio" : "hasVideo"]: false } : item));
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      console.log(`[Avatar:left] UID=${user.uid}`);
      if (user.uid === AVATAR_UID) console.log(`[Avatar:video] UID 999998 video track stopped/unpublished`);
      setRemoteUsers((users) => users.filter((item) => item.uid !== user.uid));
    };
    const handleVolumeIndicator = (volumes: { uid: string | number; level: number }[]) => {
      if (!agentActiveRef.current) return;
      const agentUidVal = parseInt(process.env.NEXT_PUBLIC_AGORA_AI_AGENT_UID || "999999", 10);
      const hasAudio = volumes.some((v) => v.uid !== agentUidVal && v.level > SILENCE_THRESHOLD);
      const micTrack = localTracks.current[0];
      const localEntry = volumes.find((v) => v.uid === localUidRef.current);
      if (!micTrack) {
        console.log("[AI:mic] microphone track does not exist");
      } else if (!micTrack.enabled) {
        console.log("[AI:mic] microphone track exists but is DISABLED (muted by user)");
      } else {
        const level = localEntry?.level ?? 0;
        if (level > SILENCE_THRESHOLD) {
          console.log(`[AI:mic] meaningful audio detected — level: ${level}`);
        } else {
          console.log(`[AI:mic] track published but audio level near zero — level: ${level} (speak or check mic)`);
        }
      }
      if (hasAudio) {
        if (silenceTimerRef.current !== null) { window.clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        if (silenceWarnedRef.current) { silenceWarnedRef.current = false; console.log("[AI:audio] Audible audio detected again."); }
      } else {
        if (silenceTimerRef.current === null) {
          silenceTimerRef.current = window.setTimeout(() => {
            if (!agentActiveRef.current) return;
            silenceWarnedRef.current = true;
            console.warn("[AI:audio] No audible speech detected for 10 seconds. Check microphone permissions, selected microphone, mute state, and Agora audio publishing.");
          }, SILENCE_TIMEOUT_MS);
        }
      }
    };
    meetingClient.on("user-joined", (user: IAgoraRTCRemoteUser) => {
      console.log(`[Agora] user-joined uid=${user.uid}`);
      setRemoteUsers((users) => users.some((u) => u.uid === user.uid) ? users : [...users, user]);
    });
    meetingClient.on("user-published", handleUserPublished);
    meetingClient.on("user-unpublished", handleUserUnpublished);
    meetingClient.on("user-left", handleUserLeft);
    meetingClient.enableAudioVolumeIndicator();
    meetingClient.on("volume-indicator", handleVolumeIndicator);

    async function join() {
      try {
        console.log("[Agora] Requesting token");
        const response = await fetch(`/api/meetings/${roomId}/token`);
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not get a meeting token.");
        if (session.cancelled) return;
        console.log("[Agora] Joining channel");
        const uid = await meetingClient.join(data.appId, data.channelName, data.token, data.uid);
        if (session.cancelled) { await meetingClient.leave(); return; }
        session.joined = true;
        localUidRef.current = uid;
        setLocalUid(uid);
        console.log("[Agora] Joined channel");
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        if (session.cancelled) { tracks.forEach((track) => track?.close()); await meetingClient.leave(); return; }
        session.tracks = tracks;
        localTracks.current = tracks;
        setLocalVideoTrack(tracks[1]);
        console.log("[Agora] Publishing local tracks");
        await meetingClient.publish(tracks);
        const micTrack = tracks[0];
        const mediaTrack = micTrack.getMediaStreamTrack();
        console.log("[AI:mic] Track created     :", !!micTrack);
        console.log("[AI:mic] Track enabled     :", micTrack.enabled);
        console.log("[AI:mic] Track muted       :", mediaTrack ? mediaTrack.muted : "n/a");
        console.log("[AI:mic] Track readyState  :", mediaTrack ? mediaTrack.readyState : "n/a");
        console.log("[AI:mic] Device label      :", mediaTrack ? (mediaTrack.label || "(no label — check browser permissions)") : "n/a");
        console.log("[AI:mic] Published to Agora: true");
        console.log("[Agora:joined] Remote users at join time:", meetingClient.remoteUsers.map((u) => ({
          uid: u.uid, hasAudio: u.hasAudio, hasVideo: u.hasVideo, videoTrack: !!u.videoTrack
        })));
        setStatus("Live");
      } catch (joinError) { if (!session.cancelled) { setError(joinError instanceof Error ? joinError.message : "Could not join the meeting."); setStatus("Unable to join"); } }
    }
    void join();
    return scheduleCleanup;
  }, [cleanupSession, roomId]);

  async function toggleMicrophone() { const track = localTracks.current[0]; if (!track) return; await track.setEnabled(!microphoneOn); setMicrophoneOn(!microphoneOn); }
  async function toggleCamera() { const track = localTracks.current[1]; if (!track) return; await track.setEnabled(!cameraOn); setCameraOn(!cameraOn); }
  if (error) return <main className="meeting-state"><div><p className="eyebrow">AgoraMeet</p><h1>Could not join this room</h1><p>{error}</p><Link className="secondary-action inline-flex" href="/">Back home</Link></div></main>;
  if (left) return <main className="meeting-state"><div><p className="eyebrow">AgoraMeet</p><h1>You left the meeting</h1><Link className="primary-action inline-flex" href="/">Return home</Link></div></main>;
  const participantCount = remoteUsers.length + (localUid ? 1 : 0);
  const gridParticipantCount = Math.min(Math.max(participantCount, 1), 6);
  return <main className="meeting-shell">
    <header className="meeting-header">
      <div className="meeting-brand"><span className="brand-mark">A</span><div><p className="eyebrow">AgoraMeet</p><h1>Room ID: <strong>{roomId}</strong></h1></div></div>
      <span className="status-pill"><span className="status-dot" /> {status}</span>
    </header>
    <section className={`participant-grid participants-${gridParticipantCount}`} aria-label="Meeting participants">
      {localUid && <ParticipantTile uid={localUid} videoTrack={localVideoTrack} hasAudio={microphoneOn} hasVideo={cameraOn} isLocal />}
      {remoteUsers.map((user) => {
        const isAiParticipant = (agentUid !== null && user.uid === agentUid) || (avatarUid !== null && user.uid === avatarUid);
        return <ParticipantTile key={user.uid} uid={user.uid} videoTrack={user.videoTrack} hasAudio={user.hasAudio} hasVideo={user.hasVideo} label={isAiParticipant ? "AI Mentor" : undefined} />;
      })}
    </section>
    <div style={{ position: "fixed", bottom: "80px", right: "16px", width: "240px", height: "135px", background: "#111", borderRadius: "12px", overflow: "hidden", zIndex: 50, border: "2px solid rgba(255,255,255,0.15)", visibility: agentStatus === "active" ? "visible" : "hidden", pointerEvents: agentStatus === "active" ? "auto" : "none" }}>
      <div ref={avatarVideoRef} style={{ width: "100%", height: "100%" }} />
      <span style={{ position: "absolute", bottom: "6px", left: "8px", fontSize: "11px", color: "rgba(255,255,255,0.7)", pointerEvents: "none" }}>AI Mentor</span>
    </div>
    <footer className="meeting-footer">
      <span className="participant-count">{participantCount} Participant{participantCount === 1 ? "" : "s"}</span>
      <MeetingControls microphoneOn={microphoneOn} cameraOn={cameraOn} onToggleMicrophone={toggleMicrophone} onToggleCamera={toggleCamera} onLeave={() => void leave()} onStartAgent={agentStatus === "idle" ? startAiMentor : undefined} agentStatus={agentStatus} />
      <span className="footer-spacer" aria-hidden="true" />
    </footer>
  </main>;
}