import type { ReactNode } from "react";
import { WarningIcon, VideoBlockedIcon, CallEndIcon } from "./icons";
import styles from "./meeting.module.css";

type Variant = "loading" | "permission" | "error" | "left";

export function MeetingStateScreen({
  variant, title, message, children,
}: {
  variant: Variant;
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <main className={styles.stateScreen}>
      <div className={styles.stateCard}>
        <div className={styles.stateIcon} data-variant={variant}>
          {variant === "loading" && <span className={styles.spinner} aria-hidden="true" />}
          {variant === "permission" && <VideoBlockedIcon size={26} />}
          {variant === "error" && <WarningIcon size={26} />}
          {variant === "left" && <CallEndIcon size={26} />}
        </div>
        <h1 className={styles.stateTitle}>{title}</h1>
        {message && <p className={styles.stateMessage}>{message}</p>}
        {children && <div className={styles.stateActions}>{children}</div>}
      </div>
    </main>
  );
}
