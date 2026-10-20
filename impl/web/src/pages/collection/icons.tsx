import type { SVGProps } from 'react';

/** Icon nét đơn giản dùng riêng trang mục (giữ trong vùng của coder-2). */
function Base({ size = 20, children, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
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

export const SparkleIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </Base>
);

export const MenuIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Base>
);

export const CloseIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const SearchIcon = (p: { size?: number }) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </Base>
);

export const UploadIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M4 20h16" />
  </Base>
);

export const BackIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

export const PrevIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

export const NextIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
);

export const ImageIcon = (p: { size?: number }) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </Base>
);

export const AlertIcon = (p: { size?: number }) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6" />
    <path d="M12 17h.01" />
  </Base>
);

export const RefreshIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </Base>
);

export const PencilIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </Base>
);

export const MergeIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M4 5h5l4 6h7" />
    <path d="M4 19h5l4-6" />
    <path d="M17 8l3 3-3 3" />
  </Base>
);

export const SplitIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M4 8h5l4 4h7" />
    <path d="M4 16h5l4-4" />
    <path d="M17 5l3 3-3 3" />
    <path d="M17 13l3 3-3 3" />
  </Base>
);

export const PersonIcon = (p: { size?: number }) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.6-4 3.4-6 7-6s6.4 2 7 6" />
  </Base>
);

export const CameraIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M3 8.5A2 2 0 0 1 5 6.5h2l1.3-2h7.4L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="13" r="3.4" />
  </Base>
);

export const MapIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Base>
);

export const CheckIcon = (p: { size?: number }) => (
  <Base {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Base>
);
