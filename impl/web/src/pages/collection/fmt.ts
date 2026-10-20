/** Định dạng ngày giờ tiếng Việt cho trang mục (không phụ thuộc Intl của máy chủ). */

const MONTH = [
  'tháng 1',
  'tháng 2',
  'tháng 3',
  'tháng 4',
  'tháng 5',
  'tháng 6',
  'tháng 7',
  'tháng 8',
  'tháng 9',
  'tháng 10',
  'tháng 11',
  'tháng 12',
];

/** "2026-07-12" hoặc ISO → {y, m, d} theo giờ địa phương của máy. */
export function partsOf(iso: string): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(date.getTime())) return null;
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

const WEEKDAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** "12 tháng 7, 2026" */
export function dayLabel(iso: string): string {
  const p = partsOf(iso);
  if (!p) return '';
  return `${p.d} ${MONTH[p.m - 1]}, ${p.y}`;
}

/** "Ngày 1 · Thứ bảy, 12 tháng 7" (tiêu đề mỗi ngày). */
export function weekdayLabel(iso: string): string {
  const p = partsOf(iso);
  if (!p) return '';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return `${WEEKDAY[date.getDay()]}, ${p.d} ${MONTH[p.m - 1]}`;
}

const dayNumber = (iso: string): number => partsOf(iso)?.d ?? 0;

/** "12 đến 14 tháng 7, 2026" · "12 tháng 7, 2026" · "28 tháng 12, 2026 đến 2 tháng 1, 2027" */
export function rangeLabel(startAt: string, endAt: string): string {
  const a = partsOf(startAt);
  const b = partsOf(endAt || startAt);
  if (!a || !b) return '';
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${MONTH[a.m - 1]}, ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d} đến ${b.d} ${MONTH[a.m - 1]}, ${a.y}`;
  if (a.y === b.y) return `${a.d} ${MONTH[a.m - 1]} đến ${b.d} ${MONTH[b.m - 1]}, ${a.y}`;
  return `${a.d} ${MONTH[a.m - 1]}, ${a.y} đến ${b.d} ${MONTH[b.m - 1]}, ${b.y}`;
}

/** "12 tháng 7" (dùng cho nhãn ngắn, không năm). */
export function shortDate(iso: string): string {
  const p = partsOf(iso);
  if (!p) return '';
  return `${p.d} ${MONTH[p.m - 1]}`;
}

export function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export { dayNumber };
