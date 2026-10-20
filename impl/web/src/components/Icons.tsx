import type { ReactElement, SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function Base({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16.5 16.5L21 21" />
  </Base>
);

export const ShareIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="18" cy="5" r="2.6" />
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="19" r="2.6" />
    <path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" />
  </Base>
);

export const CameraIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 8.5A2 2 0 0 1 5 6.5h2l1.3-2h7.4L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="13" r="3.6" />
  </Base>
);

export const HomeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 11.2L12 4l8 7.2" />
    <path d="M6.5 10v9.5h11V10" />
  </Base>
);

export const HeartIcon = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Base {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7.2-4.4-8.8-8.6A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.8 4.8C19.2 15.6 12 20 12 20z" />
  </Base>
);

export const CommentIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 20.5l1.4-3.7A6.6 6.6 0 0 1 4 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7z" />
  </Base>
);

export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Base>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Base>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9.5 5.5L16 12l-6.5 6.5" />
  </Base>
);

export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const MinusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);

export const PersonIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="13" cy="4.6" r="2.1" />
    <path d="M11 21l1.4-6-2.6-2.4.8-4.4 3.6 1.6 3 1.6" />
    <path d="M10.2 8.2L7 11.4l.6 3.2 3-1" />
    <path d="M12.4 15l3.6 6" />
  </Base>
);

export const GlobeIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 2.6 15 0 18M12 3c-2.6 2.6-2.6 15 0 18" />
  </Base>
);

export const MenuIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);

export const PlayIcon = (p: IconProps) => (
  <Base {...p} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </Base>
);

export const PinIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s6.5-6.2 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 14.8 12 21 12 21z" />
    <circle cx="12" cy="10.3" r="2.4" />
  </Base>
);

export const CalendarIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Base>
);

export const InfoIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
  </Base>
);

export const SatelliteIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12a8 8 0 0 1 8-8" />
    <path d="M4 16a12 12 0 0 1 12-12" />
    <path d="M4 8a16 16 0 0 1 16-4" />
    <circle cx="16.5" cy="16.5" r="3.5" />
  </Base>
);

export const LayersIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3.5 12.5L12 17l8.5-4.5" />
    <path d="M3.5 16.5L12 21l8.5-4.5" />
  </Base>
);

/* --- Thời tiết --- */

const SunRays = () => (
  <g>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </g>
);

export const SunnyIcon = (p: IconProps) => (
  <Base {...p}>
    <SunRays />
  </Base>
);

export const CloudyIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8.5" cy="8" r="3" />
    <path d="M18 19H8a4 4 0 0 1-.4-8 5 5 0 0 1 9.6 1.2A3.4 3.4 0 0 1 18 19z" />
  </Base>
);

export const RainIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M17.6 15.5H7.4a4 4 0 0 1-.4-8 5 5 0 0 1 9.6 1.2 3.4 3.4 0 0 1 1 6.8z" />
    <path d="M9 18.5l-1 2.6M13 18.5l-1 2.6M17 18.5l-1 2.6" />
  </Base>
);

export const SnowIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M17.6 14.5H7.4a4 4 0 0 1-.4-8 5 5 0 0 1 9.6 1.2 3.4 3.4 0 0 1 1 6.8z" />
    <path d="M9 19h.01M12 21h.01M15 19h.01" />
    <path d="M8.6 18.2l1.6 1.6M13.4 18.2l-1.6 1.6" />
  </Base>
);

export const HotIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 14.8V5.5a2.5 2.5 0 0 1 5 0v9.3a4.5 4.5 0 1 1-5 0z" />
    <path d="M12.5 8.5v6" />
  </Base>
);

export const WEATHER_ICONS: Record<string, (p: IconProps) => ReactElement> = {
  sunny: SunnyIcon,
  cloudy: CloudyIcon,
  rain: RainIcon,
  snow: SnowIcon,
  hot: HotIcon,
};
