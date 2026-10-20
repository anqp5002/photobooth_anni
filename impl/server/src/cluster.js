import { distanceKm, nowIso } from './util.js';
import { encodePolyline } from './polyline.js';
import { withTx } from './db.js';

/**
 * B-02 — tự chia chặng: hai mục liền nhau cùng có GPS và cách nhau ≤ 3 giờ,
 * ≤ 5 km thì chung chặng. Ảnh không GPS gán vào chặng gần nhất theo thời gian;
 * ảnh không có cả thời gian lẫn GPS vào mục "chưa xếp".
 */
export const CLUSTER_DEFAULTS = {
  maxGapMs: 3 * 60 * 60 * 1000,
  maxDistanceKm: 5,
  placeMaxKm: 200,
};

/**
 * Hàm thuần: chia danh sách media thành chặng.
 * @param {Array<{id:number, takenAt:string|null, lat:number|null, lon:number|null}>} media
 * @returns {{groups: Array<{mediaIds:number[], startedAt:string|null, lat:number|null, lon:number|null, firstTime:number}>, unsorted:number[]}}
 */
export function groupMedia(media, options = {}) {
  const opts = { ...CLUSTER_DEFAULTS, ...options };
  const items = media.map((m) => {
    const time = m.takenAt ? Date.parse(m.takenAt) : Number.NaN;
    return {
      id: Number(m.id),
      time: Number.isFinite(time) ? time : Number.NaN,
      lat: Number.isFinite(m.lat) ? Number(m.lat) : null,
      lon: Number.isFinite(m.lon) ? Number(m.lon) : null,
    };
  });

  const timed = items
    .filter((i) => Number.isFinite(i.time))
    .sort((a, b) => a.time - b.time || a.id - b.id);
  const untimed = items.filter((i) => !Number.isFinite(i.time));
  const geoTimed = timed.filter((i) => i.lat != null && i.lon != null);

  /** @type {Array<{items: any[]}>} */
  const clusters = [];
  let current = null;

  if (geoTimed.length > 0) {
    for (const item of geoTimed) {
      const prev = current?.items[current.items.length - 1];
      const sameChặng =
        prev &&
        item.time - prev.time <= opts.maxGapMs &&
        distanceKm(prev, item) <= opts.maxDistanceKm;
      if (sameChặng) {
        current.items.push(item);
      } else {
        current = { items: [item] };
        clusters.push(current);
      }
    }
  } else {
    // Không mục nào có GPS: chỉ còn thời gian để gom.
    for (const item of timed) {
      const prev = current?.items[current.items.length - 1];
      if (prev && item.time - prev.time <= opts.maxGapMs) {
        current.items.push(item);
      } else {
        current = { items: [item] };
        clusters.push(current);
      }
    }
  }

  const groups = clusters.map((cluster) => ({
    items: cluster.items,
    mediaIds: cluster.items.map((i) => i.id),
  }));

  // Ảnh có thời gian nhưng không GPS: chặng gần nhất theo thời gian.
  const timedWithoutGps =
    geoTimed.length > 0 ? timed.filter((i) => i.lat == null || i.lon == null) : [];
  const unsorted = [];
  for (const item of timedWithoutGps) {
    let best = -1;
    let bestGap = Infinity;
    groups.forEach((group, index) => {
      const times = group.items.map((i) => i.time);
      const start = Math.min(...times);
      const end = Math.max(...times);
      const gap = item.time < start ? start - item.time : item.time > end ? item.time - end : 0;
      if (gap < bestGap) {
        bestGap = gap;
        best = index;
      }
    });
    if (best >= 0) {
      groups[best].items.push(item);
      groups[best].mediaIds.push(item.id);
    } else {
      unsorted.push(item.id);
    }
  }

  // Ảnh có GPS nhưng không có thời gian: gán theo khoảng cách, không có chặng thì bỏ.
  const gpsWithoutTime = untimed.filter((i) => i.lat != null && i.lon != null);
  for (const item of gpsWithoutTime) {
    let best = -1;
    let bestDistance = Infinity;
    groups.forEach((group, index) => {
      const point = centroid(group.items);
      if (!point) return;
      const d = distanceKm(point, item);
      if (d < bestDistance) {
        bestDistance = d;
        best = index;
      }
    });
    if (best >= 0 && bestDistance <= opts.placeMaxKm) {
      groups[best].items.push(item);
      groups[best].mediaIds.push(item.id);
    } else {
      unsorted.push(item.id);
    }
  }

  // Không có thời gian lẫn GPS → "chưa xếp".
  for (const item of untimed) {
    if (item.lat == null || item.lon == null) unsorted.push(item.id);
  }

  return {
    groups: groups.map((group) => {
      const point = centroid(group.items);
      const times = group.items.map((i) => i.time).filter(Number.isFinite);
      const startedAt = times.length ? new Date(Math.min(...times)).toISOString() : null;
      return {
        mediaIds: group.mediaIds,
        startedAt,
        firstTime: times.length ? Math.min(...times) : Infinity,
        lat: point ? point.lat : null,
        lon: point ? point.lon : null,
      };
    }),
    unsorted,
  };
}

function centroid(items) {
  const points = items.filter((i) => i.lat != null && i.lon != null);
  if (!points.length) return null;
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
  return { lat, lon };
}

/** Phương tiện ước lượng từ quãng đường và thời gian (người dùng sửa được ở giao diện sau). */
export function inferVehicle(distance, hours) {
  if (!Number.isFinite(distance) || !Number.isFinite(hours)) return 'none';
  if (distance > 500) return 'plane';
  const speed = hours > 0 ? distance / hours : Infinity;
  if (distance > 120 && speed > 55) return 'train';
  if (speed > 45) return 'car';
  if (speed > 12) return 'motorbike';
  if (speed > 2) return 'bus';
  return 'none';
}

/**
 * Chia lại các chặng "do máy" của một chuyến, giữ nguyên chặng người dùng đã sửa.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function applyAutoSegments(db, tripId, { geo, config } = {}) {
  const opts = config?.cluster ?? CLUSTER_DEFAULTS;
  const autoMedia = db
    .prepare('SELECT id, taken_at, lat, lon FROM media WHERE trip_id = ? AND auto = 1')
    .all(tripId)
    .map((row) => ({ id: row.id, takenAt: row.taken_at, lat: row.lat, lon: row.lon }));

  const { groups, unsorted } = groupMedia(autoMedia, opts);

  withTx(db, () => {
    // Bỏ các chặng do máy tạo; chặng người dùng sửa (auto = 0) giữ nguyên.
    db.prepare('DELETE FROM steps WHERE trip_id = ? AND auto = 1').run(tripId);

    const insertStep = db.prepare(
      `INSERT INTO steps (trip_id, name, description, started_at, lat, lon, place_name,
        country_code, country_name, sort_order, auto, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    );
    const stamp = nowIso();
    for (const group of groups) {
      const place = group.lat != null ? geo?.nearest(group.lat, group.lon, { maxKm: opts.placeMaxKm }) : null;
      const name = place?.name ?? `Chặng ${nextStepNumber(db, tripId)}`;
      const info = insertStep.run(
        tripId,
        name,
        group.startedAt,
        place ? group.lat : null,
        place ? group.lon : null,
        place?.name ?? null,
        place?.countryCode ?? null,
        place?.countryName ?? null,
        0,
        stamp,
        stamp,
      );
      const stepId = Number(info.lastInsertRowid);
      const assign = db.prepare('UPDATE media SET step_id = ?, order_index = ?, auto = 1 WHERE id = ?');
      group.mediaIds.forEach((mediaId, index) => assign.run(stepId, index, mediaId));
    }

    // Mục chưa xếp: bỏ khỏi chặng cũ.
    for (const mediaId of unsorted) {
      db.prepare('UPDATE media SET step_id = NULL WHERE id = ?').run(mediaId);
    }

    // Thứ tự chặng + khoảng thời gian chuyến.
    const steps = db
      .prepare('SELECT id, started_at FROM steps WHERE trip_id = ? ORDER BY started_at IS NULL, started_at, id')
      .all(tripId);
    const reorder = db.prepare('UPDATE steps SET sort_order = ? WHERE id = ?');
    steps.forEach((step, index) => reorder.run(index, step.id));

    const updateTrip = db.prepare('UPDATE trips SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?');
    const start = steps.find((s) => s.started_at)?.started_at ?? null;
    const lastMedia = db
      .prepare("SELECT MAX(COALESCE(taken_at, created_at)) AS t FROM media WHERE trip_id = ?")
      .get(tripId)?.t;
    const end = lastMedia && start && lastMedia < start ? start : lastMedia ?? null;
    updateTrip.run(start, end, stamp, tripId);

    // Dựng lại đoạn tuyến, giữ phương tiện đã có cho cặp chặng không đổi.
    const oldVehicles = new Map(
      db
        .prepare('SELECT from_step_id, to_step_id, vehicle FROM segments WHERE trip_id = ?')
        .all(tripId)
        .map((row) => [`${row.from_step_id}:${row.to_step_id}`, row.vehicle]),
    );
    db.prepare('DELETE FROM segments WHERE trip_id = ?').run(tripId);
    const insertSegment = db.prepare(
      `INSERT INTO segments (trip_id, from_step_id, to_step_id, vehicle, kind, polyline)
       VALUES (?, ?, ?, ?, 'straight', ?)`,
    );
    const allSteps = db
      .prepare('SELECT id, lat, lon, started_at FROM steps WHERE trip_id = ? ORDER BY sort_order')
      .all(tripId);
    for (let i = 0; i < allSteps.length - 1; i += 1) {
      const from = allSteps[i];
      const to = allSteps[i + 1];
      if (from.lat == null || to.lat == null) continue;
      const km = distanceKm(from, to);
      const hours =
        from.started_at && to.started_at
          ? Math.max(0.01, (Date.parse(to.started_at) - Date.parse(from.started_at)) / 3600000)
          : Number.NaN;
      const key = `${from.id}:${to.id}`;
      const vehicle = oldVehicles.get(key) ?? inferVehicle(km, hours);
      insertSegment.run(
        tripId,
        from.id,
        to.id,
        vehicle,
        encodePolyline([
          { lat: from.lat, lon: from.lon },
          { lat: to.lat, lon: to.lon },
        ]),
      );
    }
  });
}

function nextStepNumber(db, tripId) {
  return db.prepare('SELECT COUNT(*) AS n FROM steps WHERE trip_id = ?').get(tripId).n + 1;
}
