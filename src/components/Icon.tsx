import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  signature: (<><path d="M3 17c3-6 5-6 6-2s3 4 5-1 4-4 7 0" /><path d="M3 21h18" /></>),
  people: <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5c1.6.7 2.6 2.4 3 5.5" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  shield: (<><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>),
  warning: (<><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>),
  lock: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>),
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, strokeWidth = 1.7, color = 'currentColor', style }: {
  name: IconName; size?: number; strokeWidth?: number; color?: string; style?: React.CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      {name === 'people' && <circle cx="9" cy="8" r="3.5" />}
      {paths[name]}
    </svg>
  );
}
