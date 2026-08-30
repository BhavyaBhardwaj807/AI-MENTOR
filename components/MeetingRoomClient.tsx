"use client";

import dynamic from "next/dynamic";

const MeetingRoom = dynamic(() => import("./MeetingRoom"), { ssr: false });

export default function MeetingRoomClient({ roomId }: { roomId: string }) {
  return <MeetingRoom roomId={roomId} />;
}
