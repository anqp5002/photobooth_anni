import path from 'node:path';
import { applyAutoSegments } from '../cluster.js';
import { applyHeuristics } from '../ai.js';
import { ingestFile, insertMedia } from '../ingest.js';
import { serializeMedia, serializeStep } from '../trips.js';
import {
  assertOwner,
  bodyObject,
  familyIdOf,
  mediaOr404,
  optionalString,
  requireOwnerTrip,
  requireUser,
  requiredString,
  stepOr404,
  tripOr404,
} from '../http.js';
import { badRequest, nowIso, randomCode, slugify } from '../util.js';
import { probeImageSize, storePhotoRenditions } from '../images.js';
import { detectMediaType } from '../media-type.js';

const VISIBILITIES = new Set(['private', 'link', 'public']);

/** Chia lại chặng + chấm AI sau mỗi thay đổi cấu trúc. AI lỗi không chặn. */
async function refreshTrip(app, tripId) {
  const { db, geo, config } = app;
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  applyAutoSegments(db, tripId, { geo, config });
  try {
    await applyHeuristics(db, tripId, {
      mediaDir: config.mediaDir,
      provider: config.aiProvider,
      timezone: trip?.timezone ?? 'UTC',
    });
  } catch (err) {
    app.log.warn({ err, tripId }, 'AI heuristic lỗi, bỏ qua gợi ý');
  }
}

function lockStep(db, stepId, stamp = nowIso()) {
  db.prepare('UPDATE steps SET auto = 0, updated_at = ? WHERE id = ?').run(stamp, stepId);
  db.prepare('UPDATE media SET auto = 0 WHERE step_id = ?').run(stepId);
}

function deleteIfEmptyAutoStep(db, stepId) {
  if (!stepId) return;
  const step = db.prepare('SELECT * FROM steps WHERE id = ?').get(stepId);
  if (!step || step.auto !== 1) return;
  const count = db.prepare('SELECT COUNT(*) AS n FROM media WHERE step_id = ?').get(stepId).n;
  if (count === 0) db.prepare('DELETE FROM steps WHERE id = ?').run(stepId);
}

function restampTrip(db, tripId) {
  db.prepare('UPDATE trips SET updated_at = ? WHERE id = ?').run(nowIso(), tripId);
}

export default async function writeRoutes(app) {
  const { db, config } = app;

  // ---------------------------------------------------------------- chuyến
  app.post('/api/trips', async (req, reply) => {
    const user = requireUser(req);
    const body = bodyObject(req);
    const name = requiredString(body.name, 'name', 120);
    const visibility = body.visibility ?? 'private';
    if (!VISIBILITIES.has(visibility)) throw badRequest('invalid_visibility');
    const stamp = nowIso();
    const timezone = typeof body.timezone === 'string' ? body.timezone.slice(0, 60) : 'Asia/Ho_Chi_Minh';
    const info = db
      .prepare(
        `INSERT INTO trips (user_id, family_id, name, slug, visibility, timezone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id,
        familyIdOf(req),
        name,
        slugify(name, { maxLength: 80 }),
        visibility,
        timezone,
        stamp,
        stamp,
      );
    return reply.code(201).send({
      id: Number(info.lastInsertRowid),
      name,
      slug: slugify(name, { maxLength: 80 }),
      visibility,
      createdAt: stamp,
    });
  });

  app.patch('/api/trips/:id', async (req, reply) => {
    const trip = requireOwnerTrip(db, req, req.params.id);
    const body = bodyObject(req);
    const changes = [];
    const params = [];
    if (body.name !== undefined) {
      const name = requiredString(body.name, 'name', 120);
      changes.push('name = ?', 'slug = ?');
      params.push(name, slugify(name, { maxLength: 80 }));
      trip.name = name;
    }
    if (body.visibility !== undefined) {
      if (!VISIBILITIES.has(body.visibility)) throw badRequest('invalid_visibility');
      changes.push('visibility = ?');
      params.push(body.visibility);
      trip.visibility = body.visibility;
    }
    if (changes.length) {
      db.prepare(`UPDATE trips SET ${changes.join(', ')}, updated_at = ? WHERE id = ?`).run(
        ...params,
        nowIso(),
        trip.id,
      );
    }
    return reply.send({
      id: trip.id,
      name: trip.name,
      slug: trip.slug,
      visibility: trip.visibility,
    });
  });

  // -------------------------------------------------------------- tải lên
  app.post('/api/trips/:id/media', async (req, reply) => {
    const trip = requireOwnerTrip(db, req, req.params.id);
    if (typeof req.isMultipart !== 'function' || !req.isMultipart()) {
      throw badRequest('expected_multipart');
    }
    const accepted = [];
    const rejected = [];
    try {
      const files = req.files({
        limits: { fileSize: 400 * 1024 * 1024, files: 200, parts: 220 },
      });
      for await (const part of files) {
        const filename = part.filename || 'tệp';
        let buffer;
        try {
          buffer = await part.toBuffer();
        } catch (err) {
          rejected.push({ file: filename, reason: 'tệp quá lớn' });
          void err;
          continue;
        }
        const result = await ingestFile({
          buffer,
          filename,
          mediaDir: config.mediaDir,
        });
        if (!result.ok) {
          rejected.push({ file: filename, reason: result.reason });
          continue;
        }
        const id = insertMedia(db, trip.id, result.media, {
          familyId: trip.family_id,
          uploaderId: trip.user_id,
        });
        accepted.push(id);
      }
    } catch (err) {
      if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
        rejected.push({ file: 'tệp', reason: 'tệp quá lớn' });
      } else if (err?.statusCode === 413) {
        rejected.push({ file: 'tệp', reason: 'tệp quá lớn' });
      } else {
        throw err;
      }
    }
    await refreshTrip(app, trip.id);
    return reply.send({ accepted, rejected });
  });

  // ---------------------------------------------------------------- chặng
  app.patch('/api/steps/:id', async (req, reply) => {
    const user = requireUser(req);
    const step = stepOr404(db, req.params.id, { familyId: familyIdOf(req) });
    const trip = tripOr404(db, step.trip_id, { familyId: familyIdOf(req) });
    assertOwner(trip, user);
    const body = bodyObject(req);
    const name = optionalString(body.name, 'name', 160);
    const description = optionalString(body.description, 'description', 4000);
    if (name === undefined && description === undefined) throw badRequest('nothing_to_update');
    if (name !== undefined && !name) throw badRequest('invalid_name');
    db.prepare(
      `UPDATE steps SET name = ?, description = ?, draft_name = NULL,
        draft_description = NULL, updated_at = ? WHERE id = ?`,
    ).run(
      name ?? step.name,
      description !== undefined ? description : step.description,
      nowIso(),
      step.id,
    );
    lockStep(db, step.id);
    restampTrip(db, trip.id);
    const updated = stepOr404(db, step.id);
    return reply.send(serializeStep(updated, { owner: true }));
  });

  app.post('/api/steps/:id/merge', async (req, reply) => {
    const user = requireUser(req);
    const source = stepOr404(db, req.params.id, { familyId: familyIdOf(req) });
    const trip = tripOr404(db, source.trip_id, { familyId: familyIdOf(req) });
    assertOwner(trip, user);
    const body = bodyObject(req);
    const into = stepOr404(db, body.intoStepId, { familyId: familyIdOf(req) });
    if (into.trip_id !== source.trip_id) throw badRequest('step_not_in_trip');
    if (into.id === source.id) throw badRequest('same_step');

    const maxOrder = db
      .prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM media WHERE step_id = ?')
      .get(into.id).m;
    const media = db
      .prepare('SELECT id FROM media WHERE step_id = ? ORDER BY order_index, id')
      .all(source.id);
    const update = db.prepare('UPDATE media SET step_id = ?, order_index = ?, auto = 0 WHERE id = ?');
    media.forEach((row, index) => update.run(into.id, maxOrder + 1 + index, row.id));
    lockStep(db, into.id);
    db.prepare('DELETE FROM steps WHERE id = ?').run(source.id);
    await refreshTrip(app, trip.id);
    return reply.send({ ok: true, stepId: into.id, moved: media.length });
  });

  app.post('/api/steps/:id/split', async (req, reply) => {
    const user = requireUser(req);
    const step = stepOr404(db, req.params.id, { familyId: familyIdOf(req) });
    const trip = tripOr404(db, step.trip_id, { familyId: familyIdOf(req) });
    assertOwner(trip, user);
    const body = bodyObject(req);
    const media = mediaOr404(db, body.mediaId, { familyId: familyIdOf(req) });
    if (media.step_id !== step.id) throw badRequest('media_not_in_step');

    const stamp = nowIso();
    const info = db
      .prepare(
        `INSERT INTO steps (trip_id, name, description, started_at, lat, lon, place_name,
          country_code, country_name, sort_order, auto, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        trip.id,
        step.name,
        media.taken_at ?? step.started_at,
        step.lat,
        step.lon,
        step.place_name,
        step.country_code,
        step.country_name,
        (step.sort_order ?? 0) + 1,
        stamp,
        stamp,
      );
    const newStepId = Number(info.lastInsertRowid);
    const moved = db
      .prepare('SELECT id FROM media WHERE step_id = ? AND order_index >= ? ORDER BY order_index, id')
      .all(step.id, media.order_index);
    const update = db.prepare('UPDATE media SET step_id = ?, order_index = ?, auto = 0 WHERE id = ?');
    moved.forEach((row, index) => update.run(newStepId, index, row.id));
    lockStep(db, step.id, stamp);
    await refreshTrip(app, trip.id);
    return reply.send({ ok: true, stepId: newStepId, moved: moved.length });
  });

  // ---------------------------------------------------------------- media
  app.post('/api/media/:id/move', async (req, reply) => {
    const user = requireUser(req);
    const media = mediaOr404(db, req.params.id, { familyId: familyIdOf(req) });
    const trip = tripOr404(db, media.trip_id, { familyId: familyIdOf(req) });
    assertOwner(trip, user);
    const body = bodyObject(req);
    const target = stepOr404(db, body.stepId, { familyId: familyIdOf(req) });
    if (target.trip_id !== media.trip_id) throw badRequest('step_not_in_trip');

    const fromStepId = media.step_id;
    if (target.id !== fromStepId) {
      const maxOrder = db
        .prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM media WHERE step_id = ?')
        .get(target.id).m;
      db.prepare('UPDATE media SET step_id = ?, order_index = ?, auto = 0 WHERE id = ?').run(
        target.id,
        maxOrder + 1,
        media.id,
      );
      lockStep(db, target.id);
      deleteIfEmptyAutoStep(db, fromStepId);
      await refreshTrip(app, trip.id);
    }
    return reply.send({ ok: true, mediaId: media.id, stepId: target.id });
  });

  // PATCH /api/media/:id chuyển sang `routes/media-routes.js` (hợp đồng r2).

  /** B-05: lưu dải ảnh photobooth (PNG) vào một chặng. */
  app.post('/api/steps/:id/strips', async (req, reply) => {
    const user = requireUser(req);
    const step = stepOr404(db, req.params.id, { familyId: familyIdOf(req) });
    const trip = tripOr404(db, step.trip_id, { familyId: familyIdOf(req) });
    assertOwner(trip, user);
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer || buffer.length < 8) throw badRequest('expected_png');
    const kind = detectMediaType(buffer);
    if (!kind || kind.kind !== 'photo' || kind.ext !== 'png') throw badRequest('expected_png');

    const size = await probeImageSize(buffer);
    const code = randomCode(12);
    await storePhotoRenditions({
      buffer,
      dir: path.join(config.mediaDir, code),
      ext: 'png',
      width: size.width,
      height: size.height,
    });
    const mediaId = insertMedia(
      db,
      trip.id,
      {
        type: 'photo',
        code,
        ext: 'png',
        origName: 'dai-anh.png',
        width: size.width,
        height: size.height,
        duration: null,
        takenAt: nowIso(),
        lat: step.lat,
        lon: step.lon,
      },
      { stepId: step.id, auto: 0, familyId: trip.family_id, uploaderId: trip.user_id },
    );
    lockStep(db, step.id);
    const media = mediaOr404(db, mediaId);
    return reply.code(201).send(serializeMedia(media, { owner: true }));
  });
}
