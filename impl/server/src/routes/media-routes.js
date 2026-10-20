import { ingestFile, insertMedia } from '../ingest.js';
import { serializeMedia } from '../media.js';
import { syncMediaFts } from '../fts.js';
import { bodyObject, mediaOr404, requireFamily, requireUser } from '../http.js';
import { badRequest } from '../util.js';

const MAX_STATUS_IDS = 200;

function parseIds(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '');
  return raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => Number.isFinite(id) && id > 0)
    .slice(0, MAX_STATUS_IDS);
}

export default async function mediaRoutes(app) {
  const { db, config, geo } = app;

  /** Tải nhiều tệp lên gia đình; mỗi ảnh vào hàng đợi AI ngay sau khi lưu. */
  app.post('/api/media', async (req, reply) => {
    const user = requireUser(req);
    const familyId = requireFamily(req);
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
        } catch {
          rejected.push({ file: filename, reason: 'tệp quá lớn' });
          continue;
        }
        const result = await ingestFile({ buffer, filename, mediaDir: config.mediaDir });
        if (!result.ok) {
          rejected.push({ file: filename, reason: result.reason });
          continue;
        }
        const place =
          Number.isFinite(result.media.lat) && Number.isFinite(result.media.lon) && geo
            ? geo.nearest(result.media.lat, result.media.lon, {
                maxKm: config.cluster?.placeMaxKm ?? 200,
              })
            : null;
        const id = insertMedia(db, null, { ...result.media, place: place?.name ?? null, country: place?.countryName ?? null }, {
          familyId,
          uploaderId: user.id,
        });
        app.ai.enqueue(id);
        accepted.push({ id, file: filename });
      }
    } catch (err) {
      if (err?.code === 'FST_REQ_FILE_TOO_LARGE' || err?.statusCode === 413) {
        rejected.push({ file: 'tệp', reason: 'tệp quá lớn' });
      } else {
        throw err;
      }
    }
    if (accepted.length > 0) app.collections?.schedule(familyId);
    return reply.send({ accepted, rejected });
  });

  /** Trạng thái phân tích của từng ảnh (màn tải ảnh hỏi lại vài giây một lần). */
  app.get('/api/media/status', async (req, reply) => {
    const familyId = requireFamily(req);
    const ids = parseIds(req.query.ids);
    if (ids.length === 0) return reply.send([]);
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT id, ai_status, ai_caption, collection_id FROM media
         WHERE family_id = ? AND id IN (${placeholders})`,
      )
      .all(familyId, ...ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return reply.send(
      ids
        .filter((id) => byId.has(id))
        .map((id) => {
          const row = byId.get(id);
          return {
            id: row.id,
            aiStatus: row.ai_status,
            caption: row.ai_caption ?? null,
            collectionId: row.collection_id ?? null,
          };
        }),
    );
  });

  /** Ẩn ảnh, gán vào mục, gắn người trong nhà. */
  app.patch('/api/media/:id', async (req, reply) => {
    const familyId = requireFamily(req);
    const media = mediaOr404(db, req.params.id, { familyId });
    const body = bodyObject(req);
    const changes = [];
    const params = [];

    if (body.hidden !== undefined) {
      if (typeof body.hidden !== 'boolean') throw badRequest('invalid_hidden');
      changes.push('hidden = ?');
      params.push(body.hidden ? 1 : 0);
    }

    if (body.collectionId !== undefined) {
      if (body.collectionId === null) {
        changes.push('collection_id = ?');
        params.push(null);
      } else {
        const id = Number(body.collectionId);
        const collection = Number.isFinite(id)
          ? db.prepare('SELECT id FROM collections WHERE id = ? AND family_id = ?').get(id, familyId)
          : null;
        if (!collection) throw badRequest('invalid_collection');
        changes.push('collection_id = ?');
        params.push(collection.id);
      }
    }

    if (changes.length > 0) {
      db.prepare(`UPDATE media SET ${changes.join(', ')} WHERE id = ?`).run(...params, media.id);
    }

    if (body.memberIds !== undefined) {
      if (!Array.isArray(body.memberIds)) throw badRequest('invalid_memberIds');
      const memberIds = [...new Set(body.memberIds.map((value) => Number(value)))].filter((id) =>
        Number.isFinite(id),
      );
      const findMember = db.prepare('SELECT 1 AS n FROM members WHERE id = ? AND family_id = ?');
      for (const memberId of memberIds) {
        if (!findMember.get(memberId, familyId)) throw badRequest('invalid_member');
      }
      db.prepare('DELETE FROM media_members WHERE media_id = ?').run(media.id);
      const insert = db.prepare('INSERT INTO media_members (media_id, member_id) VALUES (?, ?)');
      for (const memberId of memberIds) insert.run(media.id, memberId);
    }

    syncMediaFts(db, media.id);
    const updated = mediaOr404(db, media.id, { familyId });
    return reply.send(serializeMedia(updated));
  });
}
