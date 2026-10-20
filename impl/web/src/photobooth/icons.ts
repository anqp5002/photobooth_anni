/** Icon SVG tự vẽ (nét 1,6px, 24x24) — không dùng bộ icon của sản phẩm nào. */

const wrap = (inner: string, size: number): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

const PATHS = {
  camera: '<path d="M3 8.5h3l1.6-2.2h8.8L18 8.5h3v10H3z"/><circle cx="12" cy="13" r="3.4"/>',
  upload: '<path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 15v4h16v-4"/>',
  image:
    '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-5 3.5 3.5L16 12l4 4"/>',
  shield:
    '<path d="M12 3.5 19 6v6.2c0 4-3 6.9-7 8.3-4-1.4-7-4.3-7-8.3V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  laptop: '<rect x="4" y="5" width="16" height="10.5" rx="2"/><path d="M2 19h20"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="M8 5.5 18 12 8 18.5z"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  alert: '<path d="M12 4 2.8 20h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.2v.1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  sound:
    '<path d="M4 10v4h3l4.5 3.5v-11L7 10z"/><path d="M15.5 9.5a3.6 3.6 0 0 1 0 5"/><path d="M18 7a7 7 0 0 1 0 10"/>',
  heart: '<path d="M12 19.5S4 14.6 4 9.6A4.1 4.1 0 0 1 12 7.3a4.1 4.1 0 0 1 8 2.3c0 5-8 9.9-8 9.9z"/>',
} as const;

export type IconName = keyof typeof PATHS;

export const ICONS: Record<IconName, (size?: number) => string> = Object.fromEntries(
  Object.entries(PATHS).map(([name, path]) => [name, (size = 24) => wrap(path, size)]),
) as Record<IconName, (size?: number) => string>;
