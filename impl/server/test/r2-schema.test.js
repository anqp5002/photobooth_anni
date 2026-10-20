import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { createGeoIndex } from '../src/geo.js';
import { loadConfig } from '../src/config.js';
import { hasFts, searchMediaIds, syncMediaFts } from '../src/fts.js';
import { parseTags, serializeMedia } from '../src/media.js';
import { SCHEMA_VERSION } from '../src/migrations.js';

const geo = createGeoIndex([], []);

async function makeApp() {
  const mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-r2-'));
  const config = {
    ...loadConfig({}),
    dbPath: ':memory:',
    mediaDir,
    webDist: path.join(mediaDir, 'khong-co-web'),
    aiProvider: 'mock',
    logger: false,
  };
  const db = openDb(':memory:');
  const app = await buildApp({ config, db, geo });
  return { app, db, mediaDir, config };
}

function client(app) {
  let cookie = '';
  return async function call(method, url, { payload, headers = {} } = {}) {
    const res = await app.inject({ method, url, payload, headers: { cookie, ...headers } });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) cookie = String(setCookie).split(';')[0];
    let json = null;
    try {
      json = JSON.parse(res.body);
    } catch {
      /* không phải JSON */
    }
    return { status: res.statusCode, headers: res.headers, json, text: res.body };
  };
}

test('r2 auth: đăng ký tạo gia đình, /api/me đúng hợp đồng, 401 khi chưa đăng nhập', async (t) => {
  const { app, db, mediaDir } = await makeApp();
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const bin = client(app);
  const su = client(app);
  const anon = client(app);

  let r = await bin('POST', '/api/auth/register', {
    payload: {
      username: 'bin',
      email: 'bin@example.com',
      password: 'kyniem123',
      displayName: 'Bin',
      familyName: 'Nhà Bin & Su',
    },
  });
  assert.equal(r.status, 201, r.text);
  assert.deepEqual(Object.keys(r.json.user).sort(), ['avatarColor', 'displayName', 'id', 'username']);
  assert.equal(r.json.user.displayName, 'Bin');
  assert.match(r.json.user.avatarColor, /^#[0-9A-F]{6}$/i);
  assert.equal(r.json.family.name, 'Nhà Bin & Su');
  assert.equal(r.json.family.slug, 'nha-bin-su');
  assert.match(String(r.headers['set-cookie']), /HttpOnly/i);

  r = await bin('GET', '/api/me');
  assert.equal(r.status, 200);
  assert.equal(r.json.user.username, 'bin');
  assert.equal(r.json.family.name, 'Nhà Bin & Su');
  // người đăng ký là một thành viên trong nhà
  const members = db.prepare('SELECT name, color FROM members WHERE family_id = ?').all(r.json.family.id);
  assert.deepEqual(members.map((m) => m.name), ['Bin']);

  r = await anon('GET', '/api/me');
  assert.equal(r.status, 401);
  assert.equal(r.json.error, 'unauthorized');

  // không truyền familyName → "Nhà <tên hiển thị>"
  r = await su('POST', '/api/auth/register', {
    payload: { username: 'subin', email: 'su@example.com', password: 'kyniem123', displayName: 'Su' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.family.name, 'Nhà Su');
  assert.notEqual(r.json.family.id, db.prepare('SELECT family_id FROM users WHERE username = ?').get('bin').family_id);

  // đăng nhập trả cùng hình dạng {user, family}
  r = await anon('POST', '/api/auth/login', {
    payload: { email: 'bin@example.com', password: 'kyniem123' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.user.username, 'bin');
  assert.equal(r.json.family.name, 'Nhà Bin & Su');

  r = await anon('POST', '/api/auth/login', {
    payload: { email: 'bin@example.com', password: 'sai-mat-khau' },
  });
  assert.equal(r.status, 401);

  // hai lần đăng ký cùng tên gia đình vẫn tạo slug khác nhau
  const extra = client(app);
  r = await extra('POST', '/api/auth/register', {
    payload: {
      username: 'ong',
      email: 'ong@example.com',
      password: 'kyniem123',
      familyName: 'Nhà Bin & Su',
    },
  });
  assert.equal(r.status, 201);
  assert.notEqual(r.json.family.slug, 'nha-bin-su');
});

test('r2 tách gia đình: dữ liệu nhà này không lộ sang nhà khác', async (t) => {
  const { app, db, mediaDir } = await makeApp();
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const owner = client(app);
  const stranger = client(app);

  await owner('POST', '/api/auth/register', {
    payload: { username: 'bin', email: 'bin@example.com', password: 'kyniem123' },
  });
  let r = await owner('GET', '/api/me');
  assert.equal(r.status, 200);
  const ownerFamilyId = db.prepare('SELECT family_id FROM users WHERE username = ?').get('bin').family_id;
  const collection = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, start_at, end_at, status, source, created_at, updated_at)
       VALUES (?, 'trip', 'Hè ở Đà Lạt', '2026-06-01', '2026-06-03', 'accepted', 'user',
               '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z')`,
    )
    .run(ownerFamilyId);
  const collectionId = Number(collection.lastInsertRowid);
  await stranger('POST', '/api/auth/register', {
    payload: { username: 'khach', email: 'khach@example.com', password: 'kyniem123' },
  });

  r = await stranger('GET', `/api/collections/${collectionId}`);
  assert.equal(r.status, 404, 'mục của gia đình khác phải ẩn');
  r = await owner('GET', `/api/collections/${collectionId}`);
  assert.equal(r.status, 200);

  // ảnh thuộc đúng gia đình
  const familyId = db.prepare('SELECT family_id FROM users WHERE username = ?').get('bin').family_id;
  const otherFamilyId = db.prepare('SELECT family_id FROM users WHERE username = ?').get('khach').family_id;
  db.prepare(
    `INSERT INTO media (family_id, uploader_id, type, code, ext, taken_at, place, created_at)
     VALUES (?, 1, 'photo', 'code-r2-0001', 'jpg', '2026-06-01T03:00:00Z', 'Đà Lạt', '2026-06-01T03:00:00Z')`,
  ).run(familyId);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media WHERE family_id = ?').get(familyId).n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media WHERE family_id = ?').get(otherFamilyId).n, 0);
});

test('r2 FTS5: có FTS5, đồng bộ và tìm không dấu', async (t) => {
  const { app, db, mediaDir } = await makeApp();
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  assert.equal(hasFts(db), true, 'node:sqlite của Node 26 phải có FTS5');

  const info = db
    .prepare(
      `INSERT INTO families (name, slug, created_at) VALUES ('Nhà Bin & Su', 'nha-bin-su', '2026-01-01T00:00:00Z')`,
    )
    .run();
  const familyId = Number(info.lastInsertRowid);
  const media = db
    .prepare(
      `INSERT INTO media (family_id, type, code, ext, taken_at, place, ai_status, ai_caption, ai_tags, created_at)
       VALUES (?, 'photo', 'code-fts-0001', 'jpg', '2026-02-14T10:00:00Z', 'Đà Lạt',
               'done', 'Cả nhà ăn tối ở Đà Lạt', '["bánh kem","sinh nhật"]', '2026-02-14T10:00:00Z')`,
    )
    .run(familyId);
  const mediaId = Number(media.lastInsertRowid);
  assert.equal(syncMediaFts(db, mediaId), true);

  const found = searchMediaIds(db, 'da lat', { familyId });
  assert.deepEqual(found.map((row) => row.mediaId), [mediaId]);
  const foundTags = searchMediaIds(db, 'sinh nhat', { familyId });
  assert.deepEqual(foundTags.map((row) => row.mediaId), [mediaId]);
  assert.deepEqual(searchMediaIds(db, 'da lat', { familyId: familyId + 999 }), []);
});

test('r2 Media: shape đúng hợp đồng, tags đọc an toàn', () => {
  const row = {
    id: 7,
    type: 'photo',
    code: 'abc12345',
    ext: 'jpg',
    taken_at: '2026-06-01T03:00:00Z',
    place: 'Đà Lạt',
    country: 'Việt Nam',
    lat: 11.94,
    lon: 108.45,
    ai_caption: 'Cả nhà trên đồi chè',
    ai_tags: '["đồi chè","Cầu Đất"]',
    ai_score: 8,
    collection_id: 3,
    width: 1440,
    height: 1080,
    blurry: 0,
    near_duplicate: 1,
    hidden: 0,
    ai_status: 'done',
  };
  const out = serializeMedia(row);
  assert.deepEqual(out, {
    id: 7,
    type: 'photo',
    takenAt: '2026-06-01T03:00:00Z',
    place: 'Đà Lạt',
    country: 'Việt Nam',
    lat: 11.94,
    lon: 108.45,
    caption: 'Cả nhà trên đồi chè',
    tags: ['đồi chè', 'Cầu Đất'],
    score: 8,
    collectionId: 3,
    width: 1440,
    height: 1080,
    url: {
      sm: '/media/abc12345/sm.jpg',
      lg: '/media/abc12345/lg.jpg',
      orig: '/media/abc12345/orig.jpg',
    },
    flags: { blurry: false, nearDuplicate: true, hidden: false },
    aiStatus: 'done',
  });
  assert.deepEqual(parseTags('không phải json'), []);
  assert.deepEqual(parseTags(null), []);
  assert.deepEqual(parseTags(['a', 1, 'b']), ['a', 'b']);
});

test('r2 migration: DB r1 được thêm cột, gia đình, giữ nguyên ảnh', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-mig-'));
  const dbPath = path.join(dir, 'r1.db');
  const r1 = new DatabaseSync(dbPath);
  r1.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, slug TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
      started_at TEXT, ended_at TEXT,
      views INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      name TEXT NOT NULL, description TEXT, started_at TEXT, lat REAL, lon REAL,
      place_name TEXT, country_code TEXT, country_name TEXT,
      weather_temp_c REAL, weather_icon TEXT,
      comments INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0, auto INTEGER NOT NULL DEFAULT 1,
      draft_name TEXT, draft_description TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      step_id INTEGER REFERENCES steps(id) ON DELETE SET NULL,
      type TEXT NOT NULL, code TEXT NOT NULL UNIQUE, ext TEXT NOT NULL, orig_name TEXT,
      width INTEGER, height INTEGER, duration REAL, taken_at TEXT, lat REAL, lon REAL,
      order_index INTEGER NOT NULL DEFAULT 0,
      blurry INTEGER NOT NULL DEFAULT 0, near_duplicate INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0, auto INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_media_trip ON media(trip_id, step_id, order_index);
    CREATE INDEX idx_media_step ON media(step_id);
    CREATE TABLE segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      from_step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
      to_step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
      vehicle TEXT NOT NULL DEFAULT 'none', kind TEXT NOT NULL DEFAULT 'straight',
      polyline TEXT NOT NULL
    );

    INSERT INTO users (username, email, display_name, password_hash, avatar, created_at)
    VALUES ('minh', 'minh@example.com', 'Minh', 'scrypt$x', NULL, '2026-01-01T00:00:00Z');
    INSERT INTO trips (user_id, name, slug, visibility, created_at, updated_at)
    VALUES (1, 'Đà Lạt 2026', 'da-lat-2026', 'public', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z');
    INSERT INTO steps (trip_id, name, started_at, lat, lon, place_name, country_code, country_name,
      sort_order, auto, created_at, updated_at)
    VALUES (1, 'Buổi sáng ở Đà Lạt', '2026-01-03T02:00:00Z', 11.9404, 108.4583, 'Đà Lạt', 'VN',
      'Việt Nam', 0, 1, '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z');
    INSERT INTO media (trip_id, step_id, type, code, ext, orig_name, width, height, taken_at, lat, lon,
      order_index, blurry, near_duplicate, hidden, auto, created_at)
    VALUES (1, 1, 'photo', 'legacy000001', 'jpg', 'IMG_1.jpg', 1440, 1080, '2026-01-03T02:10:00Z',
      11.9404, 108.4583, 0, 0, 0, 0, 1, '2026-01-03T02:11:00Z');
    INSERT INTO segments (trip_id, from_step_id, to_step_id, vehicle, kind, polyline)
    VALUES (1, 1, 1, 'car', 'straight', 'abc');
  `);
  r1.close();

  const db = openDb(dbPath);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);

  const family = db.prepare('SELECT * FROM families').get();
  assert.equal(family.name, 'Nhà Minh');

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get('minh');
  assert.equal(user.family_id, family.id);
  assert.match(String(user.avatar_color), /^#[0-9A-F]{6}$/i);

  const trip = db.prepare('SELECT * FROM trips WHERE id = 1').get();
  assert.equal(trip.family_id, family.id);

  const media = db.prepare('SELECT * FROM media WHERE id = 1').get();
  assert.equal(media.code, 'legacy000001');
  assert.equal(media.taken_at, '2026-01-03T02:10:00Z');
  assert.equal(media.width, 1440);
  assert.equal(media.family_id, family.id);
  assert.equal(media.uploader_id, user.id);
  assert.equal(media.place, 'Đà Lạt');
  assert.equal(media.country, 'Việt Nam');
  assert.equal(media.ai_status, 'pending');
  assert.equal(media.collection_id, null);

  // dữ liệu cũ còn nguyên
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM steps').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM segments').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM members').get().n, 1);

  // FTS dựng lại không lỗi
  assert.equal(hasFts(db), true);

  // FK của collections phải trỏ tới `media` (không phải bảng tạm media_r1 đã bị drop):
  // chèn mục mới trên DB vừa migrate phải chạy được.
  const collectionFks = db
    .prepare("SELECT \"table\" AS tbl FROM pragma_foreign_key_list('collections')")
    .all()
    .map((row) => row.tbl);
  assert.ok(collectionFks.includes('media'), `FK collections: ${collectionFks.join(',')}`);
  assert.ok(!collectionFks.includes('media_r1'));
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 'media_r1'").get(), undefined);
  const inserted = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, start_at, end_at, status, source, created_at, updated_at)
       VALUES (?, 'trip', 'Đà Lạt sau migrate', '2026-01-03', '2026-01-04', 'suggested', 'ai', ?, ?)`,
    )
    .run(family.id, '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z');
  assert.ok(Number(inserted.lastInsertRowid) > 0);
  db.close();

  // mở lại: không tạo thêm gia đình, không nhân đôi dữ liệu
  const again = openDb(dbPath);
  assert.equal(again.prepare('SELECT COUNT(*) AS n FROM families').get().n, 1);
  assert.equal(again.prepare('SELECT COUNT(*) AS n FROM members').get().n, 1);
  assert.equal(again.prepare('SELECT COUNT(*) AS n FROM media').get().n, 1);
  again.close();

  await fs.rm(dir, { recursive: true, force: true });
});
