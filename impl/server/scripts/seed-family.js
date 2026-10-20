/**
 * Seed r2: gia đình "Nhà Bin & Su" — 27 ảnh proto, 7 mục kỷ niệm, 5 người trong nhà.
 *
 * Dữ liệu AI (caption/tags/score/kind_hint + ngày giờ, tọa độ, nơi, người) đọc từ
 * `scripts/seed-ai.json` — KHÔNG gọi AI, không cần key.
 *
 * Chạy:
 *   node scripts/seed-family.js                 # dùng DB_PATH/MEDIA_DIR mặc định
 *   DB_PATH=.data/tmp.db MEDIA_DIR=.data/media-tmp node scripts/seed-family.js
 *
 * Chạy lại được: dữ liệu của gia đình slug "bin-su" bị xoá trước khi tạo lại
 * (ảnh trên đĩa cũng bị dọn theo mã media).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { ingestFile, insertMedia } from '../src/ingest.js';
import { rebuildMediaFts } from '../src/fts.js';
import { nowIso } from '../src/util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(HERE, '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..', '..');
const PHOTOS_DIR = path.join(PROJECT_ROOT, 'design', 'proto', 'assets', 'photos');
const SCHEMA_SQL = fs.readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8');
const SEED_AI = JSON.parse(fs.readFileSync(path.join(HERE, 'seed-ai.json'), 'utf8'));

/* ------------------------------------------------------------------ */
/* Vá lỗi lược đồ còn sót từ migration r1 → r2                          */
/* ------------------------------------------------------------------ */

/** Có bảng này trong SQLite không? */
function hasTable(db, name) {
  return Boolean(
    db.prepare("SELECT 1 AS n FROM sqlite_master WHERE type = 'table' AND name = ?").get(name),
  );
}

/** Các khóa ngoại trỏ tới bảng không còn tồn tại (do migration r1 → r2 để lại). */
function danglingForeignKeys(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);
  const bad = [];
  for (const table of tables) {
    for (const fk of db.prepare(`PRAGMA foreign_key_list("${table}")`).all()) {
      if (!hasTable(db, fk.table)) bad.push({ table, column: fk.from, missing: fk.table });
    }
  }
  return bad;
}

/** Cắt đoạn `CREATE TABLE IF NOT EXISTS <bảng> (…);` ra khỏi schema.sql. */
function tableDdl(schemaText, table) {
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

/**
 * Dựng lại một bảng theo đúng DDL trong schema.sql để sửa khóa ngoại trỏ đứt.
 * Dùng `legacy_alter_table` để đổi tên không sửa khóa ngoại của bảng khác.
 */
function rebuildTable(db, table) {
  const ddl = tableDdl(SCHEMA_SQL, table).replace(
    new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i'),
    `CREATE TABLE IF NOT EXISTS ${table}__fix`,
  );
  const columns = db
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .map((row) => row.name);
  db.exec('PRAGMA legacy_alter_table = ON');
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec(ddl);
    db.exec(
      `INSERT INTO ${table}__fix (${columns.join(', ')}) SELECT ${columns.join(', ')} FROM "${table}"`,
    );
    db.exec(`DROP TABLE "${table}"`);
    db.exec(`ALTER TABLE ${table}__fix RENAME TO "${table}"`);
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA legacy_alter_table = OFF');
  }
  // Đặt lại chuỗi AUTOINCREMENT cho bảng vừa dựng lại.
  db.prepare('DELETE FROM sqlite_sequence WHERE name LIKE ?').run(`${table}%`);
  db.prepare(
    `INSERT INTO sqlite_sequence (name, seq) SELECT ?, COALESCE(MAX(id), 0) FROM "${table}"`,
  ).run(table);
  // Tạo lại các chỉ mục đã mất khi drop bảng.
  db.exec(SCHEMA_SQL);
}

/** Sửa các khóa ngoại đứt do migration r1 → r2 (nếu có). */
function repairSchema(db) {
  const bad = danglingForeignKeys(db);
  if (bad.length === 0) return [];
  const tables = [...new Set(bad.map((item) => item.table))];
  for (const table of tables) rebuildTable(db, table);
  const after = danglingForeignKeys(db);
  if (after.length > 0) {
    throw new Error(`còn khóa ngoại đứt sau khi vá: ${JSON.stringify(after)}`);
  }
  return bad;
}

/** Xoá sạch dữ liệu cũ của gia đình seed (trả về mã media để dọn tệp trên đĩa). */
function wipeFamily(db, slug) {
  const family = db.prepare('SELECT id FROM families WHERE slug = ?').get(slug);
  if (!family) return null;
  const codes = db
    .prepare('SELECT code FROM media WHERE family_id = ?')
    .all(family.id)
    .map((row) => row.code);
  db.prepare('DELETE FROM media WHERE family_id = ?').run(family.id);
  db.prepare('DELETE FROM collections WHERE family_id = ?').run(family.id);
  db.prepare('DELETE FROM suggestions WHERE family_id = ?').run(family.id);
  db.prepare('DELETE FROM members WHERE family_id = ?').run(family.id);
  db.prepare('DELETE FROM families WHERE id = ?').run(family.id);
  return codes;
}

/** Dọn thư mục ảnh của các mã media đã xoá. */
function removeMediaDirs(mediaDir, codes) {
  for (const code of codes) {
    fs.rmSync(path.join(mediaDir, code), { recursive: true, force: true });
  }
}

/**
 * Seed gia đình vào một DB đã mở. Dùng lại được cho test (`tests/api/r2-contract.test.mjs`).
 * @param {object} db DatabaseSync
 * @param {{mediaDir: string, data?: object, stamp?: string}} options
 * @returns {Promise<object>} số liệu tóm tắt
 */
export async function seedFamily(db, { mediaDir, data = SEED_AI, stamp = nowIso() } = {}) {
  if (!mediaDir) throw new Error('seedFamily: thiếu mediaDir');
  const slug = data.family.slug;

  // 1. Dọn dữ liệu seed cũ (chạy lại không nhân bản).
  const oldCodes = wipeFamily(db, slug);
  if (oldCodes) removeMediaDirs(mediaDir, oldCodes);
  for (const user of data.users) {
    db.prepare('DELETE FROM users WHERE username = ? OR email = ?').run(user.username, user.email);
  }

  // 2. Gia đình (slug cố định "bin-su").
  const familyInfo = db
    .prepare('INSERT INTO families (name, slug, created_at) VALUES (?, ?, ?)')
    .run(data.family.name, slug, stamp);
  const familyId = Number(familyInfo.lastInsertRowid);

  // 3. Tài khoản. `createUser` tự tạo gia đình riêng và chặn username "me"
  //    (RESERVED_USERNAMES), nên ở đây chèn thẳng để 2 tài khoản dùng chung 1 gia đình.
  const users = {};
  for (const user of data.users) {
    const info = db
      .prepare(
        `INSERT INTO users (username, email, display_name, password_hash, avatar, avatar_color,
           family_id, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      )
      .run(
        user.username,
        user.email,
        user.displayName,
        hashPassword(user.password),
        user.avatarColor,
        familyId,
        stamp,
      );
    users[user.username] = Number(info.lastInsertRowid);
  }

  // 4. Người trong nhà.
  const members = {};
  for (const member of data.members) {
    const info = db
      .prepare('INSERT INTO members (family_id, name, color, created_at) VALUES (?, ?, ?, ?)')
      .run(familyId, member.name, member.color, stamp);
    members[member.name] = Number(info.lastInsertRowid);
  }

  // 5. Ảnh: nạp qua hàm ingest của máy chủ (tự tạo bản gốc + lg + sm).
  const mediaByMockId = new Map();
  const mediaByFile = new Map();
  const uploaderId = users.bo ?? Object.values(users)[0];
  for (const photo of data.photos) {
    const file = path.join(PHOTOS_DIR, photo.file);
    if (!fs.existsSync(file)) throw new Error(`seed: thiếu ảnh ${file}`);
    const buffer = fs.readFileSync(file);
    const result = await ingestFile({ buffer, filename: photo.file, mediaDir });
    if (!result.ok) throw new Error(`seed: ${photo.file} — ${result.reason}`);
    const mediaId = insertMedia(db, null, result.media, {
      familyId,
      uploaderId,
      collectionId: null,
    });
    db.prepare(
      `UPDATE media SET taken_at = ?, lat = ?, lon = ?, place = ?, country = ?, order_index = ?,
         ai_caption = ?, ai_tags = ?, ai_score = ?, ai_kind_hint = ?, ai_status = ?,
         blurry = ?, near_duplicate = ?, hidden = ?
       WHERE id = ?`,
    ).run(
      photo.takenAt,
      photo.lat,
      photo.lon,
      photo.place,
      photo.country,
      photo.order,
      photo.caption,
      JSON.stringify(photo.tags),
      photo.score,
      photo.kindHint,
      photo.aiStatus,
      photo.flags.blurry ? 1 : 0,
      photo.flags.nearDuplicate ? 1 : 0,
      photo.flags.hidden ? 1 : 0,
      mediaId,
    );
    mediaByMockId.set(photo.mockId, mediaId);
    mediaByFile.set(photo.file, mediaId);
    for (const name of photo.members) {
      const memberId = members[name];
      if (!memberId) throw new Error(`seed: không có thành viên "${name}"`);
      db.prepare('INSERT OR IGNORE INTO media_members (media_id, member_id) VALUES (?, ?)').run(
        mediaId,
        memberId,
      );
    }
  }

  // 6. Mục kỷ niệm (7 mục, status=accepted).
  const collectionByMockId = new Map();
  for (const collection of data.collections) {
    const coverId = mediaByFile.get(collection.coverFile) ?? null;
    const info = db
      .prepare(
        `INSERT INTO collections (family_id, kind, title, summary, place, start_at, end_at,
           cover_media_id, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'accepted', 'ai', ?, ?)`,
      )
      .run(
        familyId,
        collection.kind,
        collection.title,
        collection.summary,
        collection.place,
        collection.startAt,
        collection.endAt,
        coverId,
        stamp,
        stamp,
      );
    const collectionId = Number(info.lastInsertRowid);
    collectionByMockId.set(collection.id, collectionId);
    for (const name of collection.members) {
      const memberId = members[name];
      if (!memberId) throw new Error(`seed: không có thành viên "${name}"`);
      db.prepare(
        'INSERT OR IGNORE INTO collection_members (collection_id, member_id) VALUES (?, ?)',
      ).run(collectionId, memberId);
    }
  }

  // 7. Gắn ảnh vào mục.
  for (const photo of data.photos) {
    if (!photo.collectionId) continue;
    const collectionId = collectionByMockId.get(photo.collectionId);
    if (!collectionId) throw new Error(`seed: không có mục "${photo.collectionId}"`);
    db.prepare('UPDATE media SET collection_id = ? WHERE id = ?').run(
      collectionId,
      mediaByMockId.get(photo.mockId),
    );
  }

  // 8. Gợi ý của AI (mỗi mục 4 loại) — payload đổi id mẫu sang id thật trong DB.
  let suggestionCount = 0;
  for (const collection of data.collections) {
    const collectionId = collectionByMockId.get(collection.id);
    for (const suggestion of collection.suggestions) {
      const payload = { ...suggestion.payload };
      if (Array.isArray(payload.mediaIds)) {
        payload.mediaIds = payload.mediaIds
          .map((mockId) => mediaByMockId.get(mockId))
          .filter((id) => typeof id === 'number');
      }
      if (typeof payload.mediaId === 'string') {
        const mapped = mediaByMockId.get(payload.mediaId);
        if (mapped) payload.mediaId = mapped;
      }
      if (typeof payload.intoId === 'string') {
        const mapped = collectionByMockId.get(payload.intoId);
        if (mapped) payload.intoId = mapped;
      }
      db.prepare(
        `INSERT INTO suggestions (family_id, collection_id, media_id, type, text, payload, status, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, 'open', ?)`,
      ).run(familyId, collectionId, suggestion.type, suggestion.text, JSON.stringify(payload), stamp);
      suggestionCount += 1;
    }
  }

  // 9. Dựng lại chỉ mục FTS để tìm kiếm bằng tiếng Việt có dấu.
  const ftsRows = rebuildMediaFts(db, familyId);

  const counts = {
    media: db.prepare('SELECT COUNT(*) AS n FROM media WHERE family_id = ?').get(familyId).n,
    collections: db.prepare('SELECT COUNT(*) AS n FROM collections WHERE family_id = ?').get(familyId).n,
    members: db.prepare('SELECT COUNT(*) AS n FROM members WHERE family_id = ?').get(familyId).n,
    suggestions: db.prepare('SELECT COUNT(*) AS n FROM suggestions WHERE family_id = ?').get(familyId).n,
    links: db.prepare('SELECT COUNT(*) AS n FROM media_members WHERE media_id IN (SELECT id FROM media WHERE family_id = ?)').get(familyId).n,
    ftsRows,
  };

  return {
    familyId,
    slug,
    familyName: data.family.name,
    users,
    members,
    collections: collectionByMockId,
    mediaByMockId,
    mediaByFile,
    counts,
  };
}

/** Chạy seed từ dòng lệnh. */
async function main() {
  const config = loadConfig();
  const db = openDb(config.dbPath);

  // Vá lược đồ nếu migration r1 → r2 để lại khóa ngoại đứt.
  const repaired = repairSchema(db);
  if (repaired.length > 0) {
    console.log(
      `Đã vá lược đồ: ${repaired
        .map((item) => `${item.table}.${item.column} -> ${item.missing} (bảng không còn)`)
        .join(', ')}`,
    );
  }

  const summary = await seedFamily(db, { mediaDir: config.mediaDir });
  const { familyId, slug, familyName, users, members, counts } = summary;

  console.log('Seed xong:');
  console.log(`  gia đình: #${familyId} "${familyName}" (slug ${slug})`);
  console.log(
    `  tài khoản: ${Object.entries(users)
      .map(([username, id]) => `${username}@bin-su.vn (#${id})`)
      .join(', ')} — mật khẩu kyniem123`,
  );
  console.log(`  người trong nhà: ${Object.entries(members).map(([n, id]) => `${n} (#${id})`).join(', ')}`);
  console.log(
    `  media: ${counts.media}, mục: ${counts.collections}, gợi ý: ${counts.suggestions}, ` +
      `gắn người: ${counts.links}, dòng FTS: ${counts.ftsRows}`,
  );
  for (const row of db
    .prepare('SELECT id, kind, title, place FROM collections WHERE family_id = ? ORDER BY start_at')
    .all(familyId)) {
    const n = db
      .prepare('SELECT COUNT(*) AS n FROM media WHERE collection_id = ?')
      .get(row.id).n;
    console.log(`   - #${row.id} [${row.kind}] ${row.title} (${row.place}) — ${n} ảnh mẫu`);
  }
  console.log(`  DB: ${config.dbPath}`);
  console.log(`  Media: ${config.mediaDir}`);

  db.close();
}

// Chỉ chạy khi gọi trực tiếp (`node scripts/seed-family.js`), không chạy khi được import.
const isDirectRun = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;
if (isDirectRun) {
  main().catch((err) => {
    console.error('Seed lỗi:', err);
    process.exit(1);
  });
}
