import { calendarDays, distanceKm, round2, slugify } from './util.js';
import { MEDIA_CACHE_HEADER, mediaUrls } from './media.js';

export { MEDIA_CACHE_HEADER, mediaUrls };

export function canViewTrip(trip, viewerId) {
  if (!trip) return false;
  if (viewerId && Number(viewerId) === Number(trip.user_id)) return true;
  return trip.visibility === 'public' || trip.visibility === 'link';
}

export function isOwner(trip, viewerId) {
  return Boolean(viewerId) && Number(viewerId) === Number(trip.user_id);
}

export function serializeMedia(row, { owner = false } = {}) {
  return {
    id: row.id,
    type: row.type,
    order: row.order_index,
    ...mediaUrls(row),
    width: row.width,
    height: row.height,
    duration: row.duration,
    flags: {
      blurry: Boolean(row.blurry),
      nearDuplicate: Boolean(row.near_duplicate),
      hidden: Boolean(row.hidden),
    },
    ...(owner ? { takenAt: row.taken_at } : {}),
  };
}

export function serializeStep(row, { owner = false } = {}) {
  return {
    id: row.id,
    slug: slugify(row.name),
    name: row.name,
    description: row.description ?? null,
    startedAt: row.started_at,
    location: {
      lat: owner ? row.lat : round2(row.lat),
      lon: owner ? row.lon : round2(row.lon),
      name: row.place_name ?? null,
      country: row.country_code
        ? { code: row.country_code, name: row.country_name ?? row.country_code }
        : null,
    },
    weather:
      row.weather_temp_c != null || row.weather_icon
        ? { tempC: row.weather_temp_c, icon: row.weather_icon ?? null }
        : null,
    comments: row.comments ?? 0,
    likes: row.likes ?? 0,
    media: [],
    draft:
      row.draft_name || row.draft_description
        ? { name: row.draft_name ?? null, description: row.draft_description ?? null }
        : null,
  };
}

/** Thống kê chuyến: km, số nước, số ngày, số chặng (R-008). */
export function tripStats(db, tripId, trip) {
  const steps = db
    .prepare('SELECT id, lat, lon, country_code, country_name, started_at FROM steps WHERE trip_id = ? ORDER BY sort_order, id')
    .all(tripId);
  let km = 0;
  let previous = null;
  for (const step of steps) {
    if (step.lat == null || step.lon == null) continue;
    if (previous) km += distanceKm(previous, step);
    previous = { lat: step.lat, lon: step.lon };
  }
  const countries = [];
  const seen = new Set();
  for (const step of steps) {
    if (step.country_code && !seen.has(step.country_code)) {
      seen.add(step.country_code);
      countries.push({ code: step.country_code, name: step.country_name ?? step.country_code });
    }
  }
  const start = trip?.started_at ?? steps.find((s) => s.started_at)?.started_at ?? null;
  const end = trip?.ended_at ?? null;
  const days = start ? calendarDays(start, end ?? new Date().toISOString()) : 0;
  return {
    stepsTotal: steps.length,
    steps,
    km: Math.round(km * 10) / 10,
    countries,
    days,
    start,
    end,
  };
}

/** Ảnh bìa: media đầu tiên (theo thứ tự chặng) mà người xem được thấy. */
export function tripCover(db, tripId, { owner = false } = {}) {
  const rows = db
    .prepare(
      `SELECT m.* FROM media m JOIN steps s ON s.id = m.step_id
       WHERE m.trip_id = ? ${owner ? '' : 'AND m.hidden = 0'}
       ORDER BY s.sort_order, m.order_index, m.id LIMIT 1`,
    )
    .all(tripId);
  const row = rows[0];
  if (!row) return null;
  const urls = mediaUrls(row);
  return { orig: urls.orig, lg: urls.lg, sm: urls.sm };
}

function stepMedia(db, stepId, { owner }) {
  const rows = db
    .prepare(
      `SELECT * FROM media WHERE step_id = ? ${owner ? '' : 'AND hidden = 0'}
       ORDER BY order_index, id`,
    )
    .all(stepId);
  return rows.map((row) => serializeMedia(row, { owner }));
}

function segmentsFor(db, tripId, stepIds) {
  if (stepIds.length < 2) return [];
  const placeholders = stepIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM segments WHERE trip_id = ?
       AND from_step_id IN (${placeholders}) AND to_step_id IN (${placeholders})
       ORDER BY id`,
    )
    .all(tripId, ...stepIds, ...stepIds);
  return rows.map((row) => ({
    fromStepId: row.from_step_id,
    toStepId: row.to_step_id,
    vehicle: row.vehicle,
    kind: row.kind,
    polyline: row.polyline,
  }));
}

/** Toàn bộ dữ liệu trang chuyến (R-037), có phân trang chặng. */
export function buildTripPayload(db, trip, { viewerId = null, limit = 20, offset = 0 } = {}) {
  const owner = isOwner(trip, viewerId);
  const stats = tripStats(db, trip.id, trip);
  const rows = db
    .prepare(
      `SELECT * FROM steps WHERE trip_id = ? ORDER BY sort_order, id LIMIT ? OFFSET ?`,
    )
    .all(trip.id, limit, offset);
  const steps = rows.map((row) => ({
    ...serializeStep(row, { owner }),
    media: stepMedia(db, row.id, { owner }),
  }));
  const nextOffset = offset + rows.length < stats.stepsTotal ? offset + rows.length : null;
  const author = db
    .prepare('SELECT id, username, display_name, avatar FROM users WHERE id = ?')
    .get(trip.user_id);
  return {
    id: trip.id,
    name: trip.name,
    slug: trip.slug,
    startedAt: stats.start,
    endedAt: trip.ended_at,
    timezone: trip.timezone,
    km: stats.km,
    views: trip.views,
    likes: trip.likes,
    visibility: trip.visibility,
    cover: tripCover(db, trip.id, { owner }),
    author: author
      ? { username: author.username, displayName: author.display_name, avatar: author.avatar }
      : null,
    countries: stats.countries,
    days: stats.days,
    stepsTotal: stats.stepsTotal,
    steps,
    segments: segmentsFor(
      db,
      trip.id,
      rows.map((row) => row.id),
    ),
    nextOffset,
    // Trường thêm cho chủ chuyến: media "chưa xếp" (B-02) để trang /me hiện thư mục.
    ...(owner
      ? {
          unsorted: db
            .prepare(
              `SELECT * FROM media WHERE trip_id = ? AND step_id IS NULL
               ORDER BY COALESCE(taken_at, created_at), id`,
            )
            .all(trip.id)
            .map((row) => serializeMedia(row, { owner: true })),
        }
      : {}),
  };
}

/** Hồ sơ tác giả (R-012, hợp đồng API). */
export function buildUserPayload(db, username, { viewerId = null } = {}) {
  const user = db
    .prepare('SELECT id, username, display_name, avatar FROM users WHERE username = ?')
    .get(username);
  if (!user) return null;
  const viewerIsOwner = viewerId != null && Number(viewerId) === Number(user.id);
  const trips = db
    .prepare(
      `SELECT * FROM trips WHERE user_id = ? ${viewerIsOwner ? '' : "AND visibility = 'public'"}
       ORDER BY COALESCE(started_at, created_at) DESC, id DESC`,
    )
    .all(user.id);
  const countryCodes = new Set();
  const tripPayloads = trips.map((trip) => {
    const stats = tripStats(db, trip.id, trip);
    for (const country of stats.countries) countryCodes.add(country.code);
    const cover = tripCover(db, trip.id, { owner: viewerIsOwner });
    return {
      id: trip.id,
      slug: trip.slug,
      name: trip.name,
      cover: cover ? { sm: cover.sm, lg: cover.lg } : null,
      startedAt: stats.start,
      endedAt: trip.ended_at,
      steps: stats.stepsTotal,
      km: stats.km,
      countries: stats.countries.length,
      visibility: trip.visibility,
    };
  });
  return {
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar,
    countryCount: countryCodes.size,
    trips: tripPayloads,
  };
}
