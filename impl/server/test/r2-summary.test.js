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
import { regroupFamily } from '../src/collections.js';
import { TIMELINE_PAGE_DAYS, greeting, mapPoints } from '../src/summary.js';

const geo = createGeoIndex([], []);
const YEAR = new Date().getUTCFullYear();
const MONTH_DAY = new Date().toISOString().slice(5, 10);

async function makeApp(aiProvider = 'mock') {
  const mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-sum-'));
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

function client(app, db = null) {
  let cookie = db ? cookieFor(db) : '';
  return async function call(method, url, { payload } = {}) {
    const res = await app.inject({ method, url, payload, headers: { cookie } });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) cookie = String(setCookie).split(';')[0];
    let json = null;
    try {
      json = JSON.parse(res.body);
    } catch {
      /* không phải JSON */
    }
    return { status: res.statusCode, json, text: res.body };
  };
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

function addMedia(db, familyId, overrides = {}) {
  const row = {
    type: 'photo',
    code: `code-${Math.random().toString(36).slice(2, 12)}`,
    ext: 'jpg',
    place: null,
    lat: null,
    lon: null,
    ai_caption: null,
    ai_score: null,
    collectionId: null,
    ...overrides,
  };
  const info = db
    .prepare(
      `INSERT INTO media (family_id, uploader_id, collection_id, type, code, ext, taken_at, place, country,
         lat, lon, ai_status, ai_caption, ai_score, created_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'done', ?, ?, ?)`,
    )
    .run(
      familyId,
      row.collectionId,
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
      row.takenAt,
    );
  return Number(info.lastInsertRowid);
}

/** Tết + cuối tuần Hà Nội + chuyến Đà Lạt (xa nhà, 2 ngày) + 1 video. */
function seedYear(db, familyId) {
  addMedia(db, familyId, { takenAt: `${YEAR}-02-17T10:00:00Z`, place: 'Hà Nội', lat: 21.0285, lon: 105.8542 });
  addMedia(db, familyId, { takenAt: `${YEAR}-02-17T11:30:00Z`, place: 'Hà Nội', lat: 21.0285, lon: 105.8542 });
  for (let i = 0; i < 3; i += 1) {
    addMedia(db, familyId, {
      takenAt: `${YEAR}-03-07T0${8 + i}:00:00Z`,
      place: 'Hà Nội',
      lat: 21.0285,
      lon: 105.8542,
    });
  }
  addMedia(db, familyId, {
    takenAt: `${YEAR}-06-20T08:00:00Z`,
    place: 'Đà Lạt',
    lat: 11.9404,
    lon: 108.4583,
    ai_score: 9,
  });
  addMedia(db, familyId, {
    takenAt: `${YEAR}-06-20T20:00:00Z`,
    place: 'Đà Lạt',
    lat: 11.9404,
    lon: 108.4583,
    ai_score: 6,
  });
  addMedia(db, familyId, {
    takenAt: `${YEAR}-06-21T09:00:00Z`,
    place: 'Đà Lạt',
    lat: 11.9404,
    lon: 108.4583,
    ai_score: 7,
  });
  addMedia(db, familyId, {
    type: 'video',
    takenAt: `${YEAR}-06-21T15:00:00Z`,
    place: 'Đà Lạt',
    lat: 11.9404,
    lon: 108.4583,
  });
}

const cookieFor = (db) => `sid=${createSession(db, 1, 30).token}`;

test('S4 home: lời chào, số liệu năm nay, ảnh mới, mục, kỷ niệm, điểm bản đồ', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  seedYear(db, familyId);
  // Ảnh của năm trước, đúng ngày hôm nay → kỷ niệm.
  addMedia(db, familyId, {
    takenAt: `${YEAR - 1}-${MONTH_DAY}T09:00:00Z`,
    place: 'Hà Nội',
    lat: 21.0285,
    lon: 105.8542,
  });
  // Ảnh của năm trước ở Nha Trang → không tính vào số liệu năm nay.
  addMedia(db, familyId, { takenAt: `${YEAR - 1}-08-03T09:00:00Z`, place: 'Nha Trang', lat: 12.2388, lon: 109.1967 });
  await regroupFamily(db, familyId, { provider: createAiProvider({ aiProvider: 'mock' }) });

  assert.match(greeting(), /^Chào (buổi sáng|buổi chiều|buổi tối|ban đêm)$/);

  const call = client(app, db);
  const res = await call('GET', '/api/home');
  assert.equal(res.status, 200);
  const home = res.json;
  assert.match(home.greeting, /^Chào /);
  assert.deepEqual(Object.keys(home.stats).sort(), ['collections', 'photos', 'places', 'videos']);
  assert.equal(home.stats.photos, 8, '8 ảnh năm nay, không tính 2 ảnh năm trước');
  assert.equal(home.stats.videos, 1);
  assert.equal(home.stats.places, 2, 'Hà Nội + Đà Lạt');
  assert.ok(home.stats.collections >= 3);
  assert.equal(home.collections.length, home.stats.collections);
  assert.equal(home.recent.length, 11, 'tổng 11 ảnh, ≤ 12');
  assert.match(home.recent[0].takenAt, new RegExp(`^${YEAR}-`), 'ảnh mới nhất của năm nay đứng đầu');
  assert.ok(home.recent.every((item) => item.url?.sm && item.url?.lg));
  assert.equal(home.onThisDay.yearsAgo, 1);
  assert.equal(home.onThisDay.date, `${YEAR - 1}-${MONTH_DAY}`);
  assert.equal(home.onThisDay.media.id > 0, true, 'media là MỘT object Media theo hợp đồng');
  assert.ok(home.mapPreview.points.length >= 2);
  const hanoiPoints = home.mapPreview.points.filter((point) => point.place === 'Hà Nội');
  assert.equal(
    hanoiPoints.reduce((sum, point) => sum + point.count, 0),
    6,
    '2 Tết + 3 cuối tuần + 1 kỷ niệm năm trước',
  );
  assert.ok(hanoiPoints[0].cover?.url?.sm);
  // Hợp đồng r2: cover là MỘT Media đầy đủ (S8), không phải {sm,lg}.
  assert.equal(typeof hanoiPoints[0].cover.id, 'number');
  assert.ok(hanoiPoints[0].cover.url.lg);
  assert.ok(hanoiPoints[0].cover.url.orig.includes('/orig.'));
  assert.equal(hanoiPoints[0].cover.sm, undefined, 'không còn dạng {sm,lg}');
  assert.equal(typeof hanoiPoints[0].cover.flags, 'object');
  assert.equal(typeof hanoiPoints[0].cover.aiStatus, 'string');
  assert.equal(hanoiPoints[0].lat.toFixed(2), '21.03');

  const anonymous = await app.inject({ method: 'GET', url: '/api/home' });
  assert.equal(anonymous.statusCode, 401);
});

test('S4 recap: số liệu, chương theo tháng, nơi nhiều ảnh, intro LLM có cache', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  seedYear(db, familyId);
  await regroupFamily(db, familyId, { provider: createAiProvider({ aiProvider: 'mock' }) });

  let calls = 0;
  const base = createAiProvider({ aiProvider: 'mock' });
  const provider = {
    ...base,
    recapIntro: async (input) => {
      calls += 1;
      return `Năm ${input.year} nhà mình đi ${input.stats.trips} chuyến và có ${input.stats.photos} tấm ảnh.`;
    },
  };
  // Dùng provider đếm được thay cho mock của app.
  app.ai.provider = provider;

  const call = client(app, db);
  const first = await call('GET', `/api/recap/${YEAR}`);
  assert.equal(first.status, 200);
  const recap = first.json;
  assert.equal(recap.year, YEAR);
  assert.match(recap.intro, new RegExp(String(YEAR)));
  assert.equal(recap.introSource, 'ai');
  assert.equal(recap.stats.photos, 8);
  assert.equal(recap.stats.videos, 1);
  assert.equal(recap.stats.places, 2);
  assert.equal(recap.stats.trips, 1, 'chuyến Đà Lạt xa nhà nhiều ngày');
  assert.equal(recap.stats.birthdays, 0);
  assert.deepEqual(
    recap.chapters.map((chapter) => chapter.month),
    [2, 3, 6],
  );
  for (const chapter of recap.chapters) {
    assert.ok(chapter.highlights.length <= 4);
    assert.ok(chapter.collection?.title);
    // Hợp đồng r2 (S8): chương luôn có mục, không bao giờ null.
    assert.notEqual(chapter.collection, null);
    assert.equal(typeof chapter.collection.id, 'number');
  }
  const june = recap.chapters.find((chapter) => chapter.month === 6);
  assert.equal(june.highlights[0].score, 9, 'ảnh điểm cao nhất đứng đầu');
  assert.equal(recap.topPlaces[0].place, 'Hà Nội');
  assert.equal(recap.topPlaces[0].count, 5);
  assert.equal(recap.topPlaces[1].place, 'Đà Lạt');
  assert.equal(recap.topPlaces[1].count, 4);

  const second = await call('GET', `/api/recap/${YEAR}`);
  assert.equal(second.json.intro, recap.intro);
  assert.equal(calls, 1, 'lần xem thứ hai không gọi lại LLM');
  const cachedRow = db.prepare('SELECT * FROM recaps WHERE family_id = ? AND year = ?').get(familyId, YEAR);
  assert.equal(cachedRow.source, 'ai');
  assert.equal(cachedRow.intro, recap.intro);

  const bad = await call('GET', '/api/recap/999');
  assert.equal(bad.status, 400);
});

test('S8 recap: tháng không có mục thì không trả chương (collection khác null)', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  seedYear(db, familyId);
  await regroupFamily(db, familyId, { provider: createAiProvider({ aiProvider: 'mock' }) });
  // Ảnh tháng 9 thêm SAU khi gom mục → tháng 9 có ảnh nhưng không có mục nào.
  addMedia(db, familyId, {
    takenAt: `${YEAR}-09-09T09:00:00Z`,
    place: 'Huế',
    lat: 16.4637,
    lon: 107.5909,
    ai_score: 8,
  });
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM collections WHERE family_id = ? AND start_at LIKE ?").get(familyId, `${YEAR}-09%`).n,
    0,
    'tháng 9 không có mục',
  );

  const call = client(app, db);
  const res = await call('GET', `/api/recap/${YEAR}`);
  assert.equal(res.status, 200);
  const months = res.json.chapters.map((chapter) => chapter.month);
  assert.deepEqual(months, [2, 3, 6], 'bỏ chương tháng 9 (không có mục)');
  assert.ok(!months.includes(9));
  for (const chapter of res.json.chapters) {
    assert.ok(chapter.collection, `chương tháng ${chapter.month} phải có mục`);
    assert.equal(typeof chapter.collection.id, 'number');
    assert.ok(Array.isArray(chapter.highlights));
  }
  // Ảnh tháng 9 vẫn được tính vào số liệu năm, chỉ không thành chương.
  assert.equal(res.json.stats.photos, 9);
  assert.equal(res.json.stats.places, 3);
});

test('S4 recap: AI_PROVIDER=none → câu mẫu từ số liệu, không ghi cache', async (t) => {
  const { app, db, mediaDir } = await makeApp('none');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  seedYear(db, familyId);

  const call = client(app, db);
  const res = await call('GET', `/api/recap/${YEAR}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.introSource, 'sample');
  assert.match(res.json.intro, /8 tấm ảnh/);
  assert.match(res.json.intro, /2 nơi/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM recaps').get().n, 0);
});

test('S4 timeline: ngày mới nhất trước, gom theo tháng, phân trang bằng cursor', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  const dayCount = TIMELINE_PAGE_DAYS + 3;
  for (let i = 0; i < dayCount; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    const takenAt = `${YEAR}-01-${day}T10:00:00Z`;
    addMedia(db, familyId, { takenAt, place: 'Hà Nội', lat: 21.0285, lon: 105.8542 });
  }
  const collection = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, start_at, end_at, status, source, created_at, updated_at)
       VALUES (?, 'everyday', 'Tháng 1 ở Hà Nội', ?, ?, 'accepted', 'user', ?, ?)`,
    )
    .run(familyId, `${YEAR}-01-01`, `${YEAR}-01-31`, `${YEAR}-01-01T00:00:00Z`, `${YEAR}-01-01T00:00:00Z`);
  const collectionId = Number(collection.lastInsertRowid);
  db.prepare('UPDATE media SET collection_id = ? WHERE family_id = ? AND taken_at >= ?').run(
    collectionId,
    familyId,
    `${YEAR}-01-01T05:00:00Z`,
  );

  const call = client(app, db);
  const first = await call('GET', `/api/timeline?year=${YEAR}`);
  assert.equal(first.status, 200);
  assert.equal(first.json.months.length, 1);
  assert.equal(first.json.months[0].month, 1);
  assert.equal(first.json.months[0].days.length, TIMELINE_PAGE_DAYS);
  assert.equal(first.json.months[0].days[0].date, `${YEAR}-01-${String(dayCount).padStart(2, '0')}`, 'mới nhất trước');
  assert.equal(first.json.months[0].days[0].collectionId, collectionId);
  assert.equal(first.json.nextCursor, String(TIMELINE_PAGE_DAYS));

  const second = await call('GET', `/api/timeline?year=${YEAR}&cursor=${first.json.nextCursor}`);
  assert.equal(second.json.months[0].days.length, 3);
  assert.equal(second.json.months[0].days.at(-1).date, `${YEAR}-01-01`);
  assert.equal(second.json.nextCursor, null);

  const bad = await call('GET', '/api/timeline?cursor=-1');
  assert.equal(bad.status, 400);
});

test('S4 map: lọc theo năm và theo mục, 404 mục của nhà khác', async (t) => {
  const { app, db, mediaDir } = await makeApp('mock');
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const familyId = seedFamily(db);
  seedYear(db, familyId);
  addMedia(db, familyId, { takenAt: `${YEAR - 1}-08-03T09:00:00Z`, place: 'Nha Trang', lat: 12.2388, lon: 109.1967 });
  await regroupFamily(db, familyId, { provider: createAiProvider({ aiProvider: 'mock' }) });

  const trip = db
    .prepare("SELECT * FROM collections WHERE family_id = ? AND kind = 'trip'")
    .get(familyId);
  assert.ok(trip, 'phải có mục chuyến đi');

  const call = client(app, db);
  const byYear = await call('GET', `/api/map?year=${YEAR}`);
  assert.equal(byYear.status, 200);
  const places = byYear.json.points.map((point) => point.place);
  assert.ok(places.includes('Hà Nội'));
  assert.ok(places.includes('Đà Lạt'));
  assert.ok(!places.includes('Nha Trang'), 'ảnh năm trước không lọt vào bản đồ năm nay');

  const byCollection = await call('GET', `/api/map?collectionId=${trip.id}`);
  assert.equal(byCollection.status, 200);
  assert.equal(byCollection.json.points.length, 1);
  const point = byCollection.json.points[0];
  assert.equal(point.collectionId, trip.id);
  assert.equal(point.id, trip.id);
  assert.equal(point.count, 4);
  assert.equal(point.place, 'Đà Lạt');
  assert.ok(point.cover?.url?.sm, 'cover là Media đầy đủ, không phải {sm,lg}');
  assert.equal(typeof point.cover.id, 'number');
  const coverRow = db.prepare('SELECT code FROM media WHERE id = ?').get(point.cover.id);
  assert.equal(point.cover.url.sm, `/media/${coverRow.code}/sm.jpg`);
  assert.equal(point.cover.sm, undefined, 'không còn dạng {sm,lg}');
  assert.equal(point.cover.collectionId, trip.id);

  const otherFamily = db
    .prepare("INSERT INTO families (name, slug, created_at) VALUES ('Nhà khác', 'nha-khac', '2026-01-01T00:00:00Z')")
    .run();
  const stranger = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, start_at, end_at, status, source, created_at, updated_at)
       VALUES (?, 'trip', 'Chuyến lạ', ?, ?, 'suggested', 'ai', ?, ?)`,
    )
    .run(Number(otherFamily.lastInsertRowid), `${YEAR}-05-01`, `${YEAR}-05-02`, `${YEAR}-05-01T00:00:00Z`, `${YEAR}-05-01T00:00:00Z`);
  const denied = await call('GET', `/api/map?collectionId=${Number(stranger.lastInsertRowid)}`);
  assert.equal(denied.status, 404);
});

test('S4 mapPoints: gom điểm theo ô ~2 km, ảnh điểm cao làm bìa (Media đầy đủ)', () => {
  const points = mapPoints([
    { id: 1, code: 'a1', ext: 'jpg', lat: 21.0285, lon: 105.8542, place: 'Hà Nội', collection_id: 7, ai_score: 4 },
    { id: 2, code: 'a2', ext: 'jpg', lat: 21.0288, lon: 105.8545, place: 'Hà Nội', collection_id: 7, ai_score: 8 },
    { id: 3, code: 'a3', ext: 'jpg', lat: 21.0291, lon: 105.855, place: 'Hà Nội', collection_id: 7, ai_score: 5 },
    { id: 4, lat: null, lon: null, place: 'Không toạ độ', collection_id: null },
  ]);
  assert.equal(points.length, 1);
  assert.equal(points[0].count, 3);
  assert.equal(points[0].collectionId, 7);
  assert.equal(points[0].id, 7);
  assert.equal(points[0].cover.id, 2, 'ảnh điểm cao nhất làm bìa');
  assert.equal(points[0].cover.url.sm, '/media/a2/sm.jpg');
  assert.equal(points[0].cover.sm, undefined, 'cover không phải {sm,lg}');
  assert.equal(points[0].cover.aiStatus, 'pending');
  assert.equal(typeof points[0].cover.flags, 'object');
});
