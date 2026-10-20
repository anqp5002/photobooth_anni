import path from 'node:path';
import sharp from 'sharp';
import { hourInTimezone, partOfDay, timeInTimezone } from './util.js';

/**
 * B-03 — heuristic chạy local (mặc định `AI_PROVIDER=none`):
 *  - ảnh mờ: phương sai Laplacian thấp
 *  - ảnh gần trùng: dHash khoảng cách Hamming ≤ 6 trong cùng chặng
 *  - tên chặng nháp: "<buổi> ở <địa danh>"
 *  - mô tả nháp: "<n> ảnh, <giờ đầu>–<giờ cuối>"
 * Có chỗ cắm nhà cung cấp LLM; lỗi nhà cung cấp không được chặn việc tạo chuyến.
 */
export const BLUR_VARIANCE_THRESHOLD = 80;
export const DHASH_MAX_DISTANCE = 6;

/** dHash 64 bit từ điểm ảnh xám 9x8 (cạnh nhau: trái > phải). */
export function dhashFromGray(gray, width = 9, height = 8) {
  let hash = 0n;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = gray[y * width + x];
      const right = gray[y * width + x + 1];
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

export function dhashToHex(hash) {
  return hash.toString(16).padStart(16, '0');
}

export function hammingHex(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/** Phương sai của mảng byte (thước đo độ nét). */
export function variance(bytes) {
  if (!bytes || bytes.length === 0) return 0;
  let sum = 0;
  for (const value of bytes) sum += value;
  const mean = sum / bytes.length;
  let acc = 0;
  for (const value of bytes) acc += (value - mean) ** 2;
  return acc / bytes.length;
}

/** Đọc một ảnh (bản lớn) → dấu vân tay dHash + phương sai Laplacian. */
export async function analyzeImage(filePath) {
  const [hashBytes, lapBytes] = await Promise.all([
    sharp(filePath, { failOn: 'none' })
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer(),
    sharp(filePath, { failOn: 'none' })
      .greyscale()
      .resize(320, 320, { fit: 'inside' })
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
      .raw()
      .toBuffer(),
  ]);
  return {
    hash: dhashToHex(dhashFromGray(hashBytes)),
    blurVariance: variance(lapBytes),
  };
}

/** Gọi nhà cung cấp LLM nếu có cấu hình; mặc định không gọi gì. */
async function callProvider(provider, payload) {
  if (!provider || provider === 'none') return null;
  if (/^https?:\/\//i.test(provider)) {
    const res = await fetch(provider, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`AI provider trả ${res.status}`);
    return await res.json();
  }
  throw new Error(`AI_PROVIDER không hỗ trợ: ${provider}`);
}

/**
 * Chấm ảnh mờ/trùng + ghi bản nháp tên/mô tả cho từng chặng.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export async function applyHeuristics(db, tripId, { mediaDir, provider = 'none', timezone = 'UTC' }) {
  const steps = db
    .prepare('SELECT * FROM steps WHERE trip_id = ? AND auto = 1 ORDER BY started_at, id')
    .all(tripId);
  const mediaStmt = db.prepare(
    `SELECT * FROM media WHERE step_id = ? AND type = 'photo'
     ORDER BY COALESCE(taken_at, created_at), id`,
  );
  const updateMedia = db.prepare('UPDATE media SET blurry = ?, near_duplicate = ? WHERE id = ?');
  const updateDraft = db.prepare('UPDATE steps SET draft_name = ?, draft_description = ? WHERE id = ?');

  let providerFailed = false;

  for (const step of steps) {
    const photos = mediaStmt.all(step.id);
    const kept = [];
    for (const photo of photos) {
      const file = path.join(mediaDir, photo.code, 'lg.jpg');
      let blurry = false;
      let nearDuplicate = false;
      try {
        const { hash, blurVariance } = await analyzeImage(file);
        blurry = blurVariance < BLUR_VARIANCE_THRESHOLD;
        nearDuplicate = kept.some((other) => hammingHex(other.hash, hash) <= DHASH_MAX_DISTANCE);
        if (!nearDuplicate) kept.push({ hash, id: photo.id });
      } catch {
        // Không đọc được ảnh thì không kết luận gì.
      }
      updateMedia.run(blurry ? 1 : 0, nearDuplicate ? 1 : 0, photo.id);
    }

    const hour = step.started_at ? hourInTimezone(step.started_at, timezone) : null;
    const part = partOfDay(hour);
    const place = step.place_name;
    const draftName = place ? `${part} ở ${place}` : `${part} trên đường`;
    const photosWithTime = photos.filter((p) => p.taken_at);
    const first = photosWithTime[0]?.taken_at ?? step.started_at;
    const last = photosWithTime[photosWithTime.length - 1]?.taken_at ?? step.started_at;
    const times =
      first && last
        ? `${timeInTimezone(first, timezone)}–${timeInTimezone(last, timezone)}`
        : null;
    const count = db.prepare('SELECT COUNT(*) AS n FROM media WHERE step_id = ?').get(step.id).n;
    const draftDescription = times ? `${count} ảnh, ${times}` : `${count} ảnh`;

    let name = draftName;
    let description = draftDescription;
    if (provider && provider !== 'none') {
      try {
        const suggestion = await callProvider(provider, {
          task: 'goi-y-ten-mo-ta-chang',
          place,
          timeOfDay: part,
          mediaCount: count,
          timeRange: times,
        });
        if (suggestion && typeof suggestion.name === 'string' && suggestion.name.trim()) {
          name = suggestion.name.trim().slice(0, 120);
        }
        if (suggestion && typeof suggestion.description === 'string') {
          description = suggestion.description.trim().slice(0, 500);
        }
      } catch {
        providerFailed = true;
      }
    }
    updateDraft.run(name, description, step.id);
  }

  // Nhà cung cấp AI lỗi: không có gợi ý nào, nhưng chuyến vẫn bình thường (B-03).
  if (providerFailed) {
    db.prepare('UPDATE steps SET draft_name = NULL, draft_description = NULL WHERE trip_id = ?').run(
      tripId,
    );
  }
}
