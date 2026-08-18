// Small inline outline-icon set (Feather/Lucide-style: 24x24 viewBox, stroke
// currentColor, rounded caps/joins). Replaces emoji glyphs everywhere in the
// app — nav, stat cards, pills, modal close button — to match the supplied
// reference designs, which use a consistent line-icon language, not emoji.

export type IconName =
  | 'home'
  | 'building'
  | 'user'
  | 'users'
  | 'heart'
  | 'folder'
  | 'checkCircle'
  | 'utensils'
  | 'sun'
  | 'flame'
  | 'truck'
  | 'barChart'
  | 'clipboardList'
  | 'wrench'
  | 'sunrise'
  | 'apple'
  | 'cookie'
  | 'alertTriangle'
  | 'xCircle'
  | 'clock'
  | 'x'
  | 'search'
  | 'arrowLeft'
  | 'arrowRight';

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="1.2" />
      <path d="M8.5 7h1M14.5 7h1M8.5 11h1M14.5 11h1M8.5 15h1M14.5 15h1" />
      <path d="M10 21.5v-4h4v4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20.5c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.2" r="3.2" />
      <path d="M3 20c0-3.1 2.7-5.3 6-5.3s6 2.2 6 5.3" />
      <circle cx="17.2" cy="9" r="2.4" />
      <path d="M15.8 20c.1-2.5 1.9-4.4 4.2-4.7" />
    </>
  ),
  heart: <path d="M12 20.5 4.6 13c-2-2-2-5.2 0-7.1 2-2 5.1-2 7 0l.4.4.4-.4c2-2 5.1-2 7 0 2 1.9 2 5.1 0 7.1L12 20.5Z" />,
  folder: <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.6l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.6 2.6L16.2 9" />
    </>
  ),
  utensils: (
    <>
      <path d="M7 2.5v8.4M4.5 2.5v5.6c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5V2.5" />
      <path d="M7 11v10.5" />
      <path d="M17 2.5c-1.4 0-2.5 1.6-2.5 4.5s1.1 4.5 2.5 4.5v10" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
    </>
  ),
  flame: <path d="M12 2.5s-5 4.7-5 9.6a5 5 0 0 0 10 0c0-1.7-.9-2.9-1.7-3.9.2 1.6-.6 2.6-1.3 2.6-.9 0-1.3-.9-1-1.9.5-1.7-.2-4-2-6.4Z" />,
  truck: (
    <>
      <rect x="2" y="7" width="12" height="10" rx="1" />
      <path d="M14 10.5h3.6L20.5 14V17h-6.5" />
      <circle cx="6.5" cy="18.5" r="1.6" />
      <circle cx="16.5" cy="18.5" r="1.6" />
    </>
  ),
  barChart: (
    <>
      <path d="M4 20.5h16" />
      <rect x="5.5" y="12" width="3.2" height="8" />
      <rect x="10.4" y="7.5" width="3.2" height="12.5" />
      <rect x="15.3" y="15" width="3.2" height="5" />
    </>
  ),
  clipboardList: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="1.2" />
      <rect x="9" y="2" width="6" height="3.2" rx="0.8" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 4.7L4 16.3l2.7 2.7 5.3-5.3a4 4 0 0 0 4.7-5.4l-2.6 2.6-2-2Z" />,
  sunrise: (
    <>
      <path d="M4 18h16" />
      <path d="M6.5 14.5a5.5 5.5 0 0 1 11 0" />
      <path d="M12 6.5V4M6 8l-1.7-1.7M18 8l1.7-1.7" />
    </>
  ),
  apple: (
    <>
      <path d="M15.5 4c.2 1.4-.9 2.6-2.3 2.7" />
      <path d="M12 8c-3.3 0-6 2.6-6 6.6 0 3.2 2 7 4.3 7 1 0 1.4-.6 2.4-.6.9 0 1.3.6 2.3.6 2.2 0 4.4-4.4 4.4-7.3C19.4 10.7 16.9 8 14 8c-.8 0-1.4.3-2 .3-.6 0-1.2-.3-2-.3Z" />
    </>
  ),
  cookie: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="15" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 3.5 2.5 20h19Z" />
      <path d="M12 9.5v4.2" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.6 2.1" />
    </>
  ),
  x: <path d="M5 5l14 14M19 5 5 19" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4-4" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
