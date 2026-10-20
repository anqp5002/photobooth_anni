import { badRequest, forbidden, notFound, unauthorized } from './util.js';

export function requireUser(req) {
  if (!req.user) throw unauthorized();
  return req.user;
}

/** `family_id` của phiên (null khi chưa đăng nhập). */
export function familyIdOf(req) {
  const id = req.user?.family_id;
  return id == null ? null : Number(id);
}

/** Gia đình bắt buộc (mọi API r2 đều chạy trong một gia đình). */
export function requireFamily(req) {
  const user = requireUser(req);
  if (user.family_id == null) throw forbidden('no_family');
  return Number(user.family_id);
}

function sameFamily(row, familyId) {
  if (familyId == null) return true;
  if (row.family_id == null) return true; // dữ liệu r1 chưa gán gia đình
  return Number(row.family_id) === Number(familyId);
}

export function tripOr404(db, idParam, { familyId = null } = {}) {
  const id = Number.parseInt(String(idParam), 10);
  if (!Number.isFinite(id)) throw notFound();
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(id);
  if (!trip) throw notFound();
  if (!sameFamily(trip, familyId)) throw notFound();
  return trip;
}

export function stepOr404(db, idParam, { familyId = null } = {}) {
  const id = Number.parseInt(String(idParam), 10);
  if (!Number.isFinite(id)) throw notFound();
  const step = db
    .prepare(
      `SELECT s.*, t.family_id AS trip_family_id FROM steps s JOIN trips t ON t.id = s.trip_id
       WHERE s.id = ?`,
    )
    .get(id);
  if (!step) throw notFound();
  if (familyId != null && step.trip_family_id != null && Number(step.trip_family_id) !== Number(familyId)) {
    throw notFound();
  }
  return step;
}

export function mediaOr404(db, idParam, { familyId = null } = {}) {
  const id = Number.parseInt(String(idParam), 10);
  if (!Number.isFinite(id)) throw notFound();
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  if (!media) throw notFound();
  if (!sameFamily(media, familyId)) throw notFound();
  return media;
}

export function assertOwner(entity, user, { silent = false } = {}) {
  if (Number(entity.user_id) === Number(user.id)) return;
  if (silent) throw notFound();
  throw forbidden();
}

/** Chặn thao tác ghi của người không phải chủ chuyến (và khác gia đình). */
export function requireOwnerTrip(db, req, idParam) {
  const user = requireUser(req);
  const trip = tripOr404(db, idParam, { familyId: familyIdOf(req) });
  assertOwner(trip, user);
  return trip;
}

export function bodyObject(req) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('bad_request');
  return body;
}

export function optionalString(value, field, maxLength = 500) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw badRequest(`invalid_${field}`);
  return value.trim().slice(0, maxLength);
}

export function requiredString(value, field, maxLength = 500) {
  const out = optionalString(value, field, maxLength);
  if (!out) throw badRequest(`invalid_${field}`);
  return out;
}
