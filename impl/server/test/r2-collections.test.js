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
import {
  GROUP_GAP_MS,
  groupMedia,
  homePoint,
  isTetDate,
  joinTrips,
  kindHeuristic,
  regroupFamily,
  titleHeuristic,
} from '../src/collections.js';

const geo = createGeoIndex([], []);
const provider = createAiProvider({ aiProvider: 'mock' });

async function makeApp(aiProvider = 'mock') {
  const mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-coll-'));
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

const photo = (overrides) => ({
  type: 'photo',
  code: `code-${Math.random().toString(36).slice(2, 12)}`,
  ext: 'jpg',
  place: null,
  lat: null,
  lon: null,
  ai_caption: null,
  ai_score: null,
  blurry: 0,
  near_duplicate: 0,
  ...overrides,
});

function insertMedia(db, familyId, data) {
  const row = photo(data);
  const info = db
    .prepare(
      `INSERT INTO media (family_id, uploader_id, type, code, ext, taken_at, place, country, lat, lon,
         ai_status, ai_caption, ai_score, blurry, near_duplicate, created_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'done', ?, ?, ?, ?, ?)`,
    )
    .run(
      familyId,
      row.type,
      row.code,
      row.ext,
      row.takenAt,
      row.place,
      row.place ? 'Việt Nam' : null,
      row.lat,
      row.lon,
      row.ai_caption,
      row.ai_score,
      row.blurry,
      row.near_duplicate,
      row.takenAt,
    );
  return Number(info.lastInsertRowid);
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
  db.prepare(
    "INSERT INTO members (family_id, name, color, created_at) VALUES (?, 'Bin', '#E8734A', '2026-01-01T00:00:00Z')",
  ).run(familyId);
  return familyId;
}

/** Ảnh gia đình mẫu: Tết ở nhà, cuối tuần tháng 3 ở Hà Nội, một chuyến Đà Lạt 2 ngày. */
function seedPhotos(db, familyId) {
  const rows = [];
  const add = (data) => rows.push(insertMedia(db, familyId, data));
  add({ takenAt: '2026-02-17T10:00:00Z', place: 'Hà Nội', lat: 21.0285, lon: 105.8542 });
  add({ takenAt: '2026-02-17T11:30:00Z', place: 'Hà Nội', lat: 21.0285, lon: 105.8542 });
  for (let i = 0; i < 3; i += 1) {
    add({ takenAt: `2026-03-07T0${8 + i}:00:00Z`, place: 'Hà Nội', lat: 21.0285, lon: 105.8542 });
  }
  add({ takenAt: '2026-06-20T08:00:00Z', place: 'Đà Lạt', lat: 11.9404, lon: 108.4583, ai_score: 9 });
  add({ takenAt: '2026-06-20T20:00:00Z', place: 'Đà Lạt', lat: 11.9404, lon: 108.4583 });
  add({ takenAt: '2026-06-21T09:00:00Z', place: 'Đà Lạt', lat: 11.9404, lon: 108.4583 });
  add({ takenAt: '2026-06-21T15:00:00Z', place: 'Đà Lạt', lat: 11.9404, lon: 108.4583 });
  return rows;
}

function sessionHeader(db) {
  const session = createSession(db, 1, 30);
  return { cookie: `sid=${session.token}` };
}

test('S3 gom cụm: tách theo 6 giờ / 30 km, "nhà" là cụm đông nhất, gộp chuyến xa nhà', () => {
  const at = (iso, lat = 21.0285, lon = 105.8542) => ({ id: 1, taken_at: iso, lat, lon });
  assert.equal(groupMedia([at('2026-03-01T08:00:00Z'), at('2026-03-01T11:00:00Z')]).length, 1);
  assert.equal(groupMedia([at('2026-03-01T08:00:00Z'), at('2026-03-01T15:00:00Z')]).length, 2);
  assert.equal(
    groupMedia([at('2026-03-01T08:00:00Z'), at('2026-03-01T09:00:00Z', 21.0285, 105.8542 + 0.4)]).length,
    2,
    '0,4° kinh ≈ 41 km > 30 km',
  );
  assert.equal(GROUP_GAP_MS, 6 * 3600 * 1000);

  const home = homePoint([
    ...Array.from({ length: 5 }, () => ({ lat: 21.03, lon: 105.85 })),
    { lat: 11.94, lon: 108.45 },
  ]);
  assert.ok(Math.abs(home.lat - 21.03) < 0.01 && Math.abs(home.lon - 105.85) < 0.01);

  const hanoi = (iso) => ({ id: 1, taken_at: iso, lat: 21.0285, lon: 105.8542 });
  const far = (iso) => ({ id: 2, taken_at: iso, lat: 11.9404, lon: 108.4583, place: 'Đà Lạt' });
  const groups = groupMedia([
    far('2026-06-20T08:00:00Z'),
    far('2026-06-20T20:00:00Z'),
    far('2026-06-21T09:00:00Z'),
  ]);
  assert.equal(groups.length, 3, 'qua đêm > 6 giờ thì tách');
  const joined = joinTrips(groups, home);
  assert.equal(joined.length, 1, 'xa nhà, cùng nơi, cách ≤ 36 giờ → một chuyến');
  assert.equal(kindHeuristic(joined[0], home), 'trip');
  assert.equal(kindHeuristic([hanoi('2026-02-17T10:00:00Z')], home), 'tet');
  assert.equal(isTetDate('2026-02-17T10:00:00Z'), true);
  assert.equal(
    titleHeuristic([{ ...hanoi('2026-06-20T10:00:00Z'), place: 'Hà Nội' }], { home }),
    'Tháng 6 ở Hà Nội',
  );
  assert.equal(
    titleHeuristic([hanoi('2026-06-20T10:00:00Z')], { home }),
    'Tháng 6 ở nhà',
    'không có địa danh mà ở gần nhà → "nhà"',
  );
});

test('S3 gom mục: LLM (mock) đặt kind/title/summary, mục AI có status suggested', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  seedPhotos(db, familyId);

  const ids = await regroupFamily(db, familyId, { provider });
  assert.ok(ids.length >= 3, `phải có ít nhất 3 mục, nhận ${ids.length}`);

  const collections = db.prepare('SELECT * FROM collections WHERE family_id = ? ORDER BY start_at').all(familyId);
  assert.equal(collections.length, 3, 'Tết + cuối tuần tháng 3 + chuyến Đà Lạt');
  for (const collection of collections) {
    assert.equal(collection.status, 'suggested');
    assert.equal(collection.source, 'ai');
    assert.ok(collection.title.length > 3);
    assert.ok(!collection.title.includes('?'), `tên mục không được có "?": ${collection.title}`);
    assert.ok(collection.summary);
    assert.ok(collection.cover_media_id);
  }
  const trip = collections.find((row) => row.kind === 'trip');
  assert.ok(trip, 'có mục chuyến đi');
  assert.match(trip.title, /^Chuyến đi tháng 6 ở Đà Lạt/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media WHERE collection_id = ?').get(trip.id).n, 4);

  const tet = collections.find((row) => row.kind === 'tet');
  assert.ok(tet, 'ảnh 17/02/2026 phải thành mục Tết');

  // chạy lại: không nhân đôi mục
  await regroupFamily(db, familyId, { provider });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM collections WHERE family_id = ?').get(familyId).n, 3);
});

test('S3 API mục: danh sách, chi tiết, PATCH, merge, split, 404 khác nhà', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  const auth = sessionHeader(db);
  const other = client(app);
  const call = async (method, url, payload) => {
    const res = await app.inject({ method, url, payload, headers: auth });
    return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
  };

  seedPhotos(db, familyId);
  await regroupFamily(db, familyId, { provider });

  let res = await call('GET', '/api/collections?year=2026');
  assert.equal(res.status, 200);
  assert.equal(res.json.length, 3);
  const trip = res.json.find((row) => row.kind === 'trip');
  assert.deepEqual(Object.keys(trip).sort(), [
    'count',
    'cover',
    'endAt',
    'id',
    'kind',
    'members',
    'place',
    'startAt',
    'status',
    'summary',
    'title',
  ]);
  assert.equal(trip.count, 4);
  assert.equal(trip.cover.type, 'photo');

  res = await call('GET', '/api/collections?year=2026&kind=trip');
  assert.equal(res.json.length, 1);

  res = await call('GET', `/api/collections/${trip.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.days.length, 2);
  assert.equal(res.json.route.length, 4);
  assert.ok(Array.isArray(res.json.suggestions));

  const memberId = db.prepare('SELECT id FROM members WHERE family_id = ?').get(familyId).id;
  res = await call('PATCH', `/api/collections/${trip.id}`, {
    title: 'Hè ở Đà Lạt',
    status: 'accepted',
    memberIds: [memberId],
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.title, 'Hè ở Đà Lạt');
  assert.equal(res.json.status, 'accepted');
  assert.deepEqual(res.json.members.map((member) => member.name), ['Bin']);

  // mục đã nhận không bị gom lại xoá mất
  await regroupFamily(db, familyId, { provider });
  assert.equal(db.prepare('SELECT title FROM collections WHERE id = ?').get(trip.id).title, 'Hè ở Đà Lạt');

  // merge: gộp mục cuối tuần tháng 3 vào mục Tết
  const tet = db.prepare("SELECT * FROM collections WHERE family_id = ? AND kind = 'tet'").get(familyId);
  const weekend = db.prepare("SELECT * FROM collections WHERE family_id = ? AND kind = 'weekend'").get(familyId);
  assert.ok(tet && weekend);
  const weekendCount = db.prepare('SELECT COUNT(*) AS n FROM media WHERE collection_id = ?').get(weekend.id).n;
  res = await call('POST', `/api/collections/${weekend.id}/merge`, { intoId: tet.id });
  assert.equal(res.status, 200);
  assert.equal(res.json.id, tet.id);
  assert.equal(db.prepare('SELECT * FROM collections WHERE id = ?').get(weekend.id), undefined);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM media WHERE collection_id = ?').get(tet.id).n,
    2 + weekendCount,
  );

  // split: tách chuyến Đà Lạt từ ảnh thứ 3
  const tripMedia = db.prepare('SELECT id FROM media WHERE collection_id = ? ORDER BY taken_at, id').all(trip.id);
  res = await call('POST', `/api/collections/${trip.id}/split`, { mediaId: tripMedia[2].id });
  assert.equal(res.status, 201);
  assert.ok(res.json.id !== trip.id);
  assert.equal(res.json.count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media WHERE collection_id = ?').get(trip.id).n, 2);

  // nhà khác không thấy
  await other('POST', '/api/auth/register', {
    payload: { username: 'khach', email: 'khach@example.com', password: 'kyniem123' },
  });
  let r = await other('GET', `/api/collections/${trip.id}`);
  assert.equal(r.status, 404);
  r = await other('PATCH', `/api/collections/${trip.id}`, { payload: { title: 'Đổi trộm' } });
  assert.equal(r.status, 404);
  r = await other('GET', '/api/collections?year=2026');
  assert.deepEqual(r.json, []);
});

test('S3 gợi ý: ảnh mờ → gợi ý ẩn (nhận thì ẩn ảnh), bỏ qua gợi ý', async (t) => {
  const { app, db, mediaDir } = await makeApp('none');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  const ids = seedPhotos(db, familyId);
  db.prepare('UPDATE media SET blurry = 1 WHERE id = ?').run(ids[0]);
  db.prepare('UPDATE media SET near_duplicate = 1 WHERE id = ?').run(ids[1]);

  const auth = sessionHeader(db);
  const call = async (method, url) => {
    const res = await app.inject({ method, url, headers: auth });
    return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
  };

  await regroupFamily(db, familyId, { provider: createAiProvider({ aiProvider: 'none' }) });

  const suggestions = db.prepare("SELECT * FROM suggestions WHERE family_id = ? AND status = 'open'").all(familyId);
  const blurrySuggestion = suggestions.find((row) => row.type === 'hide_blurry' && row.media_id === ids[0]);
  assert.ok(blurrySuggestion, 'có gợi ý ẩn ảnh mờ');

  let res = await call('POST', `/api/suggestions/${blurrySuggestion.id}/accept`);
  assert.equal(res.status, 200);
  assert.equal(res.json.suggestion.status, 'accepted');
  assert.equal(db.prepare('SELECT hidden FROM media WHERE id = ?').get(ids[0]).hidden, 1);

  const dupSuggestion = suggestions.find((row) => row.type === 'hide_blurry' && row.media_id === ids[1]);
  assert.ok(dupSuggestion);
  res = await call('POST', `/api/suggestions/${dupSuggestion.id}/dismiss`);
  assert.equal(res.json.suggestion.status, 'dismissed');
  assert.equal(db.prepare('SELECT hidden FROM media WHERE id = ?').get(ids[1]).hidden, 0);

  res = await call('POST', '/api/suggestions/999999/accept');
  assert.equal(res.status, 404);
});
