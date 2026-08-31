"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");

  function createMeeting() {
    router.push(`/meeting/${crypto.randomUUID().slice(0, 8)}`);
  }

  function joinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedRoomId = roomId.trim().replace(/\s+/g, "-");
    if (normalizedRoomId) router.push(`/meeting/${encodeURIComponent(normalizedRoomId)}`);
  }

  return (
    <main className="home">
      <header className="home-header">
        <div className="home-brand">
          <span className="brand-badge" aria-hidden="true">A</span>
          AgoraMeet
        </div>
        <span className="home-nav-note">AI Mentor included</span>
      </header>

      <div className="home-body">
        <h1 className="home-title">Meetings that feel close to the room.</h1>
        <p className="home-subtitle">
          Real-time video with a built-in AI Mentor that listens and participates.
        </p>
        <div className="home-actions">
          <button className="btn btn-primary" onClick={createMeeting}>
            Create Meeting
          </button>
          <form className="home-join" onSubmit={joinMeeting}>
            <input
              className="home-input"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="Room ID"
              aria-label="Room ID"
            />
            <button className="btn btn-secondary" type="submit">
              Join
            </button>
          </form>
        </div>
      </div>

      <footer className="home-footer">
        <span>Private by default</span>
        <span>Agora RTC</span>
      </footer>
    </main>
  );
}
