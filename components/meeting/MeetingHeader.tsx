"use client";

import { useState } from "react";
import { PeopleIcon, CopyIcon, CheckIcon } from "./icons";
import styles from "./meeting.module.css";

export default function MeetingHeader({
  roomId, connected, status, participantCount,
}: {
  roomId: string;
  connected: boolean;
  status: string;
  participantCount: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      const url = typeof window !== "undefined" ? window.location.href : roomId;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.brandMark} aria-hidden="true">A</span>
        <div className={styles.roomMeta}>
          <span className={styles.roomLabel}>AgoraMeet</span>
          <span className={styles.roomCode} title={`Room ${roomId}`}>{roomId}</span>
        </div>
        <button
          type="button"
          className={styles.copyButton}
          onClick={copyLink}
          aria-label={copied ? "Link copied" : "Copy meeting link"}
          title={copied ? "Link copied" : "Copy meeting link"}
        >
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          <span>{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>

      <div className={styles.headerRight}>
        <span className={styles.statusPill} data-connected={connected || undefined}>
          <span className={styles.statusDot} />
          {connected ? "Connected" : status}
        </span>
        <span className={styles.countPill} title={`${participantCount} in this meeting`}>
          <PeopleIcon size={17} />
          {participantCount}
        </span>
      </div>
    </header>
  );
}
