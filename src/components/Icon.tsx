/** Small inline stroke icons. Decorative: pair them with visible or sr-only text. */

const PATHS = {
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  filter: 'M4 6h16M7 12h10M10 18h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  select: 'M6 3.5l12.5 7-5.5 1.6-2.3 5.4z',
  erase:
    'M8.5 20H20M4.6 15.6l9.9-9.9a2 2 0 012.8 0l1.5 1.5a2 2 0 010 2.8L11 18.8a4 4 0 01-5.6 0l-.8-.8a1.7 1.7 0 010-2.4zM9 11l5 5',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11',
  apply: 'M4 7h10M4 12h10M4 17h6M17 14v6M14 17h6',
  calendar:
    'M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5v12a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5zM4 10h16M8 3v4M16 3v4',
  people:
    'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18 14a6.5 6.5 0 013.5 6',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  trash:
    'M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 008.5 21h7a1.5 1.5 0 001.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  copy: 'M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 9a2 2 0 100-4 2 2 0 000 4zM9 19a2 2 0 100-4 2 2 0 000 4z',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  timeOff: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  tag: 'M3 12V4a1 1 0 011-1h8l9 9-9 9zM7.5 7.5h.01',
  warning: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, className, strokeWidth = 2 }: IconProps) {
  const dots = name === 'more';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={dots ? 3.2 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
