import {
  COLLECTION_KINDS,
  collectionDetail,
  collectionOr404,
  mergeCollections,
  serializeCollection,
  splitCollection,
  syncCollectionFts,
} from '../collections.js';
import { bodyObject, optionalString, requireFamily, requireUser, requiredString } from '../http.js';
import { setSuggestionStatus, serializeSuggestion } from '../suggestions.js';
import { ingestFile, insertMedia } from '../ingest.js';
import { serializeMedia } from '../media.js';
import { syncMediaFts } from '../fts.js';
import { badRequest, nowIso } from '../util.js';

const STATUSES = new Set(['suggested', 'accepted']);

function parsePayload(row) {
  try {
    return row.payload ? JSON.parse(row.payload) : {};
  } catch {
    return {};
  }
}

export default async function collectionRoutes(app) {
  const { db } = app;

  app.get('/api/collections', async (req, reply) => {
    const familyId = requireFamily(req);
    const year = Number.parseInt(String(req.query.year ?? new Date().getUTCFullYear()), 10);
    const kind = req.query.kind ? String(req.query.kind) : null;
    if (kind && !COLLECTION_KINDS.includes(kind)) throw badRequest('invalid_kind');
    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;
    const rows = db
      .prepare(
        `SELECT * FROM collections WHERE family_id = ? AND start_at >= ? AND start_at < ?
         ${kind ? 'AND kind = ?' : ''}
         ORDER BY start_at, id`,
      )
      .all(familyId, from, to, ...(kind ? [kind] : []));
    return reply.send(rows.map((row) => serializeCollection(db, row)));
  });

  app.get('/api/collections/:id', async (req, reply) => {
    const familyId = requireFamily(req);
    const row = collectionOr404(db, familyId, req.params.id);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return reply.send(collectionDetail(db, row));
  });

  /**
   * Photobooth: nhận dải ảnh PNG thô (content-type image/png) do web ghép,
   * lưu thành MỘT ảnh mới trong mục — vẫn qua hàng đợi AI như ảnh tải lên.
   */
  app.post('/api/collections/:id/strips', async (req, reply) => {
    const familyId = requireFamily(req);
    const user = requireUser(req);
    const collection = collectionOr404(db, familyId, req.params.id);
    if (!collection) return reply.code(404).send({ error: 'not_found' });
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer || buffer.length === 0) throw badRequest('expected_png');
    const result = await ingestFile({ buffer, filename: 'photobooth.png', mediaDir: app.config.mediaDir });
    if (!result.ok) throw badRequest('invalid_png');
    const id = insertMedia(
      db,
      null,
      {
        ...result.media,
        takenAt: result.media.takenAt ?? nowIso(),
        place: result.media.place ?? collection.place ?? null,
      },
      { familyId, uploaderId: user.id, collectionId: collection.id, auto: 1 },
    );
    syncMediaFts(db, id);
    app.ai.enqueue?.(id);
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
    return reply.code(201).send(serializeMedia(row));
  });

  app.patch('/api/collections/:id', async (req, reply) => {
    const familyId = requireFamily(req);
    const row = collectionOr404(db, familyId, req.params.id);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    const body = bodyObject(req);
    const changes = [];
    const params = [];
    let userEdited = false;

    if (body.title !== undefined) {
      const title = requiredString(body.title, 'title', 80);
      changes.push('title = ?');
      params.push(title);
      userEdited = true;
    }
    if (body.summary !== undefined) {
      changes.push('summary = ?');
      params.push(optionalString(body.summary, 'summary', 400) ?? null);
      userEdited = true;
    }
    if (body.kind !== undefined) {
      if (!COLLECTION_KINDS.includes(body.kind)) throw badRequest('invalid_kind');
      changes.push('kind = ?');
      params.push(body.kind);
      userEdited = true;
    }
    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) throw badRequest('invalid_status');
      changes.push('status = ?');
      params.push(body.status);
    }
    if (userEdited) {
      changes.push("source = 'user'");
    }
    if (changes.length > 0) {
      db.prepare(`UPDATE collections SET ${changes.join(', ')}, updated_at = ? WHERE id = ?`).run(
        ...params,
        nowIso(),
        row.id,
      );
    }

    if (body.memberIds !== undefined) {
      if (!Array.isArray(body.memberIds)) throw badRequest('invalid_memberIds');
      const ids = [...new Set(body.memberIds.map((value) => Number(value)))].filter((id) =>
        Number.isFinite(id),
      );
      const findMember = db.prepare('SELECT 1 AS n FROM members WHERE id = ? AND family_id = ?');
      for (const id of ids) {
        if (!findMember.get(id, familyId)) throw badRequest('invalid_member');
      }
      db.prepare('DELETE FROM collection_members WHERE collection_id = ?').run(row.id);
      const insert = db.prepare('INSERT INTO collection_members (collection_id, member_id) VALUES (?, ?)');
      for (const id of ids) insert.run(row.id, id);
    }

    syncCollectionFts(db, familyId);
    const updated = collectionOr404(db, familyId, row.id);
    return reply.send(serializeCollection(db, updated));
  });

  app.post('/api/collections/:id/merge', async (req, reply) => {
    const familyId = requireFamily(req);
    const body = bodyObject(req);
    const intoId = Number(body.intoId);
    if (!Number.isFinite(intoId)) throw badRequest('invalid_intoId');
    const merged = mergeCollections(db, familyId, req.params.id, intoId);
    if (!merged) return reply.code(404).send({ error: 'not_found' });
    return reply.send(serializeCollection(db, merged));
  });

  app.post('/api/collections/:id/split', async (req, reply) => {
    const familyId = requireFamily(req);
    const body = bodyObject(req);
    const mediaId = Number(body.mediaId);
    if (!Number.isFinite(mediaId)) throw badRequest('invalid_mediaId');
    const created = splitCollection(db, familyId, req.params.id, mediaId);
    if (!created) return reply.code(404).send({ error: 'not_found' });
    return reply.code(201).send(serializeCollection(db, created));
  });

  const decide = (status) => async (req, reply) => {
    const familyId = requireFamily(req);
    const suggestion = db
      .prepare('SELECT * FROM suggestions WHERE id = ? AND family_id = ?')
      .get(Number(req.params.id), familyId);
    if (!suggestion) return reply.code(404).send({ error: 'not_found' });

    if (status === 'accepted') {
      const payload = parsePayload(suggestion);
      if (suggestion.type === 'hide_blurry' && suggestion.media_id) {
        db.prepare('UPDATE media SET hidden = 1 WHERE id = ? AND family_id = ?').run(
          suggestion.media_id,
          familyId,
        );
        syncCollectionFts(db, familyId);
      } else if (suggestion.type === 'merge' && suggestion.collection_id && payload.intoId) {
        mergeCollections(db, familyId, suggestion.collection_id, payload.intoId);
      } else if (suggestion.type === 'split' && suggestion.collection_id && payload.mediaId) {
        splitCollection(db, familyId, suggestion.collection_id, payload.mediaId);
      } else if (suggestion.type === 'rename' && suggestion.collection_id && payload.title) {
        db.prepare(
          "UPDATE collections SET title = ?, source = 'user', updated_at = ? WHERE id = ? AND family_id = ?",
        ).run(String(payload.title).slice(0, 80), nowIso(), suggestion.collection_id, familyId);
      }
    }

    const updated = setSuggestionStatus(db, familyId, suggestion.id, status);
    return reply.send({ ok: true, suggestion: serializeSuggestion(updated) });
  };

  app.post('/api/suggestions/:id/accept', decide('accepted'));
  app.post('/api/suggestions/:id/dismiss', decide('dismissed'));
}
