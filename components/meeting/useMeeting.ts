"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

export type AgentStatus = "idle" | "starting" | "active";

export type ParticipantMetadata = {
  name?: string | null;
  role?: string | null;
  userId?: string | null;
};

/**
 * useMeeting owns ALL real-time behavior: the Agora RTC lifecycle (join,
 * publish, subscribe, leave, cleanup), the AI Mentor agent lifecycle, mic/
 * camera toggles, and the diagnostic logging. Presentation lives elsewhere.
 *
 * The RTC / agent logic here is preserved verbatim from the original
 * MeetingRoom component. The only additions are presentation-driven and use
 * data the client already receives:
 *   - `activeSpeakerUid` is derived from the existing volume-indicator event.
 *   - the LiveAvatar video is no longer rendered into a floating overlay; it
 *     flows through `remoteUsers` and is rendered in a normal participant tile
 *     (the tile render already existed — the overlay was a duplicate play()).
 */
export function useMeeting(roomId: string) {
  const client = useRef<IAgoraRTCClient | null>(null);
  const localTracks = useRef<[IMicrophoneAudioTrack?, ICameraVideoTrack?]>([]);
  const localUidRef = useRef<string | number>("");
  const channelNameRef = useRef("");
  const meetingSessionIdRef = useRef("");
  const meetingClassIdRef = useRef("");
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
  const [errorKind, setErrorKind] = useState<"permission" | "generic" | null>(null);
  const [left, setLeft] = useState(false);
  const [agentUid, setAgentUid] = useState<number | null>(null);
  const [avatarUid, setAvatarUid] = useState<number | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [activeSpeakerUid, setActiveSpeakerUid] = useState<string | number | null>(null);
  const [participantMeta, setParticipantMeta] = useState<Record<string, ParticipantMetadata>>({});
  const [endedByHost, setEndedByHost] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [meetingSessionId, setMeetingSessionId] = useState("");
  const [meetingClassId, setMeetingClassId] = useState("");
  const agentActiveRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const silenceWarnedRef = useRef(false);
  const SILENCE_THRESHOLD = 5;   // volume 0-100; below this = silent
  const ACTIVE_SPEAKER_THRESHOLD = 5;
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
    channelNameRef.current = "";
    meetingSessionIdRef.current = "";
    meetingClassIdRef.current = "";
    setLocalVideoTrack(undefined);
    setLocalUid("");
    setRemoteUsers([]);
    setActiveSpeakerUid(null);
    setChannelName("");
    setMeetingSessionId("");
    setMeetingClassId("");
    try { await session.client.leave(); } catch { /* The client may not have joined yet. */ }
    if (client.current === session.client) client.current = null;
    agentActiveRef.current = false;
    clearSilenceTimer();
    silenceWarnedRef.current = false;
    if (showLeft) setLeft(true);
  }, [clearSilenceTimer]);

  // Poll for authoritative meeting status and participant metadata after join.
  useEffect(() => {
    if (!initializedRef.current || !sessionRef.current?.joined) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      const resolvedChannel = channelNameRef.current || roomId;
      try {
        const statusRes = await fetch(`/api/meeting/${resolvedChannel}/status`);
        if (statusRes.ok) {
          const { status } = await statusRes.json();
          if (status === "ended") {
            setEndedByHost(true);
            window.setTimeout(() => {
              void cleanupSession(false);
            }, 500);
          }
        }

        const partsRes = await fetch(`/api/meeting/${resolvedChannel}/participants`);
        if (partsRes.ok) {
          const { participants } = await partsRes.json();
          if (participants) setParticipantMeta(participants);
        }
      } catch {
        // Polling is informational; join/leave owns hard failures.
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [cleanupSession, roomId, channelName]);

  const stopAgent = useCallback(async () => {
    agentActiveRef.current = false;
    clearSilenceTimer();
    silenceWarnedRef.current = false;
    const resolvedChannel = channelNameRef.current || roomId;
    const resolvedSessionId = meetingSessionIdRef.current || roomId;
    try {
      await fetch("/api/meeting/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", channelName: resolvedChannel, sessionId: resolvedSessionId })
      });
    } catch { /* best-effort */ }
    setAgentUid(null);
    setAvatarUid(null);
    setAgentStatus("idle");
  }, [roomId, clearSilenceTimer]);

  const leave = useCallback(async () => {
    void cleanupSession(true);
  }, [cleanupSession]);

  const startAiMentor = useCallback(async () => {
    if (agentStatus !== "idle") return;
    setAgentStatus("starting");
    const resolvedChannel = channelNameRef.current || roomId;
    const resolvedSessionId = meetingSessionIdRef.current || roomId;
    try {
      const res = await fetch("/api/meeting/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          channelName: resolvedChannel,
          sessionId: resolvedSessionId,
          rtcUid: String(localUidRef.current),
          forceRestart: true,
        })
      });
      const data = await res.json();
      console.log("[AI] /api/meeting/control response:", JSON.stringify(data));
      if (!res.ok) throw new Error(data.error || "Failed to start agent");
      setAgentUid(data.agentId); // Note: meeting control returns agentId, not agentUid
      setAvatarUid(null); // STT bot and audio agent don't have avatar video right now
      setAgentStatus("active");
      agentActiveRef.current = true;
      silenceWarnedRef.current = false;

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
  }, [agentStatus, roomId]);

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
    AgoraRTC.setLogLevel(2);
    AgoraRTC.disableLogUpload();
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
          console.log(`[Avatar:video] UID 999998 renders in its participant tile`);
        }
      }
      setRemoteUsers((users) => users.some((item) => item.uid === user.uid) ? users.map((item) => item.uid === user.uid ? user : item) : [...users, user]);
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
      console.log(`[Avatar:unpublish] UID=${user.uid} mediaType=${mediaType}`);
      if (mediaType === "video" && user.uid === AVATAR_UID) {
        console.log(`[Avatar:video] UID 999998 video track stopped/unpublished`);
        avatarVideoReceivedRef.current = false;
      }
      setRemoteUsers((users) => users.map((item) => item.uid === user.uid ? { ...item, [mediaType === "audio" ? "audioTrack" : "videoTrack"]: undefined, [mediaType === "audio" ? "hasAudio" : "hasVideo"]: false } : item));
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      console.log(`[Avatar:left] UID=${user.uid}`);
      if (user.uid === AVATAR_UID) console.log(`[Avatar:video] UID 999998 video track stopped/unpublished`);
      if (user.uid === 999999) {
        setAgentStatus("idle");
        agentActiveRef.current = false;
      }
      setRemoteUsers((users) => users.filter((item) => item.uid !== user.uid));
      setActiveSpeakerUid((prev) => (prev === user.uid ? null : prev));
    };
    const handleVolumeIndicator = (volumes: { uid: string | number; level: number }[]) => {
      // Active-speaker highlight — runs on every volume tick, agent or not.
      let loudestUid: string | number | null = null;
      let loudestLevel = ACTIVE_SPEAKER_THRESHOLD;
      for (const v of volumes) {
        if (v.level > loudestLevel) { loudestLevel = v.level; loudestUid = v.uid; }
      }
      setActiveSpeakerUid((prev) => (prev === loudestUid ? prev : loudestUid));

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
      if (user.uid === 999999) {
        setAgentStatus("active");
        agentActiveRef.current = true;
      }
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
        const response = await fetch("/api/agora/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId: roomId }),
        });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not get a meeting token.");
        if (session.cancelled) return;
        channelNameRef.current = data.channelName;
        meetingSessionIdRef.current = data.sessionId;
        meetingClassIdRef.current = data.classId;
        setChannelName(data.channelName);
        setMeetingSessionId(data.sessionId);
        setMeetingClassId(data.classId);
        console.log("[Agora] Joining channel");
        const uid = await meetingClient.join(data.appId, data.channelName, data.token, data.uid);
        if (session.cancelled) { await meetingClient.leave(); return; }
        session.joined = true;
        localUidRef.current = uid;
        setLocalUid(uid);
        console.log("[Agora] Joined channel");

        fetch(`/api/meeting/${data.channelName}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid })
        })
          .then(async () => {
            const partsRes = await fetch(`/api/meeting/${data.channelName}/participants`);
            if (!partsRes.ok) return;
            const { participants } = await partsRes.json();
            if (participants) setParticipantMeta(participants);
          })
          .catch(e => console.error("Failed to register participant mapping", e));

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
      } catch (joinError) {
        if (!session.cancelled) {
          const code = (joinError as { code?: string })?.code;
          const message = joinError instanceof Error ? joinError.message : "Could not join the meeting.";
          const isPermission = code === "PERMISSION_DENIED" || /permission|notallowed|denied/i.test(message);
          setErrorKind(isPermission ? "permission" : "generic");
          setError(isPermission ? "AgoraMeet needs access to your camera and microphone to join this room. Allow access in your browser, then try again." : message);
          setStatus("Unable to join");
        }
      }
    }
    void join();
    return scheduleCleanup;
  }, [cleanupSession, roomId]);

  const toggleMicrophone = useCallback(async () => {
    const track = localTracks.current[0]; if (!track) return;
    await track.setEnabled(!microphoneOn); setMicrophoneOn(!microphoneOn);
  }, [microphoneOn]);
  const toggleCamera = useCallback(async () => {
    const track = localTracks.current[1]; if (!track) return;
    await track.setEnabled(!cameraOn); setCameraOn(!cameraOn);
  }, [cameraOn]);

  return {
    status, error, errorKind, left,
    localUid, localVideoTrack, microphoneOn, cameraOn,
    remoteUsers, activeSpeakerUid,
    agentUid, avatarUid, agentStatus,
    participantMeta,
    endedByHost,
    channelName,
    sessionId: meetingSessionId,
    classId: meetingClassId,
    toggleMicrophone, toggleCamera, leave, startAiMentor, stopAgent,
  };
}
