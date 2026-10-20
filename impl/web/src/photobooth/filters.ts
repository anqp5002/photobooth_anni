/** 6 bộ lọc (R-104). Cùng một chuỗi CSS cho video xem trước và cho ctx.filter khi chụp. */

export interface FilterDef {
  id: string;
  label: string;
  css: string;
}

export const FILTERS: FilterDef[] = [
  { id: 'none', label: 'Không lọc', css: 'none' },
  { id: 'bw', label: 'Đen trắng', css: 'grayscale(1) contrast(1.06)' },
  { id: 'sepia', label: 'Nâu cổ', css: 'sepia(0.85) saturate(1.1)' },
  {
    id: 'classic',
    label: 'Cổ điển',
    css: 'sepia(0.35) contrast(1.18) saturate(1.35) brightness(1.03)',
  },
  { id: 'cool', label: 'Lạnh', css: 'hue-rotate(-12deg) saturate(1.05) brightness(1.04) contrast(1.04)' },
  { id: 'vivid', label: 'Rực', css: 'saturate(1.9) contrast(1.12)' },
];

export function filterById(id: string): FilterDef {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

/** Video xem trước: lật gương bằng transform, lọc bằng filter (không ảnh hưởng bố cục). */
export function applyPreviewFilter(video: HTMLVideoElement, filterId: string): void {
  video.style.filter = filterById(filterId).css;
}
