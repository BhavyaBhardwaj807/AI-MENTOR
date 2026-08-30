"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");

  function createMeeting() { router.push(`/meeting/${crypto.randomUUID().slice(0, 8)}`); }
  function joinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedRoomId = roomId.trim().replace(/\s+/g, "-");
    if (normalizedRoomId) router.push(`/meeting/${encodeURIComponent(normalizedRoomId)}`);
  }

  return (
    <main className="home-shell flex min-h-screen flex-col justify-between px-6 py-8 sm:px-12 sm:py-10">
      <header className="flex items-center justify-between"><div className="flex items-center gap-3 text-sm font-semibold tracking-[0.12em] text-slate-200 uppercase"><span className="brand-mark">A</span> AgoraMeet</div><span className="text-xs tracking-[0.18em] text-slate-500 uppercase">AI coming soon</span></header>
      <section className="mx-auto w-full max-w-5xl py-20"><p className="eyebrow mb-6">Real-time, together</p><h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-7xl">Meetings that feel close to the room.</h1><p className="mt-8 max-w-md text-lg leading-8 text-slate-400">Real-time meetings with AI coming soon.</p><div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center"><button className="primary-action" onClick={createMeeting}>Create Meeting <span aria-hidden="true">-&gt;</span></button><form className="flex w-full max-w-sm gap-2" onSubmit={joinMeeting}><input className="room-input" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="Enter room ID" aria-label="Room ID" /><button className="secondary-action" type="submit">Join Meeting</button></form></div></section>
      <footer className="flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-500"><span>Private by default</span><span>Agora RTC</span></footer>
    </main>
  );
}
