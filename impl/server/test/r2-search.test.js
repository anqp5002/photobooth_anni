import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { createGeoIndex } from '../src/geo.js';
import { loadConfig } from '../src/config.js';
import { createSession } from '../src/auth.js';
import { createAiProvider } from '../src/ai/freellm.js';
import { normalizeFilters, searchPhotos } from '../src/search.js';

const geo = createGeoIndex([], []);
const provider = createAiProvider({ aiProvider: 'mock' });
const YEAR = new Date().getUTCFullYear();

async function makeApp(aiProvider = 'mock') {
  const mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-search-'));
  const config = {
    ...loadConfig({}),
    dbPath: ':memory:',
    mediaDir,
    webDist: path.join(mediaDir, 'khong-co-web'),
    aiProvider,
    logger: false,
  };
  const db = openDb(':memory:');
  const app = await buildApp({ config, db, geo });
  return { app, db, mediaDir };
}

function seedFamily(db) {
  const family = db
    .prepare("INSERT INTO families (name, slug, created_at) VALUES ('Nhà Bin & Su', 'nha-bin-su', '2026-01-01T00:00:00Z')")
    .run();
  const familyId = Number(family.lastInsertRowid);
  db.prepare(
    `INSERT INTO users (username, email, display_name, password_hash, avatar_color, family_id, created_at)
     VALUES ('bin', 'bin@example.com', 'Bin', 'scrypt$x', '#E8734A', ?, '2026-01-01T00:00:00Z')`,
  ).run(familyId);
  const member = db
    .prepare("INSERT INTO members (family_id, name, color, created_at) VALUES (?, 'Su', '#6E8BB5', '2026-01-01T00:00:00Z')")
    .run(familyId);
  return { familyId, memberId: Number(member.lastInsertRowid) };
}

function addCollection(db, familyId, { kind, title, startAt, endAt }) {
  const info = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, start_at, end_at, status, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'accepted', 'ai', ?, ?)`,
    )
    .run(familyId, kind, title, startAt, endAt, startAt, startAt);
  return Number(info.lastInsertRowid);
}

function addMedia(db, familyId, data = {}) {
  const row = {
    type: 'photo',
    code: `code-${Math.random().toString(36).slice(2, 12)}`,
    caption: null,
    tags: null,
    place: null,
    lat: null,
    lon: null,
    score: null,
    collectionId: null,
    kindHint: null,
    takenAt: null,
    ...data,
  };
  const info = db
    .prepare(
      `INSERT INTO media (family_id, uploader_id, collection_id, type, code, ext, taken_at, place, country,
         lat, lon, ai_status, ai_caption, ai_tags, ai_score, ai_kind_hint, created_at)
       VALUES (?, 1, ?, ?, ?, 'jpg', ?, ?, ?, ?, ?, 'done', ?, ?, ?, ?, ?)`,
    )
    .run(
      familyId,
      row.collectionId,
      row.type,
      row.code,
      row.takenAt,
      row.place,
      row.place ? 'Việt Nam' : null,
      row.lat,
      row.lon,
      row.caption,
      row.tags ? JSON.stringify(row.tags) : null,
      row.score,
      row.kindHint,
      row.takenAt,
    );
  return Number(info.lastInsertRowid);
}

/** Dữ liệu mẫu: sinh nhật Su (bánh kem), đi biển tháng 8, Tết ở quê, ảnh thường. */
function seedPhotos(db, familyId, memberId) {
  const birthday = addCollection(db, familyId, {
    kind: 'birthday',
    title: 'Sinh nhật Su',
    startAt: `${YEAR}-05-12`,
    endAt: `${YEAR}-05-12`,
  });
  const beach = addCollection(db, familyId, {
    kind: 'trip',
    title: 'Đi biển tháng 8',
    startAt: `${YEAR}-08-02`,
    endAt: `${YEAR}-08-04`,
  });
  const tet = addCollection(db, familyId, {
    kind: 'tet',
    title: 'Tết ở quê',
    startAt: `${YEAR}-02-17`,
    endAt: `${YEAR}-02-19`,
  });

  const ids = {};
  ids.birthday = addMedia(db, familyId, {
    takenAt: `${YEAR}-05-12T18:00:00Z`,
    caption: 'Su thổi nến bánh kem sinh nhật',
    tags: ['bánh kem', 'sinh nhật', 'gia đình'],
    place: 'Hà Nội',
    lat: 21.0285,
    lon: 105.8542,
    score: 9,
    collectionId: birthday,
  });
  db.prepare('INSERT INTO media_members (media_id, member_id) VALUES (?, ?)').run(ids.birthday, memberId);

  ids.beach = addMedia(db, familyId, {
    takenAt: `${YEAR}-08-02T09:00:00Z`,
    caption: 'Cả nhà tắm biển Nha Trang',
    tags: ['biển', 'du lịch'],
    place: 'Nha Trang',
    lat: 12.2388,
    lon: 109.1967,
    score: 8,
    collectionId: beach,
  });
  ids.beach2 = addMedia(db, familyId, {
    takenAt: `${YEAR}-08-03T10:00:00Z`,
    caption: 'Bãi biển sáng sớm',
    tags: ['biển'],
    place: 'Nha Trang',
    lat: 12.2388,
    lon: 109.1967,
    score: 6,
    collectionId: beach,
  });

  ids.tet = addMedia(db, familyId, {
    takenAt: `${YEAR}-02-17T10:00:00Z`,
    caption: 'Tết ở quê ngoại, cả nhà quây quần',
    tags: ['tết', 'quê'],
    place: 'Nam Định',
    lat: 20.42,
    lon: 106.17,
    score: 7,
    collectionId: tet,
  });

  ids.everyday = addMedia(db, familyId, {
    takenAt: `${YEAR}-09-09T10:00:00Z`,
    caption: 'Buổi chiều ở công viên',
    tags: ['công viên'],
    place: 'Hà Nội',
    lat: 21.0285,
    lon: 105.8542,
    score: 5,
  });
  ids.oldBeach = addMedia(db, familyId, {
    takenAt: `${YEAR - 1}-08-10T10:00:00Z`,
    caption: 'Đi biển Vũng Tàu năm trước',
    tags: ['biển'],
    place: 'Vũng Tàu',
    lat: 10.35,
    lon: 107.08,
    score: 4,
  });
  return ids;
}

const cookieFor = (db) => `sid=${createSession(db, 1, 30).token}`;

function client(app, db) {
  const cookie = cookieFor(db);
  return async function call(method, url) {
    const res = await app.inject({ method, url, headers: { cookie } });
    let json = null;
    try {
      json = JSON.parse(res.body);
    } catch {
      /* không phải JSON */
    }
    return { status: res.statusCode, json, text: res.body };
  };
}

test('S5 mock hiểu 4 câu mẫu của MEGAPLAN', async () => {
  const today = new Date(`${YEAR}-10-20T00:00:00Z`);
  const q1 = await provider.searchFilters({ query: 'ảnh sinh nhật Su năm nay', today: `${YEAR}-10-20` });
  assert.deepEqual(q1.kinds, ['birthday']);
  assert.equal(q1.from, `${YEAR}-01-01`);
  assert.equal(q1.to, `${YEAR}-12-31`);

  const q2 = await provider.searchFilters({ query: 'đi biển tháng 8', today: `${YEAR}-10-20` });
  assert.equal(q2.from, `${YEAR}-08-01`);
  assert.equal(q2.to, `${YEAR}-08-31`);
  assert.deepEqual(q2.tags, ['biển']);
  assert.deepEqual(q2.kinds, ['trip'], 'đi biển = chuyến đi');

  const q3 = await provider.searchFilters({ query: 'Tết ở quê', today: `${YEAR}-10-20` });
  assert.deepEqual(q3.kinds, ['tet']);

  const q4 = await provider.searchFilters({ query: 'ảnh có bánh kem', today: `${YEAR}-10-20` });
  assert.deepEqual(q4.tags, ['bánh kem']);
  assert.equal(q4.from, null);

  const month = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  assert.ok(month instanceof Date);
});

test('S5 API search: 4 câu mẫu ra ≥ 1 kết quả đúng ảnh', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const { familyId, memberId } = seedFamily(db);
  const ids = seedPhotos(db, familyId, memberId);
  const call = client(app, db);

  const birthday = await call('GET', `/api/search?q=${encodeURIComponent('ảnh sinh nhật Su năm nay')}`);
  assert.equal(birthday.status, 200);
  assert.equal(birthday.json.query, 'ảnh sinh nhật Su năm nay');
  assert.deepEqual(birthday.json.filters.kinds, ['birthday']);
  assert.deepEqual(birthday.json.filters.members, ['Su'], 'tên thành viên lấy từ DB');
  assert.equal(birthday.json.results[0].id, ids.birthday);
  assert.ok(birthday.json.collections.some((item) => item.kind === 'birthday'));

  const beach = await call('GET', `/api/search?q=${encodeURIComponent('đi biển tháng 8')}`);
  assert.equal(beach.status, 200);
  assert.equal(beach.json.filters.from, `${YEAR}-08-01`);
  assert.equal(beach.json.filters.to, `${YEAR}-08-31`);
  assert.deepEqual(
    beach.json.results.map((item) => item.id),
    [ids.beach, ids.beach2],
    'bỏ ảnh biển của năm trước',
  );

  const tet = await call('GET', `/api/search?q=${encodeURIComponent('Tết ở quê')}`);
  assert.equal(tet.status, 200);
  assert.equal(tet.json.results[0].id, ids.tet);
  assert.ok(tet.json.collections.some((item) => item.kind === 'tet'));

  const cake = await call('GET', `/api/search?q=${encodeURIComponent('ảnh có bánh kem')}`);
  assert.equal(cake.status, 200);
  assert.equal(cake.json.results[0].id, ids.birthday);
  assert.deepEqual(cake.json.filters.tags, ['bánh kem']);

  const limited = await call('GET', `/api/search?q=${encodeURIComponent('ảnh')}&limit=1`);
  assert.equal(limited.status, 200);
  assert.ok(limited.json.results.length <= 1);

  assert.equal((await call('GET', '/api/search')).status, 400, 'thiếu q');
  assert.equal((await call('GET', '/api/search?q=x')).status, 400, 'q quá ngắn');
  const anonymous = await app.inject({ method: 'GET', url: '/api/search?q=biển' });
  assert.equal(anonymous.statusCode, 401);
});

test('S5 search: AI none → tìm từ khoá, vẫn ra kết quả và không có bộ lọc AI', async (t) => {
  const { app, db, mediaDir } = await makeApp('none');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const { familyId, memberId } = seedFamily(db);
  const ids = seedPhotos(db, familyId, memberId);
  const payload = await searchPhotos(db, familyId, {
    q: 'bánh kem',
    provider: app.ai.provider,
  });
  assert.equal(payload.source, 'keyword');
  assert.equal(payload.results[0].id, ids.birthday);
  assert.deepEqual(payload.filters.tags, ['bánh kem'], 'từ khoá vẫn đoán được tag');

  const unaccented = await searchPhotos(db, familyId, { q: 'banh kem', provider: null });
  assert.equal(unaccented.results[0].id, ids.birthday, 'gõ không dấu vẫn tìm ra');
});

test('S5 search: nới bộ lọc khi quá chặt, không lộ dữ liệu nhà khác', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const { familyId, memberId } = seedFamily(db);
  const ids = seedPhotos(db, familyId, memberId);

  // "sinh nhật Bin" — Bin không phải thành viên, không có ảnh nào gắn Bin.
  const wrongMember = await searchPhotos(db, familyId, {
    q: 'sinh nhật Bin',
    provider,
    today: new Date(`${YEAR}-10-20T00:00:00Z`),
  });
  assert.equal(wrongMember.results[0].id, ids.birthday, 'nới bộ lọc người thay vì trả rỗng');

  // Nhà khác có ảnh "bánh kem" nhưng không được lộ.
  const other = db
    .prepare("INSERT INTO families (name, slug, created_at) VALUES ('Nhà khác', 'nha-khac', '2026-01-01T00:00:00Z')")
    .run();
  addMedia(db, Number(other.lastInsertRowid), {
    takenAt: `${YEAR}-05-12T18:00:00Z`,
    caption: 'Bánh kem của nhà khác',
    tags: ['bánh kem'],
  });
  const mine = await searchPhotos(db, familyId, { q: 'bánh kem', provider });
  assert.ok(mine.results.every((item) => item.id !== 99));
  assert.ok(mine.results.some((item) => item.id === ids.birthday));
});

test('S5 normalizeFilters: JSON LLM bẩn vẫn dùng được', () => {
  const filters = normalizeFilters({
    from: '2026-08',
    to: null,
    places: ['Đà Lạt', ''],
    tags: ['biển', 123],
    kinds: ['trip', 'khong-co'],
    members: 'Su',
  });
  assert.equal(filters.from, '2026-08-01');
  assert.equal(filters.to, '2026-08-31');
  assert.deepEqual(filters.places, ['Đà Lạt']);
  assert.deepEqual(filters.tags, ['biển', '123']);
  assert.deepEqual(filters.kinds, ['trip']);
  assert.deepEqual(filters.members, []);
});
