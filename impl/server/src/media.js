/** Đường dẫn ảnh theo hợp đồng: /media/<mã>/{orig,lg,sm}.<đuôi> */
export const MEDIA_CACHE_HEADER = 'public, max-age=31536000, immutable';

export function mediaUrls(media) {
  return {
    orig: `/media/${media.code}/orig.${media.ext}`,
    lg: `/media/${media.code}/lg.jpg`,
    sm: `/media/${media.code}/sm.jpg`,
  };
}

/** `ai_tags` lưu JSON array; đọc hỏng thì trả mảng rỗng. */
export function parseTags(value) {
  if (Array.isArray(value)) return value.filter((tag) => typeof tag === 'string');
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag) => typeof tag === 'string');
  } catch {
    return [];
  }
}

/**
 * Ảnh/video theo hợp đồng r2:
 * `{id,type,takenAt,place,country,lat,lon,caption,tags[],score,collectionId,
 *   width,height,url:{sm,lg,orig},flags:{blurry,nearDuplicate,hidden},aiStatus}`
 */
export function serializeMedia(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    takenAt: row.taken_at ?? null,
    place: row.place ?? null,
    country: row.country ?? null,
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    caption: row.ai_caption ?? null,
    tags: parseTags(row.ai_tags),
    score: row.ai_score ?? null,
    collectionId: row.collection_id ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    url: mediaUrls(row),
    flags: {
      blurry: Boolean(row.blurry),
      nearDuplicate: Boolean(row.near_duplicate),
      hidden: Boolean(row.hidden),
    },
    aiStatus: row.ai_status ?? 'pending',
  };
}

/** Ảnh bìa gọn cho danh sách mục/tổng kết. */
export function mediaCover(row) {
  if (!row) return null;
  return { sm: mediaUrls(row).sm, lg: mediaUrls(row).lg };
}
