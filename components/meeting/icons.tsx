import type { SVGProps } from "react";

/**
 * Meeting icon set — hand-picked Material Symbols glyphs drawn on a shared
 * 24×24 grid and filled with `currentColor`, so size and color are controlled
 * entirely by CSS (font-size / color on the parent, or the `size` prop here).
 *
 * Using inline SVG rather than an icon package keeps the bundle lean and gives
 * every control a consistent stroke weight and optical size.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-4.08A7 7 0 0 0 19 11h-2Z" />
    </Icon>
  );
}

export function MicOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 10.6 9 4.6V5a3 3 0 0 1 6 0v5.6ZM19 11h-2a4.98 4.98 0 0 1-.63 2.43l1.46 1.46A6.96 6.96 0 0 0 19 11ZM4.27 3 3 4.27l6 6.02V11a3 3 0 0 0 4.28 2.71l.9.9A4.98 4.98 0 0 1 7 11H5a7 7 0 0 0 6 6.92V22h2v-4.08a6.94 6.94 0 0 0 2.6-.86l3.13 3.14L20 18.93 4.27 3Z" />
    </Icon>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
    </Icon>
  );
}

export function VideoOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.82L21 17.18V6.5ZM3.27 2 2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.2 0 .4-.08.54-.18L19.73 21 21 19.73 3.27 2Z" />
    </Icon>
  );
}

export function ScreenShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2H0v2h24v-2h-4Zm-7-3.53v-2.19c-2.78 0-4.61.85-6 2.72.56-2.67 2.11-5.33 6-5.87V7l4 3.73-4 3.74Z" />
    </Icon>
  );
}

export function CallEndIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a.9.9 0 0 1-.7.28.94.94 0 0 1-.71-.29L.29 13.08A.99.99 0 0 1 0 12.37c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.66c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48a.94.94 0 0 1-.71.29.9.9 0 0 1-.7-.28 11.27 11.27 0 0 0-2.67-1.85.998.998 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9Z" />
    </Icon>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 11a3 3 0 1 0-.01-6.01A3 3 0 0 0 16 11Zm-8 0a3 3 0 1 0-.01-6.01A3 3 0 0 0 8 11Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />
    </Icon>
  );
}

export function AiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 9V7a2 2 0 0 0-2-2h-3a3 3 0 0 0-6 0H6a2 2 0 0 0-2 2v2a3 3 0 0 0 0 6v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a3 3 0 0 0 0-6ZM9 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm7 4H8v-2h8v2Zm-1-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
    </Icon>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z" />
    </Icon>
  );
}

export function VideoBlockedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 0 1-6.32-12.9l11.22 11.22A7.96 7.96 0 0 1 12 20Zm6.32-3.1L7.1 5.68A8 8 0 0 1 18.32 16.9Z" />
    </Icon>
  );
}

export function QuizIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17ZM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Z" />
    </Icon>
  );
}
