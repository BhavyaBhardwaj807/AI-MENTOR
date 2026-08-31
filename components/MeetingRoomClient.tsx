"use client";

import dynamic from "next/dynamic";

const MeetingRoom = dynamic(() => import("./meeting/MeetingRoom"), { ssr: false });

export default function MeetingRoomClient({ roomId }: { roomId: string }) {
  return <MeetingRoom roomId={roomId} />;
}
