import exifr from 'exifr';

/**
 * Đọc thời gian chụp + GPS từ siêu dữ liệu (B-02). Lỗi/không có → null,
 * không bao giờ ném để tệp khác vẫn vào chuyến.
 */
export async function readMediaExif(buffer) {
  const empty = { takenAt: null, lat: null, lon: null, orientation: 1, width: null, height: null };
  if (!buffer || buffer.length < 12) return empty;
  let data = null;
  try {
    data = await exifr.parse(buffer, {
      gps: true,
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'GPSLatitude',
        'GPSLongitude',
        'Orientation',
        'ExifImageWidth',
        'ExifImageHeight',
        'ImageWidth',
        'ImageHeight',
      ],
    });
  } catch {
    return empty;
  }
  if (!data) return empty;

  const taken = data.DateTimeOriginal || data.CreateDate || data.ModifyDate || null;
  let takenAt = null;
  if (taken instanceof Date && !Number.isNaN(taken.getTime())) {
    takenAt = taken.toISOString();
  } else if (typeof taken === 'string') {
    const parsed = new Date(taken);
    if (!Number.isNaN(parsed.getTime())) takenAt = parsed.toISOString();
  }

  const lat = Number.isFinite(data.latitude) ? data.latitude : null;
  const lon = Number.isFinite(data.longitude) ? data.longitude : null;
  const width = data.ExifImageWidth || data.ImageWidth || null;
  const height = data.ExifImageHeight || data.ImageHeight || null;
  return {
    takenAt,
    // GPS (0,0) là dữ liệu rác của một số máy: coi như không có.
    lat: lat != null && lon != null && !(lat === 0 && lon === 0) ? lat : null,
    lon: lat != null && lon != null && !(lat === 0 && lon === 0) ? lon : null,
    orientation: Number(data.Orientation) || 1,
    width: Number(width) || null,
    height: Number(height) || null,
  };
}

/**
 * Ảnh gửi qua Zalo/Facebook thường mất EXIF nhưng tên tệp vẫn giữ ngày giờ chụp.
 * Nhận các kiểu tên phổ biến của điện thoại:
 *   "2020-01-27 172007", "IMG_20200127_172007", "20200127_172007", "PXL_20200127_172007123",
 *   "Screenshot_2020-01-27-17-20-07", "VID_20200127_172007"
 * Giờ trong tên tệp là giờ máy (mặc định Việt Nam, đổi bằng biến LOCAL_TZ_OFFSET).
 * Không nhận được thì trả null.
 */
export function takenAtFromFilename(name, tzOffset = process.env.LOCAL_TZ_OFFSET || '+07:00') {
  const base = String(name ?? '').replace(/\.[^.]+$/, '');
  let m = base.match(/(?:^|\D)((?:19|20)\d{2})[-_.]?(\d{2})[-_.]?(\d{2})[ _T-]?(\d{2})[-_.:]?(\d{2})[-_.:]?(\d{2})/);
  if (!m) {
    // Chỉ có ngày ("2026-10-04_sinh-nhat-1"): lấy 12 giờ trưa để không lệch sang ngày khác.
    const d = base.match(/(?:^|\D)((?:19|20)\d{2})[-_.](\d{2})[-_.](\d{2})(?!\d)/) ||
      base.match(/(?:^|\D)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/);
    if (!d) return null;
    m = [d[0], d[1], d[2], d[3], '12', '00', '00'];
  }
  const [, y, mo, d, h, mi, s] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tzOffset}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23) return null;
  if (date.getTime() > Date.now() + 86_400_000) return null;
  return date.toISOString();
}

/** Kích thước hiển thị sau khi xoay theo Orientation (5–8 là xoay 90°). */
export function displaySize(width, height, orientation) {
  if (!width || !height) return { width: width || null, height: height || null };
  if ([5, 6, 7, 8].includes(Number(orientation))) {
    return { width: height, height: width };
  }
  return { width, height };
}
