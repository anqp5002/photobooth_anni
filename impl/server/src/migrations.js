import { createFamily, ensureUserFamily, pickAvatarColor } from './family.js';
import { ensureMediaFts, rebuildMediaFts } from './fts.js';
import { nowIso } from './util.js';

/** Phiên bản lược đồ hiện tại (r2 = 3: thêm dhash cho media + bảng suggestions). */
export const SCHEMA_VERSION = 3;

/** Cột thêm sau bản cài đầu (DB cũ phải ALTER; DB mới đã có trong schema.sql). */
const ADDED_COLUMNS = [['media', 'dhash', 'TEXT']];

function ensureColumns(db) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    if (tableColumns(db, table).length > 0 && !tableColumns(db, table).includes(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }
}

export function getUserVersion(db) {
  const row = db.prepare('PRAGMA user_version').get();
  return Number(row?.user_version ?? 0);
}

export function setUserVersion(db, version) {
  db.exec(`PRAGMA user_version = ${Math.max(0, Math.trunc(Number(version) || 0))}`);
}

/** Tên cột của bảng (rỗng nếu bảng chưa có). */
export function tableColumns(db, table) {
  try {
    return db.prepare('SELECT name FROM pragma_table_info(?)').all(String(table)).map((row) => row.name);
  } catch {
    return [];
  }
}

export function hasTable(db, table) {
  try {
    const row = db
      .prepare("SELECT 1 AS n FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(String(table));
    return Boolean(row);
  } catch {
    return false;
  }
}

/** DB của r1: có bảng media nhưng chưa có cột family_id. */
export function isLegacyR1(db) {
  return hasTable(db, 'media') && !tableColumns(db, 'media').includes('family_id');
}

/**
 * Tách nguyên câu `CREATE TABLE IF NOT EXISTS <bảng> (…);` khỏi schema.sql
 * để bản migration và bản cài mới dùng đúng một nguồn DDL.
 */
export function tableDdl(schemaText, table) {
  const marker = `CREATE TABLE IF NOT EXISTS ${table}`;
  const start = schemaText.toLowerCase().indexOf(marker.toLowerCase());
  if (start < 0) throw new Error(`schema.sql thiếu bảng ${table}`);
  const open = schemaText.indexOf('(', start);
  let depth = 0;
  for (let i = open; i < schemaText.length; i += 1) {
    if (schemaText[i] === '(') depth += 1;
    else if (schemaText[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        const end = schemaText.indexOf(';', i);
        return schemaText.slice(start, end + 1);
      }
    }
  }
  throw new Error(`schema.sql: DDL ${table} không đóng ngoặc`);
}

function addColumn(db, table, column, ddl) {
  if (tableColumns(db, table).includes(column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  return true;
}

/**
 * Migration r1 → r2: thêm cột, tạo gia đình cho từng người dùng cũ, dựng lại
 * bảng media (thêm family_id/uploader_id/place/country/AI) mà KHÔNG mất dữ liệu.
 * Trả số liệu để test/REPORT đọc lại.
 */
export function migrateFromR1(db, schemaText) {
  const stamp = nowIso();
  db.exec(tableDdl(schemaText, 'families'));
  db.exec(tableDdl(schemaText, 'members'));
  // LƯU Ý: bảng `collections` phải tạo SAU khi dựng lại `media`. Nếu tạo trước,
  // `ALTER TABLE media RENAME TO media_r1` sẽ đổi FK `cover_media_id` trỏ sang
  // media_r1, rồi DROP bảng đó → mọi INSERT vào collections báo "no such table".

  addColumn(db, 'users', 'family_id', 'INTEGER REFERENCES families(id) ON DELETE SET NULL');
  addColumn(db, 'users', 'avatar_color', 'TEXT');
  addColumn(db, 'trips', 'family_id', 'INTEGER REFERENCES families(id) ON DELETE SET NULL');

  // 1. Mỗi người dùng r1 thành một gia đình "Nhà <tên>" + một member cùng tên.
  const users = db
    .prepare('SELECT id, username, display_name, family_id, avatar_color FROM users ORDER BY id')
    .all();
  let familiesCreated = 0;
  for (const user of users) {
    const hadFamily = Boolean(user.family_id);
    const family = ensureUserFamily(db, user, { stamp });
    if (!hadFamily) familiesCreated += 1;
    if (user.avatar_color == null) {
      db.prepare('UPDATE users SET avatar_color = ? WHERE id = ?').run(
        pickAvatarColor(user.username ?? user.display_name),
        user.id,
      );
    }
    db.prepare('UPDATE trips SET family_id = ? WHERE user_id = ?').run(family.id, user.id);
  }

  let fallbackFamilyId =
    db.prepare('SELECT id FROM families ORDER BY id LIMIT 1').get()?.id ?? null;
  if (fallbackFamilyId == null) {
    fallbackFamilyId = createFamily(db, 'Nhà của tôi', { stamp }).id;
  }
  db.prepare('UPDATE trips SET family_id = ? WHERE family_id IS NULL').run(fallbackFamilyId);

  // 2. Dựng lại media theo lược đồ r2.
  const before = db.prepare('SELECT COUNT(*) AS n FROM media').get().n;
  const mediaCols = tableColumns(db, 'media');
  const col = (name, fallback = 'NULL') => (mediaCols.includes(name) ? `m.${name}` : fallback);

  db.exec('ALTER TABLE media RENAME TO media_r1');
  // `collections` tạo SAU khi rename (để FK không bị đổi sang media_r1) nhưng TRƯỚC khi
  // chèn media mới (FK `collection_id` cần bảng cha tồn tại). Bảng cha `media` chỉ cần
  // có mặt lúc chèn dữ liệu, không cần lúc CREATE.
  db.exec(tableDdl(schemaText, 'collections'));
  db.exec(tableDdl(schemaText, 'media'));
  db.prepare(
    `INSERT INTO media (id, family_id, uploader_id, trip_id, step_id, collection_id, type, code, ext,
       orig_name, width, height, duration, taken_at, lat, lon, place, country, order_index,
       blurry, near_duplicate, hidden, auto, ai_status, ai_caption, ai_tags, ai_score, ai_kind_hint,
       created_at)
     SELECT ${col('id')}, COALESCE(t.family_id, ?), t.user_id, ${col('trip_id')}, ${col('step_id')},
       NULL, ${col('type')}, ${col('code')}, ${col('ext')}, ${col('orig_name')}, ${col('width')},
       ${col('height')}, ${col('duration')}, ${col('taken_at')}, ${col('lat')}, ${col('lon')},
       s.place_name, s.country_name, ${col('order_index', '0')}, ${col('blurry', '0')},
       ${col('near_duplicate', '0')}, ${col('hidden', '0')}, ${col('auto', '1')},
       'pending', NULL, NULL, NULL, NULL, ${col('created_at')}
     FROM media_r1 m
     LEFT JOIN trips t ON t.id = m.trip_id
     LEFT JOIN steps s ON s.id = m.step_id`,
  ).run(fallbackFamilyId);
  const after = db.prepare('SELECT COUNT(*) AS n FROM media').get().n;
  if (after !== before) {
    throw new Error(`migration mất ảnh: trước ${before}, sau ${after}`);
  }
  db.exec('DROP TABLE media_r1');

  ensureMediaFts(db);
  rebuildMediaFts(db);

  return { familiesCreated, users: users.length, media: after };
}

/** Nâng cấp lược đồ tới `SCHEMA_VERSION`; DB cài mới chỉ cần ghi phiên bản. */
export function migrate(db, schemaText) {
  const from = getUserVersion(db);
  const legacy = isLegacyR1(db);
  const result = { from, to: from, migrated: false };
  if (legacy) {
    result.details = migrateFromR1(db, schemaText);
    result.migrated = true;
  }
  ensureMediaFts(db);
  ensureColumns(db);
  if (from !== SCHEMA_VERSION) {
    setUserVersion(db, SCHEMA_VERSION);
    result.to = SCHEMA_VERSION;
    result.migrated = true;
  }
  return result;
}
