const HOUR = 3_600_000;
const DAY = 86_400_000;

function parts(iso: string, timeZone: string) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** Số ngày lịch kể từ đầu chuyến (ngày đầu = 1) — R-007. */
export function dayIndex(startIso: string, iso: string, timeZone = 'Asia/Ho_Chi_Minh'): number {
  const a = parts(startIso, timeZone);
  const b = parts(iso, timeZone);
  const ta = Date.UTC(Number(a.year), Number(a.month) - 1, Number(a.day));
  const tb = Date.UTC(Number(b.year), Number(b.month) - 1, Number(b.day));
  return Math.round((tb - ta) / DAY) + 1;
}

/** Ngày bắt đầu chuyến tính bằng ngày lịch trong múi giờ của chuyến. */
export function startDayIndex(iso: string, timeZone = 'Asia/Ho_Chi_Minh'): number {
  return dayIndex(iso, iso, timeZone);
}

export function formatDate(iso: string, timeZone = 'Asia/Ho_Chi_Minh'): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDayMonth(iso: string, timeZone = 'Asia/Ho_Chi_Minh'): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
}

export function formatLongDate(iso: string, timeZone = 'Asia/Ho_Chi_Minh'): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

/** "đã đi 2 giờ" / "đã đi 3 ngày" — R-005. */
export function travelLabel(fromIso: string, toIso: string): string {
  const hours = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / HOUR;
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return `đã đi ${h} giờ`;
  }
  const d = Math.max(1, Math.round(hours / 24));
  return `đã đi ${d} ngày`;
}

/** Số ngày của chuyến: từ ngày bắt đầu tới hôm nay nếu chưa kết thúc — R-008. */
export function tripDays(startIso: string, endedAt: string | null, timeZone = 'Asia/Ho_Chi_Minh'): number {
  const endIso = endedAt ?? new Date().toISOString();
  return Math.max(1, dayIndex(startIso, endIso, timeZone));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

export function formatKm(n: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} km`;
}

export function isWithinHours(iso: string, hours: number): boolean {
  return Date.now() - new Date(iso).getTime() <= hours * HOUR;
}

/** Ngày giờ rút gọn dùng trong thẻ chặng: "27 thg 7" */
export function formatCardDate(iso: string, timeZone = 'Asia/Ho_Chi_Minh'): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone, day: '2-digit', month: '2-digit' }).format(new Date(iso));
}
