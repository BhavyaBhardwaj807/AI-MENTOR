import MeetingRoomClient from "../../../components/MeetingRoomClient";

export default async function MeetingPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <MeetingRoomClient roomId={roomId} />;
}