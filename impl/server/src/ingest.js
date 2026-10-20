import fs from 'node:fs/promises';
import path from 'node:path';
import { detectMediaType, readMp4CreationTime, readMp4Duration, readMp4VideoSize } from './media-type.js';
import { displaySize, readMediaExif, takenAtFromFilename } from './exif.js';
import { probeImageSize, storePhotoRenditions, storeVideoRenditions } from './images.js';
import { randomCode } from './util.js';

/**
 * Nhận một tệp tải lên: kiểm loại bằng chữ ký nhị phân, lưu gốc + 2 cỡ ảnh,
 * đọc EXIF. Tệp lạ bị từ chối với lý do "không phải ảnh/video".
 * @returns {Promise<{ok: true, media: object} | {ok: false, reason: string}>}
 */
export async function ingestFile({ buffer, filename, mediaDir }) {
  const kind = detectMediaType(buffer);
  if (!kind) return { ok: false, reason: 'không phải ảnh/video' };

  const code = randomCode(12);
  const dir = path.join(mediaDir, code);
  try {
    const exif = await readMediaExif(buffer);
    if (kind.kind === 'photo') {
      let size = { width: exif.width, height: exif.height };
      if (!size.width || !size.height) size = await probeImageSize(buffer);
      const shown = displaySize(size.width, size.height, exif.orientation ?? 1);
      const out = await storePhotoRenditions({
        buffer,
        dir,
        ext: kind.ext,
        width: shown.width,
        height: shown.height,
      });
      return {
        ok: true,
        media: {
          type: 'photo',
          code,
          ext: kind.ext,
          origName: String(filename ?? '').slice(0, 200) || `photo.${kind.ext}`,
          width: out.width ?? shown.width ?? null,
          height: out.height ?? shown.height ?? null,
          duration: null,
          takenAt: exif.takenAt ?? takenAtFromFilename(filename),
          lat: exif.lat,
          lon: exif.lon,
        },
      };
    }

    const duration = readMp4Duration(buffer);
    const createdAt = readMp4CreationTime(buffer);
    const videoSize = readMp4VideoSize(buffer);
    await storeVideoRenditions({ buffer, dir, ext: kind.ext });
    return {
      ok: true,
      media: {
        type: 'video',
        code,
        ext: kind.ext,
        origName: String(filename ?? '').slice(0, 200) || `video.${kind.ext}`,
        width: videoSize?.width ?? null,
        height: videoSize?.height ?? null,
        duration: Number.isFinite(duration) ? Math.round(duration * 1000) / 1000 : null,
        takenAt: exif.takenAt ?? createdAt ?? takenAtFromFilename(filename),
        lat: exif.lat,
        lon: exif.lon,
      },
    };
  } catch {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return { ok: false, reason: 'không đọc được tệp' };
  }
}

/**
 * Ghi một tệp đã xử lý vào bảng media.
 * Ảnh r2 thuộc gia đình; truyền `tripId` (dữ liệu r1) thì lấy family/uploader từ chuyến.
 */
export function insertMedia(
  db,
  tripId,
  media,
  { stepId = null, auto = 1, familyId = null, uploaderId = null, collectionId = null } = {},
) {
  let family = familyId;
  let uploader = uploaderId;
  if (tripId != null) {
    const trip = db.prepare('SELECT user_id, family_id FROM trips WHERE id = ?').get(Number(tripId));
    if (trip) {
      family = family ?? trip.family_id;
      uploader = uploader ?? trip.user_id;
    }
  }
  if (family == null) throw new Error('insertMedia: thiếu family_id');
  const info = db
    .prepare(
      `INSERT INTO media (family_id, uploader_id, trip_id, step_id, collection_id, type, code, ext,
        orig_name, width, height, duration, taken_at, lat, lon, place, country, order_index,
        created_at, auto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(
      Number(family),
      uploader == null ? null : Number(uploader),
      tripId == null ? null : Number(tripId),
      stepId,
      collectionId,
      media.type,
      media.code,
      media.ext,
      media.origName ?? null,
      media.width ?? null,
      media.height ?? null,
      media.duration ?? null,
      media.takenAt ?? null,
      media.lat ?? null,
      media.lon ?? null,
      media.place ?? null,
      media.country ?? null,
      new Date().toISOString(),
      auto,
    );
  return Number(info.lastInsertRowid);
}
