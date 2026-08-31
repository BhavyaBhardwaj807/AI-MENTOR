import type { ParticipantVM } from "./types";
import ParticipantTile from "./ParticipantTile";
import styles from "./meeting.module.css";

/** Balanced column count so tiles stay as close to 16:9 as the space allows. */
function columnsFor(count: number) {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

export default function ParticipantGrid({ participants }: { participants: ParticipantVM[] }) {
  const count = Math.max(participants.length, 1);
  const columns = columnsFor(count);

  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={`Meeting participants (${participants.length})`}
    >
      {participants.map((p) => (
        <ParticipantTile key={p.key} participant={p} />
      ))}
    </div>
  );
}
