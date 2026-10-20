import { serializeCollection } from './collections.js';
import { serializeMedia } from './media.js';
import { hourInTimezone, nowIso, partOfDay, round2 } from './util.js';

export const HOME_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const RECENT_LIMIT = 12;
export const TIMELINE_PAGE_DAYS = 20;
export const RECAP_HIGHLIGHTS = 4;
export const MAP_POINT_LIMIT = 200;
export const PREVIEW_POINT_LIMIT = 12;
export const TOP_PLACES_LIMIT = 6;

/** `"2026-01-01"` … `"2027-01-01"` — so sánh chuỗi ISO là đủ. */
export function yearRange(year) {
  const y = Number(year);
  return { from: `${y}-01-01`, to: `${y + 1}-01-01` };
}

export function greeting(now = new Date()) {
  const hour = hourInTimezone(now.toISOString(), HOME_TIMEZONE);
  return `Chào ${partOfDay(hour).toLowerCase()}`;
}

/** Mốc thời gian dùng để xếp ảnh: `taken_at`, thiếu thì `created_at`. */
const AT = 'COALESCE(taken_at, created_at)';

export function yearMedia(db, familyId, year, { limit = null } = {}) {
  const { from, to } = yearRange(year);
  const cap = Number.isFinite(limit) && limit > 0 ? ` LIMIT ${Math.trunc(limit)}` : '';
  return db
    .prepare(
      `SELECT * FROM media
       WHERE family_id = ? AND hidden = 0 AND ${AT} >= ? AND ${AT} < ?
       ORDER BY ${AT} DESC, id DESC${cap}`,
    )
    .all(Number(familyId), from, to);
}

export function yearCollections(db, familyId, year) {
  const { from, to } = yearRange(year);
  return db
    .prepare(
      `SELECT * FROM collections
       WHERE family_id = ? AND start_at >= ? AND start_at < ?
       ORDER BY start_at, id`,
    )
    .all(Number(familyId), from, to);
}

export function countStats(rows, collections = []) {
  const places = new Set();
  let photos = 0;
  let videos = 0;
  for (const row of rows) {
    if (row.type === 'video') videos += 1;
    else photos += 1;
    if (row.place) places.add(row.place);
  }
  return { photos, videos, places: places.size, collections: collections.length };
}

export function topPlaces(rows, limit = TOP_PLACES_LIMIT) {
  const counts = new Map();
  for (const row of rows) {
    if (!row.place) continue;
    counts.set(row.place, (counts.get(row.place) ?? 0) + 1);
  }
  return [...counts]
    .map(([place, count]) => ({ place, count }))
    .sort((a, b) => b.count - a.count || a.place.localeCompare(b.place))
    .slice(0, limit);
}

const hasCoords = (row) => Number.isFinite(row.lat) && Number.isFinite(row.lon);

function bestOf(rows) {
  return [...rows].sort(
    (a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0) || String(a.id).localeCompare(String(b.id)),
  )[0];
}

/**
 * Điểm trên bản đồ: gom theo mục + ô ~2 km, kèm ảnh bìa đầy đủ (Media) và số ảnh.
 * `id` = id mục khi cụm thuộc một mục (web bấm ra mục), ngược lại `p<n>`.
 */
export function mapPoints(rows, { limit = MAP_POINT_LIMIT } = {}) {
  const buckets = new Map();
  for (const row of rows) {
    if (!hasCoords(row)) continue;
    const key = `${row.collection_id ?? 0}|${Math.round(row.lat * 50)}|${Math.round(row.lon * 50)}`;
    const bucket = buckets.get(key) ?? { rows: [], collectionId: row.collection_id ?? null };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .map((bucket, index) => {
      const cover = bestOf(bucket.rows);
      return {
        id: bucket.collectionId ?? `p${index + 1}`,
        lat: round2(bucket.rows.reduce((sum, row) => sum + row.lat, 0) / bucket.rows.length),
        lon: round2(bucket.rows.reduce((sum, row) => sum + row.lon, 0) / bucket.rows.length),
        place: bucket.rows.find((row) => row.place)?.place ?? null,
        count: bucket.rows.length,
        // Hợp đồng r2: `cover` là MỘT Media đầy đủ (có id/url/flags…), không phải {sm,lg}.
        cover: cover ? serializeMedia(cover) : null,
        collectionId: bucket.collectionId,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(1, limit));
}

/** Kỷ niệm cùng ngày (tháng-ngày) ở các năm trước; lấy năm gần nhất có ảnh. */
export function onThisDay(db, familyId, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const currentYear = Number(day.slice(0, 4));
  const monthDay = day.slice(5, 10);
  const rows = db
    .prepare(
      `SELECT * FROM media
       WHERE family_id = ? AND hidden = 0 AND substr(${AT}, 6, 5) = ?
         AND substr(${AT}, 1, 4) < ?
       ORDER BY ${AT} DESC, id DESC`,
    )
    .all(Number(familyId), monthDay, String(currentYear));
  if (rows.length === 0) return null;
  const year = Number(String(rows[0].taken_at ?? rows[0].created_at).slice(0, 4));
  const sameDay = rows.filter((row) => Number(String(row.taken_at ?? row.created_at).slice(0, 4)) === year);
  // Hợp đồng r2: `media` là MỘT Media (ảnh đẹp nhất ngày đó), không phải mảng.
  return { yearsAgo: currentYear - year, date: `${year}-${monthDay}`, media: serializeMedia(bestOfMany(sameDay, 1)[0]) };
}

/** Gom ảnh theo ngày (mới nhất trước) rồi cắt trang theo `cursor` = số ngày đã trả. */
export function timeline(db, familyId, { year, cursor = 0 } = {}) {
  const rows = db
    .prepare(
      `SELECT * FROM media
       WHERE family_id = ? AND hidden = 0 AND ${AT} >= ? AND ${AT} < ?
       ORDER BY ${AT} DESC, id DESC`,
    )
    .all(Number(familyId), ...Object.values(yearRange(year)));

  const days = [];
  const byDate = new Map();
  for (const row of rows) {
    const date = String(row.taken_at ?? row.created_at).slice(0, 10);
    let day = byDate.get(date);
    if (!day) {
      day = { date, collectionId: null, media: [], picks: new Map() };
      byDate.set(date, day);
      days.push(day);
    }
    day.media.push(serializeMedia(row));
    if (row.collection_id != null) {
      day.picks.set(row.collection_id, (day.picks.get(row.collection_id) ?? 0) + 1);
    }
  }
  for (const day of days) {
    let best = null;
    for (const [collectionId, count] of day.picks) {
      if (!best || count > best.count) best = { collectionId, count };
    }
    day.collectionId = best?.collectionId ?? null;
    delete day.picks;
  }

  const start = Math.max(0, Math.trunc(Number(cursor) || 0));
  const page = days.slice(start, start + TIMELINE_PAGE_DAYS);
  const months = [];
  let current = null;
  for (const day of page) {
    const month = Number(day.date.slice(5, 7));
    if (!current || current.month !== month) {
      current = { month, days: [] };
      months.push(current);
    }
    current.days.push(day);
  }
  const next = start + TIMELINE_PAGE_DAYS;
  return { months, nextCursor: next < days.length ? String(next) : null };
}

function statsHash(payload) {
  return JSON.stringify(payload);
}

export function sampleIntro({ year, stats, topPlaces: places = [] }) {
  const parts = [
    `Năm ${year}, nhà mình có ${stats.photos} tấm ảnh và ${stats.videos} video, ở ${stats.places} nơi, gói trong ${stats.collections} mục.`,
  ];
  if (places[0]) parts.push(`Nơi xuất hiện nhiều nhất là ${places[0].place} với ${places[0].count} ảnh.`);
  if (stats.trips) parts.push(`Cả nhà có ${stats.trips} chuyến đi.`);
  return parts.join(' ');
}

/** Câu mở đầu cho trang tổng kết: LLM viết từ số liệu, cache trong bảng `recaps`. */
export async function recapIntro(db, familyId, { year, stats, places, provider = null }) {
  const hash = statsHash({ stats, places });
  const cached = db
    .prepare('SELECT * FROM recaps WHERE family_id = ? AND year = ?')
    .get(Number(familyId), Number(year));
  if (cached && cached.stats_hash === hash && cached.intro) {
    return { intro: cached.intro, cached: true, source: cached.source };
  }

  const sample = sampleIntro({ year, stats, topPlaces: places });
  // Đang có câu cũ (số liệu đã đổi) thì dùng tạm câu cũ, không để trang trắng.
  const fallback = cached?.intro
    ? { intro: cached.intro, cached: true, source: cached.source }
    : { intro: sample, cached: false, source: 'sample' };
  if (!provider?.recapIntro) return fallback;

  // Không bao giờ bắt trang tổng kết chờ AI: chờ tối đa INTRO_WAIT_MS, quá thì trả câu
  // tạm và để AI viết tiếp ở nền (lưu cache cho lần xem sau). Mỗi gia đình/năm chỉ
  // có một lượt viết đang chạy.
  const key = `${Number(familyId)}:${Number(year)}`;
  let job = introJobs.get(key);
  if (!job || job.hash !== hash) {
    const promise = (async () => {
      try {
        const raw = await provider.recapIntro({ year: Number(year), stats, topPlaces: places, sample });
        const text = String(raw ?? '').trim();
        if (text.length < 20) return null;
        const intro = text.slice(0, 400);
        const stamp = nowIso();
        db.prepare(
          `INSERT INTO recaps (family_id, year, stats_hash, intro, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(family_id, year) DO UPDATE SET
             stats_hash = excluded.stats_hash, intro = excluded.intro,
             source = excluded.source, updated_at = excluded.updated_at`,
        ).run(Number(familyId), Number(year), hash, intro, 'ai', stamp, stamp);
        return intro;
      } catch {
        return null;
      } finally {
        if (introJobs.get(key)?.hash === hash) introJobs.delete(key);
      }
    })();
    job = { hash, promise };
    introJobs.set(key, job);
  }

  const timeout = new Promise((resolve) => setTimeout(() => resolve(undefined), INTRO_WAIT_MS).unref?.());
  const intro = await Promise.race([job.promise, timeout]);
  if (intro) return { intro, cached: false, source: 'ai' };
  return fallback;
}

/** Thời gian tối đa trang tổng kết chờ AI viết câu mở đầu. */
const INTRO_WAIT_MS = Number(process.env.RECAP_INTRO_WAIT_MS || 2500);
/** Lượt viết câu mở đầu đang chạy, theo "familyId:year". */
const introJobs = new Map();

/**
 * `GET /api/recap/:year`: số liệu + chương theo tháng + nơi nhiều ảnh + câu mở đầu.
 */
export async function recapFor(db, familyId, year, { provider = null } = {}) {
  const rows = yearMedia(db, familyId, year);
  const collections = yearCollections(db, familyId, year);
  const stats = {
    ...countStats(rows, collections),
    birthdays: collections.filter((row) => row.kind === 'birthday').length,
    trips: collections.filter((row) => row.kind === 'trip').length,
  };
  const places = topPlaces(rows);

  const byMonth = new Map();
  for (const row of rows) {
    const month = Number(String(row.taken_at ?? row.created_at).slice(5, 7));
    const list = byMonth.get(month) ?? [];
    list.push(row);
    byMonth.set(month, list);
  }
  // Chương = tháng CÓ mục: hợp đồng r2 cấm `chapters[].collection = null`, nên tháng chỉ có
  // ảnh lẻ (chưa gom mục) không thành chương. Sắp theo tháng.
  const monthsWithCollection = new Map(); // month -> collection (mục đầu tiên của tháng)
  for (const row of collections) {
    const month = Number(String(row.start_at).slice(5, 7));
    if (!Number.isFinite(month) || month < 1 || month > 12) continue;
    if (!monthsWithCollection.has(month)) monthsWithCollection.set(month, row);
  }
  const months = [...monthsWithCollection.keys()].sort((a, b) => a - b);

  const chapters = months.map((month) => {
    const collection = monthsWithCollection.get(month);
    const highlights = bestOfMany(byMonth.get(month) ?? [], RECAP_HIGHLIGHTS);
    return {
      month,
      collection: serializeCollection(db, collection),
      highlights: highlights.map(serializeMedia),
    };
  });

  const intro = await recapIntro(db, familyId, { year, stats, places, provider });
  return { year: Number(year), intro: intro.intro, introSource: intro.source, stats, chapters, topPlaces: places };
}

/** Ảnh nổi bật: điểm AI cao trước, cùng điểm thì ảnh cũ hơn đứng trước cho ổn định. */
export function bestOfMany(rows, limit) {
  return [...rows]
    .sort(
      (a, b) =>
        (b.ai_score ?? 0) - (a.ai_score ?? 0) ||
        String(a.taken_at ?? a.created_at).localeCompare(String(b.taken_at ?? b.created_at)) ||
        a.id - b.id,
    )
    .slice(0, limit);
}

/** Trang chủ: lời chào, số liệu năm nay, ảnh mới, mục năm nay, kỷ niệm, điểm bản đồ. */
export function homeFor(db, familyId, { now = new Date() } = {}) {
  const year = now.getUTCFullYear();
  const rows = yearMedia(db, familyId, year);
  const collections = yearCollections(db, familyId, year);
  const recent = db
    .prepare(
      `SELECT * FROM media WHERE family_id = ? AND hidden = 0
       ORDER BY ${AT} DESC, id DESC LIMIT ?`,
    )
    .all(Number(familyId), RECENT_LIMIT);

  const allPoints = db
    .prepare(
      `SELECT * FROM media
       WHERE family_id = ? AND hidden = 0 AND lat IS NOT NULL AND lon IS NOT NULL`,
    )
    .all(Number(familyId));

  return {
    greeting: greeting(now),
    stats: countStats(rows, collections),
    recent: recent.map(serializeMedia),
    collections: collections.map((row) => serializeCollection(db, row)),
    onThisDay: onThisDay(db, familyId, now),
    mapPreview: { points: mapPoints(allPoints, { limit: PREVIEW_POINT_LIMIT }) },
  };
}

/** `GET /api/map`: điểm ảnh theo năm / theo mục. */
export function mapFor(db, familyId, { year, collectionId = null } = {}) {
  const params = [Number(familyId)];
  let sql = `SELECT * FROM media
             WHERE family_id = ? AND hidden = 0 AND lat IS NOT NULL AND lon IS NOT NULL`;
  if (collectionId != null) {
    sql += ' AND collection_id = ?';
    params.push(Number(collectionId));
  } else if (year != null) {
    const { from, to } = yearRange(year);
    sql += ` AND ${AT} >= ? AND ${AT} < ?`;
    params.push(from, to);
  }
  sql += ' ORDER BY id';
  return { points: mapPoints(db.prepare(sql).all(...params)) };
}
