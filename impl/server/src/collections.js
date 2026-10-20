import { serializeMedia } from './media.js';
import { ensureSuggestion, listSuggestions } from './suggestions.js';
import { distanceKm } from './util.js';
import { syncMediaFts } from './fts.js';

/** Ngưỡng gom mục (MEGAPLAN): cách nhau > 6 giờ hoặc > 30 km thì tách. */
export const GROUP_GAP_MS = 6 * 60 * 60 * 1000;
export const GROUP_DISTANCE_KM = 30;
/** Xa "nhà" quá 50 km và nhiều ngày liền = chuyến đi. */
export const HOME_FAR_KM = 50;
/** Hai cụm xa nhà cùng nơi, cách ≤ 36 giờ thì gộp thành một chuyến. */
export const TRIP_JOIN_MS = 36 * 60 * 60 * 1000;
/** Mục có từng này ảnh trở lên thì gợi ý tách. */
export const SPLIT_HINT_PHOTOS = 18;
const MIN_GROUP_PHOTOS = 2;

export const COLLECTION_KINDS = ['trip', 'birthday', 'tet', 'holiday', 'weekend', 'everyday', 'baby', 'other'];

/** Mùng 1 Tết âm lịch (để LLM/heuristic nhận ra ảnh Tết). */
export const TET_DAYS = {
  2024: '2024-02-10',
  2025: '2025-01-29',
  2026: '2026-02-17',
  2027: '2027-02-06',
};

const hasCoords = (row) => Number.isFinite(row.lat) && Number.isFinite(row.lon);
const timeOf = (row) => Date.parse(row.taken_at ?? row.created_at ?? '') || null;

/** "Nhà" = cụm toạ độ có nhiều ảnh nhất (lưới ~5,5 km). */
export function homePoint(rows) {
  const buckets = new Map();
  for (const row of rows) {
    if (!hasCoords(row)) continue;
    const key = `${Math.round(row.lat * 20)}:${Math.round(row.lon * 20)}`;
    const bucket = buckets.get(key) ?? { count: 0, lat: 0, lon: 0 };
    bucket.count += 1;
    bucket.lat += row.lat;
    bucket.lon += row.lon;
    buckets.set(key, bucket);
  }
  let best = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) return null;
  return { lat: best.lat / best.count, lon: best.lon / best.count };
}

/** Chia ảnh thành cụm theo thời gian + khoảng cách (hàm thuần, dễ test). */
export function groupMedia(rows, { gapMs = GROUP_GAP_MS, maxKm = GROUP_DISTANCE_KM } = {}) {
  const sorted = rows
    .filter((row) => timeOf(row) != null)
    .sort((a, b) => timeOf(a) - timeOf(b) || a.id - b.id);
  const groups = [];
  let current = [];
  for (const row of sorted) {
    const prev = current[current.length - 1];
    if (!prev) {
      current = [row];
      continue;
    }
    const gap = timeOf(row) - timeOf(prev);
    const far = hasCoords(prev) && hasCoords(row) ? distanceKm(prev, row) : 0;
    if (gap > gapMs || far > maxKm) {
      groups.push(current);
      current = [row];
    } else {
      current.push(row);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

export function centroid(rows) {
  const withCoords = rows.filter(hasCoords);
  if (withCoords.length === 0) return null;
  return {
    lat: withCoords.reduce((sum, row) => sum + row.lat, 0) / withCoords.length,
    lon: withCoords.reduce((sum, row) => sum + row.lon, 0) / withCoords.length,
  };
}

/** Nơi xuất hiện nhiều nhất trong cụm. */
export function dominantPlace(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!row.place) continue;
    counts.set(row.place, (counts.get(row.place) ?? 0) + 1);
  }
  let best = null;
  for (const [place, count] of counts) {
    if (!best || count > best.count) best = { place, count };
  }
  return best?.place ?? null;
}

/** Ảnh rơi vào dịp Tết âm lịch (±7 ngày). */
export function isTetDate(iso) {
  const time = Date.parse(iso ?? '');
  if (!Number.isFinite(time)) return false;
  for (const day of Object.values(TET_DAYS)) {
    if (Math.abs(time - Date.parse(`${day}T00:00:00Z`)) <= 7 * 86400000) return true;
  }
  return false;
}

export function kindHeuristic(rows, home) {
  if (rows.some((row) => isTetDate(row.taken_at ?? row.created_at))) return 'tet';
  const center = centroid(rows);
  const far = home && center ? distanceKm(center, home) > HOME_FAR_KM : false;
  const first = timeOf(rows[0]);
  const last = timeOf(rows[rows.length - 1]);
  const days = first && last ? (last - first) / 86400000 : 0;
  if (far && (days >= 1 || rows.length >= 6)) return 'trip';
  const weekday = first ? new Date(first).getUTCDay() : null;
  if ((weekday === 0 || weekday === 6) && days <= 2) return 'weekend';
  return 'everyday';
}

export function titleHeuristic(rows, { home = null } = {}) {
  const first = rows[0]?.taken_at ?? rows[0]?.created_at;
  const month = first ? Number(String(first).slice(5, 7)) : null;
  const place = dominantPlace(rows);
  const center = centroid(rows);
  const atHome = home && center ? distanceKm(center, home) <= HOME_FAR_KM : false;
  const where = place ?? (atHome ? 'nhà' : null);
  return where && Number.isFinite(month) ? `Tháng ${month} ở ${where}` : `Tháng ${month ?? '?'}`;
}

/** Gộp các cụm xa nhà cùng nơi và sát nhau thành một chuyến. */
export function joinTrips(groups, home) {
  if (!home) return groups;
  const out = [];
  for (const group of groups) {
    const prev = out[out.length - 1];
    const prevCenter = prev ? centroid(prev) : null;
    const center = centroid(group);
    const prevFar = prevCenter ? distanceKm(prevCenter, home) > HOME_FAR_KM : false;
    const far = center ? distanceKm(center, home) > HOME_FAR_KM : false;
    const gap = prev ? timeOf(group[0]) - timeOf(prev[prev.length - 1]) : Infinity;
    const samePlace = prev
      ? (dominantPlace(prev) ?? '') === (dominantPlace(group) ?? '') &&
        (prevCenter && center ? distanceKm(prevCenter, center) <= 10 : true)
      : false;
    if (prev && prevFar && far && samePlace && gap <= TRIP_JOIN_MS) {
      out[out.length - 1] = [...prev, ...group];
    } else {
      out.push(group);
    }
  }
  return out;
}

function validTitle(value) {
  const title = String(value ?? '').trim();
  return title.length >= 3 && title.length <= 80 ? title : null;
}

function validKind(value) {
  return COLLECTION_KINDS.includes(String(value ?? '').trim()) ? String(value).trim() : null;
}

/**
 * Nhờ LLM đặt `{kind,title,summary}`; lỗi/không có LLM thì dùng heuristic
 * "<tháng> ở <nơi>" đúng MEGAPLAN.
 */
export async function nameGroup(provider, rows, { home = null } = {}) {
  const fallbackKind = kindHeuristic(rows, home);
  const fallback = {
    kind: fallbackKind,
    title: titleHeuristic(rows, { home }),
    summary: `${rows.length} ảnh, từ ${String(rows[0].taken_at ?? rows[0].created_at ?? '').slice(0, 10)} đến ${String(
      rows[rows.length - 1].taken_at ?? rows[rows.length - 1].created_at ?? '',
    ).slice(0, 10)}.`,
  };
  if (!provider?.describeCollection) return fallback;
  try {
    const raw = await provider.describeCollection({
      captions: rows.map((row) => row.ai_caption).filter(Boolean),
      place: dominantPlace(rows),
      count: rows.length,
      from: rows[0].taken_at ?? rows[0].created_at ?? null,
      to: rows[rows.length - 1].taken_at ?? rows[rows.length - 1].created_at ?? null,
      kindHint: fallbackKind,
      tetDates: Object.values(TET_DAYS),
    });
    return {
      kind: validKind(raw?.kind) ?? fallbackKind,
      title: validTitle(raw?.title) ?? fallback.title,
      summary: String(raw?.summary ?? '').trim().slice(0, 400) || fallback.summary,
    };
  } catch {
    return fallback;
  }
}

function bestCover(rows) {
  return [...rows].sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0) || a.id - b.id)[0];
}

function insertCollection(db, familyId, rows, named) {
  const start = rows[0].taken_at ?? rows[0].created_at;
  const end = rows[rows.length - 1].taken_at ?? rows[rows.length - 1].created_at;
  const cover = bestCover(rows);
  const info = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, summary, place, start_at, end_at, cover_media_id,
         status, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'suggested', 'ai', ?, ?)`,
    )
    .run(
      Number(familyId),
      named.kind,
      named.title,
      named.summary ?? null,
      dominantPlace(rows),
      start,
      end,
      cover?.id ?? null,
      start,
      start,
    );
  return Number(info.lastInsertRowid);
}

/**
 * Gom lại toàn bộ mục do AI đề xuất cho một gia đình.
 * - Xoá các mục AI cũ CHƯA được nhận, giữ mục người dùng đã nhận/sửa.
 * - Chia cụm theo 6 giờ / 30 km, gộp chuyến xa nhà, nhờ LLM đặt tên (không có thì heuristic).
 * - Tạo gợi ý ẩn ảnh mờ/trùng, gộp, tách, đổi tên.
 */
export async function regroupFamily(db, familyId, { provider = null } = {}) {
  const family = Number(familyId);
  const stale = db
    .prepare("SELECT id FROM collections WHERE family_id = ? AND source = 'ai' AND status = 'suggested'")
    .all(family);
  for (const row of stale) {
    db.prepare('UPDATE media SET collection_id = NULL WHERE collection_id = ?').run(row.id);
    db.prepare('DELETE FROM suggestions WHERE collection_id = ?').run(row.id);
    db.prepare('DELETE FROM collections WHERE id = ?').run(row.id);
  }

  const rows = db
    .prepare(
      `SELECT * FROM media
       WHERE family_id = ? AND hidden = 0 AND collection_id IS NULL
       ORDER BY COALESCE(taken_at, created_at), id`,
    )
    .all(family);
  const home = homePoint(rows);
  const groups = joinTrips(groupMedia(rows), home).filter((group) => group.length >= MIN_GROUP_PHOTOS);

  const createdIds = [];
  for (const group of groups) {
    const named = await nameGroup(provider, group, { home });
    const id = insertCollection(db, family, group, named);
    const link = db.prepare('UPDATE media SET collection_id = ? WHERE id = ?');
    for (const row of group) link.run(id, row.id);
    createdIds.push(id);
  }

  syncCollectionFts(db, family);

  // Ảnh mờ/trùng (kể cả ảnh đã có từ trước) → gợi ý ẩn.
  const flagged = db
    .prepare(
      `SELECT id, family_id, blurry, near_duplicate FROM media
       WHERE family_id = ? AND hidden = 0 AND (blurry = 1 OR near_duplicate = 1)`,
    )
    .all(family);
  for (const row of flagged) {
    ensureSuggestion(db, {
      familyId: family,
      mediaId: row.id,
      type: 'hide_blurry',
      text: row.blurry ? 'Ảnh này hơi mờ, ẩn khỏi dòng thời gian nhé?' : 'Ảnh này gần trùng với ảnh khác, ẩn bớt nhé?',
      payload: { reason: row.blurry ? 'blurry' : 'near_duplicate' },
    });
  }

  buildCollectionSuggestions(db, family);
  return createdIds;
}

/** Cập nhật FTS (tiêu đề mục) cho mọi ảnh của gia đình. */
export function syncCollectionFts(db, familyId) {
  for (const row of db.prepare('SELECT id FROM media WHERE family_id = ?').all(Number(familyId))) {
    syncMediaFts(db, row.id);
  }
}

/** Gợi ý gộp / tách / đổi tên giữa các mục. */
export function buildCollectionSuggestions(db, familyId) {
  const collections = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM media m WHERE m.collection_id = c.id) AS count
       FROM collections c WHERE c.family_id = ? ORDER BY start_at, id`,
    )
    .all(Number(familyId));

  // Gộp hai mục cùng nơi, sát nhau
  for (let i = 1; i < collections.length; i += 1) {
    const prev = collections[i - 1];
    const cur = collections[i];
    const samePlace = prev.place && cur.place && prev.place === cur.place;
    const gap = Date.parse(cur.start_at ?? '') - Date.parse(prev.end_at ?? '');
    if (samePlace && Number.isFinite(gap) && gap <= 3 * 86400000) {
      ensureSuggestion(db, {
        familyId,
        collectionId: cur.id,
        type: 'merge',
        text: `Gộp "${cur.title}" vào "${prev.title}"?`,
        payload: { intoId: prev.id },
      });
    }
  }

  // Tách mục quá dài: chọn ngày nhiều ảnh nhất (sau ngày đầu) làm điểm tách
  for (const collection of collections) {
    if (collection.count < SPLIT_HINT_PHOTOS) continue;
    const media = db
      .prepare('SELECT id, taken_at FROM media WHERE collection_id = ? ORDER BY COALESCE(taken_at, created_at), id')
      .all(collection.id);
    const days = new Map();
    for (const row of media) {
      const day = String(row.taken_at ?? '').slice(0, 10);
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(row.id);
    }
    if (days.size < 2) continue;
    const candidates = [...days.entries()].slice(1).sort((a, b) => b[1].length - a[1].length);
    const target = candidates[0]?.[1][0];
    if (target) {
      ensureSuggestion(db, {
        familyId,
        collectionId: collection.id,
        type: 'split',
        text: `"${collection.title}" hơi dài, tách từ ảnh này thành mục mới?`,
        payload: { mediaId: target },
      });
    }
  }

  // Đổi tên khi hai mục trùng tiêu đề
  const seen = new Map();
  for (const collection of collections) {
    const key = collection.title.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, collection);
      continue;
    }
    const month = String(collection.start_at ?? '').slice(5, 7);
    const title = collection.place ? `Tháng ${Number(month)} ở ${collection.place}` : `Tháng ${Number(month)}`;
    ensureSuggestion(db, {
      familyId,
      collectionId: collection.id,
      type: 'rename',
      text: `Đổi tên "${collection.title}" thành "${title}"?`,
      payload: { title },
    });
  }
}

export function serializeCollection(db, row) {
  if (!row) return null;
  const coverRow = row.cover_media_id
    ? db.prepare('SELECT * FROM media WHERE id = ?').get(row.cover_media_id)
    : db
        .prepare(
          `SELECT * FROM media WHERE collection_id = ?
           ORDER BY COALESCE(taken_at, created_at), id LIMIT 1`,
        )
        .get(row.id);
  const count = db.prepare('SELECT COUNT(*) AS n FROM media WHERE collection_id = ?').get(row.id).n;
  const members = db
    .prepare(
      `SELECT m.id, m.name, m.color FROM collection_members cm
       JOIN members m ON m.id = cm.member_id WHERE cm.collection_id = ? ORDER BY m.name`,
    )
    .all(row.id);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    summary: row.summary ?? null,
    place: row.place ?? null,
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    status: row.status,
    cover: coverRow ? serializeMedia(coverRow) : null,
    count,
    members: members.map((member) => ({ id: member.id, name: member.name, color: member.color ?? null })),
  };
}

/** Trang chi tiết mục: Collection + days + route + suggestions. */
export function collectionDetail(db, row) {
  const media = db
    .prepare('SELECT * FROM media WHERE collection_id = ? ORDER BY COALESCE(taken_at, created_at), id')
    .all(row.id);
  const byDay = new Map();
  for (const item of media) {
    const day = String(item.taken_at ?? item.created_at ?? '').slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(serializeMedia(item));
  }
  return {
    ...serializeCollection(db, row),
    days: [...byDay.entries()].map(([date, items]) => ({ date, media: items })),
    route: media.filter(hasCoords).map((item) => ({ lat: item.lat, lon: item.lon })),
    suggestions: listSuggestions(db, row.family_id, { collectionId: row.id }),
  };
}

export function collectionOr404(db, familyId, idParam) {
  const id = Number.parseInt(String(idParam), 10);
  if (!Number.isFinite(id)) return null;
  return db.prepare('SELECT * FROM collections WHERE id = ? AND family_id = ?').get(id, Number(familyId)) ?? null;
}

function collectionMedia(db, collectionId) {
  return db
    .prepare('SELECT * FROM media WHERE collection_id = ? ORDER BY COALESCE(taken_at, created_at), id')
    .all(collectionId);
}

export function mergeCollections(db, familyId, sourceId, intoId) {
  const source = collectionOr404(db, familyId, sourceId);
  const target = collectionOr404(db, familyId, intoId);
  if (!source || !target || source.id === target.id) return null;
  db.prepare('UPDATE media SET collection_id = ? WHERE collection_id = ?').run(target.id, source.id);
  db.prepare('DELETE FROM collection_members WHERE collection_id = ?').run(source.id);
  db.prepare('DELETE FROM suggestions WHERE collection_id = ?').run(source.id);
  db.prepare('DELETE FROM collections WHERE id = ?').run(source.id);
  db.prepare('UPDATE collections SET status = ?, source = ?, updated_at = ? WHERE id = ?').run(
    'accepted',
    'user',
    new Date().toISOString(),
    target.id,
  );
  syncCollectionFts(db, familyId);
  return db.prepare('SELECT * FROM collections WHERE id = ?').get(target.id);
}

export function splitCollection(db, familyId, collectionId, mediaId) {
  const source = collectionOr404(db, familyId, collectionId);
  if (!source) return null;
  const media = collectionMedia(db, source.id);
  const index = media.findIndex((row) => row.id === Number(mediaId));
  if (index < 0) return null;
  const moving = media.slice(index);
  if (moving.length === 0) return null;
  const stay = media.slice(0, index);
  const stamp = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, summary, place, start_at, end_at, cover_media_id,
         status, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'accepted', 'user', ?, ?)`,
    )
    .run(
      Number(familyId),
      source.kind,
      `${source.title} (2)`.slice(0, 80),
      source.summary,
      dominantPlace(moving),
      moving[0].taken_at ?? moving[0].created_at,
      moving[moving.length - 1].taken_at ?? moving[moving.length - 1].created_at,
      bestCover(moving)?.id ?? null,
      stamp,
      stamp,
    );
  const newId = Number(info.lastInsertRowid);
  const move = db.prepare('UPDATE media SET collection_id = ? WHERE id = ?');
  for (const row of moving) move.run(newId, row.id);
  if (stay.length > 0) {
    db.prepare('UPDATE collections SET start_at = ?, end_at = ?, cover_media_id = ?, updated_at = ? WHERE id = ?').run(
      stay[0].taken_at ?? stay[0].created_at,
      stay[stay.length - 1].taken_at ?? stay[stay.length - 1].created_at,
      bestCover(stay)?.id ?? null,
      stamp,
      source.id,
    );
  } else {
    db.prepare('DELETE FROM collections WHERE id = ?').run(source.id);
  }
  syncCollectionFts(db, familyId);
  return db.prepare('SELECT * FROM collections WHERE id = ?').get(newId);
}
