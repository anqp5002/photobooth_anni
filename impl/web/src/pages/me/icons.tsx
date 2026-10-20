import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
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

export const FolderIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 7.5h6l1.8 2.2h9.2v8.1a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    <path d="M3.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4.6l1.9 2.2h7a2 2 0 0 1 2 2v1" />
  </Base>
);

export const InboxIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 13.5h4l1.5 2.5h6l1.5-2.5h4" />
    <path d="M5.6 5.5h12.8l2.1 8v3a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-3z" />
  </Base>
);

export const UploadIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V3.5" />
    <path d="M7.5 8 12 3.5 16.5 8" />
    <path d="M4 14.5v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </Base>
);

export const SparkleIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5l1.7 4.8L18.5 10l-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z" />
    <path d="M18.5 3v3M17 4.5h3M5.5 16v3M4 17.5h3" />
  </Base>
);

export const MergeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 4v4.5a4 4 0 0 0 4 4h6" />
    <path d="M5 20v-4.5a4 4 0 0 1 4-4h6" />
    <path d="M15 9l3 3.5-3 3.5" />
  </Base>
);

export const SplitIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5v17" />
    <path d="M8 8 4.5 11.5 8 15" />
    <path d="M16 8l3.5 3.5L16 15" />
  </Base>
);

export const EyeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const EyeOffIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4l16 16" />
    <path d="M9.5 5.9A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4" />
    <path d="M6.2 7.8A17.3 17.3 0 0 0 2.5 12S6 18.5 12 18.5a9.8 9.8 0 0 0 3.5-.65" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Base>
);

export const PhotoIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M3.5 16.5l4.6-4.2 3.6 3.2 3.1-2.6 5.7 5" />
  </Base>
);

export const VideoIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
    <path d="M15.5 10.5l6-3v9l-6-3z" />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Base>
);

export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6.5h16" />
    <path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
    <path d="M6.5 6.5l.9 12.2a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12.2" />
  </Base>
);

export const LinkIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
    <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" />
  </Base>
);

export const ExitIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9.5 4.5H5a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 5 19.5h4.5" />
    <path d="M14 8l4 4-4 4M8.5 12H18" />
  </Base>
);
