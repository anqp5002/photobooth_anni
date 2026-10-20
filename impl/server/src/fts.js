/**
 * FTS5 trên ảnh: caption, tags, nơi, tiêu đề mục.
 *
 * `node:sqlite` của Node 26 có FTS5 (kiểm bằng `CREATE VIRTUAL TABLE … USING fts5`);
 * nếu bản dựng nào thiếu FTS5 thì `ensureMediaFts` trả false và nơi gọi tự lùi về LIKE.
 */
const state = new WeakMap();

const FTS_DDL = `CREATE VIRTUAL TABLE IF NOT EXISTS media_fts USING fts5(
  caption, tags, place, collection_title,
  media_id UNINDEXED,
  family_id UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
)`;

/** Tạo bảng FTS nếu chưa có. Trả `true` khi FTS5 dùng được. */
export function ensureMediaFts(db) {
  if (state.has(db)) return state.get(db);
  let ok = false;
  try {
    db.exec(FTS_DDL);
    ok = true;
  } catch {
    ok = false;
  }
  state.set(db, ok);
  return ok;
}

export function hasFts(db) {
  return ensureMediaFts(db);
}

const tagsText = (value) => {
  if (Array.isArray(value)) return value.join(' ');
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join(' ') : '';
  } catch {
    return '';
  }
};

/**
 * `unicode61 remove_diacritics` bỏ dấu thanh nhưng KHÔNG đổi "đ" thành "d"
 * (đ là chữ riêng, không phải d + dấu). Chuẩn hoá trước khi đưa vào FTS để
 * gõ "da lat" vẫn tìm ra "Đà Lạt".
 */
export function normalizeVietnamese(text) {
  return String(text ?? '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Cập nhật một dòng FTS cho ảnh (gọi sau khi đổi caption/tags/nơi/mục). */
export function syncMediaFts(db, mediaId) {
  if (!ensureMediaFts(db)) return false;
  const id = Number(mediaId);
  if (!Number.isFinite(id)) return false;
  db.prepare('DELETE FROM media_fts WHERE media_id = ?').run(String(id));
  const row = db
    .prepare(
      `SELECT m.id, m.family_id, m.ai_caption, m.ai_tags, m.place, c.title AS collection_title
       FROM media m LEFT JOIN collections c ON c.id = m.collection_id
       WHERE m.id = ?`,
    )
    .get(id);
  if (!row) return true;
  db.prepare(
    `INSERT INTO media_fts (caption, tags, place, collection_title, media_id, family_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    normalizeVietnamese(row.ai_caption ?? ''),
    normalizeVietnamese(tagsText(row.ai_tags)),
    normalizeVietnamese(row.place ?? ''),
    normalizeVietnamese(row.collection_title ?? ''),
    String(row.id),
    String(row.family_id),
  );
  return true;
}

/** Xoá dòng FTS (khi ảnh bị xoá). */
export function removeMediaFts(db, mediaId) {
  if (!ensureMediaFts(db)) return false;
  db.prepare('DELETE FROM media_fts WHERE media_id = ?').run(String(Number(mediaId)));
  return true;
}

/** Dựng lại FTS cho một gia đình (hoặc toàn bộ khi `familyId` null). */
export function rebuildMediaFts(db, familyId = null) {
  if (!ensureMediaFts(db)) return 0;
  if (familyId == null) {
    db.prepare('DELETE FROM media_fts').run();
  } else {
    db.prepare('DELETE FROM media_fts WHERE family_id = ?').run(String(Number(familyId)));
  }
  const rows =
    familyId == null
      ? db.prepare('SELECT id FROM media ORDER BY id').all()
      : db.prepare('SELECT id FROM media WHERE family_id = ? ORDER BY id').all(Number(familyId));
  for (const row of rows) syncMediaFts(db, row.id);
  return rows.length;
}

/**
 * Câu người dùng → biểu thức MATCH của FTS5: mỗi từ thành tiền tố, nối AND.
 * `unicode61 remove_diacritics 2` nên "sinh nhat" vẫn khớp "sinh nhật".
 */
export function ftsQuery(text) {
  const tokens = normalizeVietnamese(String(text ?? ''))
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
    .slice(0, 12);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token.replace(/"/g, '')}"*`).join(' AND ');
}

/**
 * Tìm mã ảnh theo FTS. Trả `null` khi không có FTS5 (nơi gọi lùi về LIKE).
 * @returns {Array<{mediaId: number, rank: number}>|null}
 */
export function searchMediaIds(db, text, { familyId, limit = 50 } = {}) {
  if (!ensureMediaFts(db)) return null;
  const match = ftsQuery(text);
  if (!match) return [];
  const max = Math.min(200, Math.max(1, Number(limit) || 50));
  try {
    const rows = db
      .prepare(
        `SELECT media_id, bm25(media_fts) AS rank FROM media_fts
         WHERE media_fts MATCH ? AND family_id = ?
         ORDER BY rank LIMIT ?`,
      )
      .all(match, String(Number(familyId)), max);
    return rows.map((row) => ({ mediaId: Number(row.media_id), rank: Number(row.rank) }));
  } catch {
    return null;
  }
}
