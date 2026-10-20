import { nowIso } from './util.js';

/**
 * Gợi ý cho người dùng nhận/bỏ qua. Mỗi (loại, đối tượng) chỉ có tối đa một
 * gợi ý đang mở — tạo trùng thì trả về gợi ý cũ.
 */
export function ensureSuggestion(
  db,
  { familyId, type, text, mediaId = null, collectionId = null, payload = null },
) {
  const media = mediaId == null ? null : Number(mediaId);
  const collection = collectionId == null ? null : Number(collectionId);
  const existing = db
    .prepare(
      `SELECT * FROM suggestions
       WHERE type = ? AND IFNULL(media_id, 0) = ? AND IFNULL(collection_id, 0) = ? AND status = 'open'`,
    )
    .get(type, media ?? 0, collection ?? 0);
  if (existing) return existing;
  const info = db
    .prepare(
      `INSERT INTO suggestions (family_id, collection_id, media_id, type, text, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
    )
    .run(
      Number(familyId),
      collection,
      media,
      type,
      String(text).slice(0, 300),
      payload == null ? null : JSON.stringify(payload),
      nowIso(),
    );
  return db.prepare('SELECT * FROM suggestions WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function serializeSuggestion(row) {
  if (!row) return null;
  let payload = null;
  try {
    payload = row.payload ? JSON.parse(row.payload) : null;
  } catch {
    payload = null;
  }
  return {
    id: row.id,
    type: row.type,
    text: row.text,
    payload,
    status: row.status,
    mediaId: row.media_id ?? null,
    collectionId: row.collection_id ?? null,
  };
}

export function listSuggestions(db, familyId, { collectionId = null, status = 'open' } = {}) {
  const rows =
    collectionId == null
      ? db
          .prepare('SELECT * FROM suggestions WHERE family_id = ? AND status = ? ORDER BY id')
          .all(Number(familyId), status)
      : db
          .prepare(
            'SELECT * FROM suggestions WHERE family_id = ? AND collection_id = ? AND status = ? ORDER BY id',
          )
          .all(Number(familyId), Number(collectionId), status);
  return rows.map(serializeSuggestion);
}

/** Người dùng nhận (`accepted`) hoặc bỏ qua (`dismissed`) một gợi ý. */
export function setSuggestionStatus(db, familyId, id, status) {
  const row = db
    .prepare('SELECT * FROM suggestions WHERE id = ? AND family_id = ?')
    .get(Number(id), Number(familyId));
  if (!row) return null;
  db.prepare('UPDATE suggestions SET status = ? WHERE id = ?').run(status, row.id);
  return db.prepare('SELECT * FROM suggestions WHERE id = ?').get(row.id);
}
