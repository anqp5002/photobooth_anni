import crypto from 'node:crypto';

/** Lỗi HTTP có mã trạng thái và mã lỗi dạng `{error}`. */
export class HttpError extends Error {
  constructor(status, code, detail) {
    super(code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export const badRequest = (code = 'bad_request', detail) => new HttpError(400, code, detail);
export const unauthorized = () => new HttpError(401, 'unauthorized');
export const forbidden = (code = 'forbidden') => new HttpError(403, code);
export const notFound = () => new HttpError(404, 'not_found');

const VIET_MAP = {
  đ: 'd',
  Đ: 'D',
};

/** Bỏ dấu tiếng Việt rồi tạo slug ASCII. */
export function slugify(input, { maxLength = 64 } = {}) {
  const raw = String(input ?? '');
  const ascii = raw
    .replace(/[đĐ]/g, (ch) => VIET_MAP[ch])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (ascii || 'hanh-trinh').slice(0, maxLength).replace(/-+$/g, '');
}

/** Mã ngẫu nhiên an toàn cho URL/tên thư mục. */
export function randomCode(bytes = 12) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export const nowIso = () => new Date().toISOString();

export function round2(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Math.round(Number(value) * 100) / 100;
}

/** Khoảng cách haversine (km). */
export function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371.0088;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Số ngày lịch giữa hai mốc (làm tròn xuống theo ngày UTC). */
export function calendarDays(from, to) {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.max(0, Math.round((end - start) / 86400000));
}

/** Giờ địa phương của một mốc theo múi giờ IANA (0–23). */
export function hourInTimezone(iso, timeZone = 'UTC') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    });
    const hour = Number(fmt.format(date));
    return Number.isFinite(hour) ? hour % 24 : null;
  } catch {
    return date.getUTCHours();
  }
}

/** Nhãn buổi trong ngày theo giờ địa phương. */
export function partOfDay(hour) {
  if (hour == null) return 'Chuyến đi';
  if (hour >= 5 && hour < 12) return 'Buổi sáng';
  if (hour >= 12 && hour < 18) return 'Buổi chiều';
  if (hour >= 18 && hour < 23) return 'Buổi tối';
  return 'Ban đêm';
}

/** "08:12" theo múi giờ cho trước. */
export function timeInTimezone(iso, timeZone = 'UTC') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  }
}

/** Đọc tham số số nguyên có giới hạn. */
export function intParam(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Bỏ các khoá `undefined` để JSON gọn. */
export function compact(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}
