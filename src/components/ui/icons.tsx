// Minimal inline icon set (stroke icons, 24px grid) so we don't pull an icon dependency.
type P = { className?: string };
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconSpade = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3c3 3.2 7 6 7 9.6A3.6 3.6 0 0 1 12.9 15c.3 2.2 1.2 4 2.6 5H8.5c1.4-1 2.3-2.8 2.6-5A3.6 3.6 0 0 1 5 12.6C5 9 9 6.2 12 3Z" />
  </svg>
);
export const IconHistory = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </svg>
);
export const IconTrophy = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" />
  </svg>
);
export const IconUser = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const IconShare = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);
export const IconCheck = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconChat = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);
export const IconChevron = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconX = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconArrow = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
