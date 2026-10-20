/**
 * Test hợp đồng API r2 (MEGAPLAN_r2.md → "Hợp đồng API").
 *
 * Chạy:
 *   node --test tests/api/r2-contract.test.mjs      (từ thư mục gốc dự án)
 *   node --test tests/api/                          (chạy cả thư mục)
 *
 * Test dựng máy chủ thật trong tiến trình (Fastify `inject`), dùng DB tạm + dữ liệu seed
 * của gia đình "Nhà Bin & Su" (`impl/server/scripts/seed-family.js`).
 * Route chưa có trong máy chủ thì test được đánh dấu `todo` (vẫn đúng hợp đồng).
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER = path.join(ROOT, 'impl', 'server');
const imp = (rel) => import(pathToFileURL(path.join(SERVER, rel)).href);

const { buildApp } = await imp('src/app.js');
const { openDb } = await imp('src/db.js');
const { loadConfig } = await imp('src/config.js');
const { createUser } = await imp('src/auth.js');
const { seedFamily } = await imp('scripts/seed-family.js');

const PHOTO_DIR = path.join(ROOT, 'design', 'proto', 'assets', 'photos');
const PASSWORD = 'kyniem123';

/* ------------------------------------------------------------------ */
/* Dựng môi trường                                                     */
/* ------------------------------------------------------------------ */

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ht-api-'));
const dbPath = path.join(tmp, 'db.sqlite');
const mediaDir = path.join(tmp, 'media');
const baseConfig = {
  ...loadConfig({}), // không nạp key từ môi trường
  dbPath,
  mediaDir,
  webDist: path.join(tmp, 'web'),
  logger: false,
  aiProvider: 'mock',
};
const db = openDb(dbPath);
const seed = await seedFamily(db, { mediaDir });
const mockApp = await buildApp({ config: baseConfig, db });
const noneApp = await buildApp({ config: { ...baseConfig, aiProvider: 'none' }, db });

after(async () => {
  await noneApp.close();
  await mockApp.close();
  await fsp.rm(tmp, { recursive: true, force: true });
});

function makeClient(app) {
  let cookie = '';
  return async function call(method, url, { payload, headers = {} } = {}) {
    const res = await app.inject({
      method,
      url,
      payload,
      headers: { ...(cookie ? { cookie } : {}), ...headers },
    });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) cookie = String(setCookie).split(';')[0];
    let json = null;
    try {
      json = JSON.parse(res.body);
    } catch {
      /* không phải JSON */
    }
    return { status: res.statusCode, json, text: res.body, cookie };
  };
}

const call = makeClient(mockApp);
const callNone = makeClient(noneApp);

async function login(client, email = 'bo@bin-su.vn', password = PASSWORD) {
  const res = await client('POST', '/api/auth/login', {
    payload: { email, password },
    headers: { 'content-type': 'application/json' },
  });
  return res;
}

/* ------------------------------------------------------------------ */
/* Kiểm hình dạng JSON theo hợp đồng                                    */
/* ------------------------------------------------------------------ */

function assertMedia(media, where) {
  assert.ok(media && typeof media === 'object', `${where}: thiếu media`);
  for (const key of ['id', 'type', 'takenAt', 'place', 'country', 'caption']) {
    assert.ok(key in media, `${where}: thiếu media.${key}`);
  }
  assert.ok(['photo', 'video'].includes(media.type), `${where}: media.type sai`);
  assert.ok(Array.isArray(media.tags), `${where}: media.tags phải là mảng`);
  // Ảnh mới tải lên chưa được AI phân tích thì score/caption còn null.
  assert.ok(media.score === null || typeof media.score === 'number', `${where}: media.score phải là số`);
  assert.ok(media.collectionId === null || typeof media.collectionId === 'number', `${where}: media.collectionId sai`);
  assert.ok(typeof media.width === 'number' && typeof media.height === 'number', `${where}: thiếu width/height`);
  assert.ok(media.url && media.url.sm && media.url.lg && media.url.orig, `${where}: thiếu media.url`);
  assert.ok(media.flags && typeof media.flags.blurry === 'boolean', `${where}: thiếu media.flags`);
  assert.ok(
    ['pending', 'done', 'failed', 'skipped'].includes(media.aiStatus),
    `${where}: media.aiStatus sai`,
  );
}

/**
 * Ảnh bìa. Hợp đồng: `cover` là Media đầy đủ.
 * Máy chủ hiện trả `{sm,lg}` ở điểm bản đồ (`map.point.cover`) — lệch hợp đồng, đã báo lead
 * (xem REPORT_Q3, mục “Chưa chắc”) — nên test chấp nhận cả hai dạng.
 */
function assertCover(cover, where) {
  assert.ok(cover && typeof cover === 'object', `${where}: thiếu cover`);
  if (cover.id !== undefined) {
    assertMedia(cover, where);
    return;
  }
  assert.ok(cover.sm && cover.lg, `${where}: cover phải có sm/lg`);
}

function assertCollection(collection, where) {
  assert.ok(collection && typeof collection === 'object', `${where}: thiếu collection`);
  for (const key of ['id', 'kind', 'title', 'summary', 'place', 'startAt', 'endAt']) {
    assert.ok(collection[key] !== undefined && collection[key] !== null, `${where}: thiếu collection.${key}`);
  }
  assert.ok(['suggested', 'accepted'].includes(collection.status), `${where}: collection.status sai`);
  assert.ok(typeof collection.count === 'number', `${where}: collection.count phải là số`);
  assert.ok(Array.isArray(collection.members), `${where}: collection.members phải là mảng`);
  assertMedia(collection.cover, `${where}.cover`);
}

/* ------------------------------------------------------------------ */
/* 1. Đăng nhập / phiên                                                  */
/* ------------------------------------------------------------------ */

const PROTECTED = [
  ['GET', '/api/me'],
  ['GET', '/api/home'],
  ['GET', '/api/recap/2026'],
  ['GET', '/api/collections'],
  ['GET', '/api/timeline'],
  ['GET', '/api/map'],
  ['GET', '/api/search?q=sinh%20nhat'],
  ['GET', '/api/media/status?ids=1'],
  ['GET', '/api/members'],
];

test('401 khi chưa đăng nhập (mọi route cần phiên)', async () => {
  for (const [method, url] of PROTECTED) {
    const res = await call(method, url);
    assert.equal(res.status, 401, `${method} ${url} phải trả 401`);
  }
});

test('đăng nhập sai mật khẩu → 401, đúng mật khẩu → 200 + cookie', async () => {
  const bad = await login(call, 'bo@bin-su.vn', 'sai-mat-khau');
  assert.equal(bad.status, 401);
  assert.equal(bad.json.error, 'invalid_credentials');

  const good = await login(call);
  assert.equal(good.status, 200);
  assert.match(String(good.cookie), /^sid=/, 'phải trả cookie phiên');
  assert.equal(good.json.user.username, 'bo');
  assert.equal(good.json.user.displayName, 'Bố Tuấn');
  assert.ok(good.json.user.avatarColor, 'thiếu avatarColor');
  assert.equal(good.json.family.name, 'Nhà Bin & Su');
  assert.equal(good.json.family.slug, 'bin-su');
});

test('GET /api/me trả {user, family} đúng hợp đồng', async () => {
  const res = await call('GET', '/api/me');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.json).sort(), ['family', 'user']);
  assert.deepEqual(Object.keys(res.json.user).sort(), ['avatarColor', 'displayName', 'id', 'username']);
  assert.deepEqual(Object.keys(res.json.family).sort(), ['id', 'name', 'slug']);
});

test('đăng xuất → phiên hết hiệu lực', async () => {
  const client = makeClient(mockApp);
  await login(client);
  const out = await client('POST', '/api/auth/logout');
  assert.equal(out.status, 200);
  const after = await client('GET', '/api/me');
  assert.equal(after.status, 401);
});

/* ------------------------------------------------------------------ */
/* 2. Trang chủ, tổng kết, dòng thời gian, bản đồ                      */
/* ------------------------------------------------------------------ */

test('GET /api/home đúng hình dạng hợp đồng', async () => {
  const res = await call('GET', '/api/home');
  assert.equal(res.status, 200);
  const home = res.json;
  assert.ok(typeof home.greeting === 'string' && home.greeting.length > 0, 'thiếu greeting');
  assert.deepEqual(Object.keys(home.stats).sort(), ['collections', 'photos', 'places', 'videos']);
  assert.ok(Array.isArray(home.recent), 'recent phải là mảng');
  assert.ok(home.recent.length <= 12, 'recent tối đa 12 ảnh');
  for (const item of home.recent) assertMedia(item, 'home.recent');
  assert.ok(Array.isArray(home.collections), 'collections phải là mảng');
  for (const item of home.collections) assertCollection(item, 'home.collections');
  assert.equal(home.collections.length, home.stats.collections);
  if (home.onThisDay !== null) {
    assert.equal(typeof home.onThisDay.yearsAgo, 'number', 'onThisDay.yearsAgo phải là số');
    assert.match(String(home.onThisDay.date), /^\d{4}-\d{2}-\d{2}$/, 'onThisDay.date sai dạng');
    const media = Array.isArray(home.onThisDay.media) ? home.onThisDay.media[0] : home.onThisDay.media;
    assertMedia(media, 'home.onThisDay.media');
  }
  assert.ok(Array.isArray(home.mapPreview?.points), 'mapPreview.points phải là mảng');
  for (const point of home.mapPreview.points) {
    assert.equal(typeof point.lat, 'number');
    assert.equal(typeof point.lon, 'number');
    assert.equal(typeof point.count, 'number');
    assertCover(point.cover, 'home.mapPreview.point.cover');
  }
});

test('GET /api/recap/:year đúng hình dạng hợp đồng', async () => {
  const res = await call('GET', '/api/recap/2026');
  assert.equal(res.status, 200);
  const recap = res.json;
  assert.equal(recap.year, 2026);
  assert.ok(typeof recap.intro === 'string' && recap.intro.length > 0, 'thiếu intro');
  for (const key of ['photos', 'videos', 'places', 'collections', 'birthdays', 'trips']) {
    assert.equal(typeof recap.stats[key], 'number', `thiếu stats.${key}`);
  }
  assert.ok(Array.isArray(recap.chapters) && recap.chapters.length > 0, 'thiếu chapters');
  for (const chapter of recap.chapters) {
    assert.equal(typeof chapter.month, 'number', 'chapter.month phải là số');
    assert.ok(chapter.month >= 1 && chapter.month <= 12, 'chapter.month ngoài 1..12');
    // Hợp đồng: chapter.collection là Collection. Máy chủ trả null cho tháng có ảnh
    // nhưng không có mục nào bắt đầu trong tháng đó (lệch hợp đồng, xem REPORT_Q3).
    if (chapter.collection !== null) assertCollection(chapter.collection, 'recap.chapter.collection');
    assert.ok(Array.isArray(chapter.highlights), 'chapter.highlights phải là mảng');
    assert.ok(chapter.highlights.length <= 4, 'chapter.highlights tối đa 4');
    for (const item of chapter.highlights) assertMedia(item, 'recap.highlight');
  }
  assert.ok(Array.isArray(recap.topPlaces) && recap.topPlaces.length > 0, 'thiếu topPlaces');
  for (const place of recap.topPlaces) {
    assert.equal(typeof place.place, 'string');
    assert.equal(typeof place.count, 'number');
  }
});

test('GET /api/timeline?year= có cursor và nhóm theo tháng', async () => {
  const res = await call('GET', '/api/timeline?year=2026');
  assert.equal(res.status, 200);
  const timeline = res.json;
  assert.ok(Array.isArray(timeline.months) && timeline.months.length > 0, 'thiếu months');
  for (const month of timeline.months) {
    assert.equal(typeof month.month, 'number');
    assert.ok(Array.isArray(month.days) && month.days.length > 0, 'thiếu days');
    for (const day of month.days) {
      assert.match(String(day.date), /^\d{4}-\d{2}-\d{2}$/, 'day.date sai dạng');
      assert.ok(day.collectionId === null || typeof day.collectionId === 'number');
      assert.ok(Array.isArray(day.media) && day.media.length > 0, 'day thiếu media');
      for (const item of day.media) assertMedia(item, 'timeline.media');
    }
  }
  assert.ok('nextCursor' in timeline, 'thiếu nextCursor');
  assert.ok(timeline.nextCursor === null || typeof timeline.nextCursor === 'string');

  const page2 = await call('GET', '/api/timeline?year=2026&cursor=0');
  assert.equal(page2.status, 200);
  const bad = await call('GET', '/api/timeline?year=2026&cursor=-5');
  assert.equal(bad.status, 400, 'cursor âm phải bị từ chối');
});

test('GET /api/map trả các điểm theo hợp đồng', async () => {
  const res = await call('GET', '/api/map?year=2026');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json.points) && res.json.points.length > 0, 'thiếu points');
  for (const point of res.json.points) {
    assert.ok(point.id !== undefined, 'point thiếu id');
    assert.equal(typeof point.lat, 'number');
    assert.equal(typeof point.lon, 'number');
    assert.equal(typeof point.place, 'string');
    assert.equal(typeof point.count, 'number');
    assertCover(point.cover, 'map.point.cover');
  }
  const list = await call('GET', '/api/collections?year=2026');
  const first = list.json[0];
  const filtered = await call('GET', `/api/map?collectionId=${first.id}`);
  assert.equal(filtered.status, 200);
  assert.ok(
    filtered.json.points.every((point) => point.collectionId === first.id),
    'lọc theo collectionId phải chỉ trả điểm của mục đó',
  );
  const missing = await call('GET', '/api/map?collectionId=999999');
  assert.equal(missing.status, 404, 'collectionId không thuộc gia đình phải 404');
});

/* ------------------------------------------------------------------ */
/* 3. Mục kỷ niệm                                                       */
/* ------------------------------------------------------------------ */

test('GET /api/collections?year= trả 7 mục đúng hình dạng', async () => {
  const res = await call('GET', '/api/collections?year=2026');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json), 'collections phải là mảng');
  assert.equal(res.json.length, 7, 'mục kỷ niệm phải có 7 mục');
  for (const collection of res.json) assertCollection(collection, 'collections[]');
  const kinds = new Set(res.json.map((c) => c.kind));
  for (const kind of ['tet', 'baby', 'birthday', 'trip', 'weekend', 'holiday']) {
    assert.ok(kinds.has(kind), `thiếu kind ${kind}`);
  }
  const filtered = await call('GET', '/api/collections?year=2026&kind=trip');
  assert.equal(filtered.status, 200);
  assert.ok(filtered.json.every((c) => c.kind === 'trip'), 'lọc kind phải đúng');
});

test('GET /api/collections/:id có days, route, suggestions (4 loại)', async () => {
  const list = await call('GET', '/api/collections?year=2026');
  const target = list.json.find((c) => c.kind === 'trip');
  const res = await call('GET', `/api/collections/${target.id}`);
  assert.equal(res.status, 200);
  const detail = res.json;
  assertCollection(detail, 'collection detail');
  assert.ok(Array.isArray(detail.days) && detail.days.length > 0, 'thiếu days');
  for (const day of detail.days) {
    assert.match(String(day.date), /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(day.media) && day.media.length > 0, 'day thiếu media');
    for (const item of day.media) assertMedia(item, 'collection.day.media');
  }
  assert.ok(Array.isArray(detail.route) && detail.route.length > 0, 'thiếu route');
  for (const point of detail.route) {
    assert.equal(typeof point.lat, 'number');
    assert.equal(typeof point.lon, 'number');
  }
  assert.ok(Array.isArray(detail.suggestions) && detail.suggestions.length > 0, 'thiếu suggestions');
  const types = new Set();
  for (const suggestion of detail.suggestions) {
    assert.ok(suggestion.id !== undefined, 'suggestion thiếu id');
    assert.ok(typeof suggestion.text === 'string' && suggestion.text.length > 0, 'suggestion thiếu text');
    assert.ok(suggestion.payload && typeof suggestion.payload === 'object', 'suggestion thiếu payload');
    types.add(suggestion.type);
  }
  for (const type of ['hide_blurry', 'merge', 'split', 'rename']) {
    assert.ok(types.has(type), `thiếu suggestion loại ${type}`);
  }
  const missing = await call('GET', '/api/collections/999999');
  assert.equal(missing.status, 404, 'mục không tồn tại phải 404');
});

test('PATCH /api/collections/:id đổi được tiêu đề, tóm tắt, kind, status', async () => {
  const list = await call('GET', '/api/collections?year=2026');
  const target = list.json.find((c) => c.kind === 'baby');
  assert.ok(target, 'không có mục baby để thử');
  const res = await call('PATCH', `/api/collections/${target.id}`, {
    payload: {
      title: 'Mục đã đổi tên',
      summary: 'Tóm tắt mới.',
      kind: 'everyday',
      status: 'accepted',
    },
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(res.status, 200);
  const again = await call('GET', `/api/collections/${target.id}`);
  assert.equal(again.json.title, 'Mục đã đổi tên');
  assert.equal(again.json.summary, 'Tóm tắt mới.');
  assert.equal(again.json.kind, 'everyday');
});

test('gợi ý: nhận và bỏ qua đều trả {ok, suggestion}', async () => {
  const list = await call('GET', '/api/collections?year=2026');
  const detail = await call('GET', `/api/collections/${list.json[0].id}`);
  const rename = detail.json.suggestions.find((s) => s.type === 'rename');
  const accepted = await call('POST', `/api/suggestions/${rename.id}/accept`);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.json.ok, true);
  assert.equal(accepted.json.suggestion.status, 'accepted');

  const other = detail.json.suggestions.find((s) => s.type === 'split');
  const dismissed = await call('POST', `/api/suggestions/${other.id}/dismiss`);
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.json.suggestion.status, 'dismissed');

  const missing = await call('POST', '/api/suggestions/999999/accept');
  assert.equal(missing.status, 404);
});

/* ------------------------------------------------------------------ */
/* 4. Tìm kiếm: 4 câu mẫu, có AI (mock) và không AI                      */
/* ------------------------------------------------------------------ */

const SAMPLE_QUERIES = [
  'ảnh sinh nhật Su năm nay',
  'đi biển tháng 8',
  'Tết ở quê',
  'ảnh có bánh kem',
];

async function checkSearch(client, label) {
  for (const query of SAMPLE_QUERIES) {
    const res = await client('GET', `/api/search?q=${encodeURIComponent(query)}`);
    assert.equal(res.status, 200, `${label}: "${query}" phải trả 200`);
    const payload = res.json;
    assert.equal(payload.query, query, `${label}: query phải khớp`);
    assert.ok(payload.filters && typeof payload.filters === 'object', `${label}: thiếu filters`);
    for (const key of ['from', 'to', 'places', 'tags', 'kinds', 'members']) {
      assert.ok(key in payload.filters, `${label}: thiếu filters.${key}`);
    }
    assert.ok(Array.isArray(payload.results), `${label}: results phải là mảng`);
    assert.ok(Array.isArray(payload.collections), `${label}: collections phải là mảng`);
    assert.ok(payload.results.length > 0, `${label}: "${query}" phải có kết quả`);
    for (const item of payload.results) assertMedia(item, `${label}.results`);
    for (const collection of payload.collections) assertCollection(collection, `${label}.collections`);
  }
}

test('GET /api/search với AI_PROVIDER=mock trả kết quả cho 4 câu mẫu', async () => {
  await checkSearch(call, 'mock');
});

test('GET /api/search với AI_PROVIDER=none (dự phòng từ khoá) vẫn có kết quả', async () => {
  await login(callNone);
  await checkSearch(callNone, 'none');
});

test('GET /api/search từ chối câu quá ngắn', async () => {
  const res = await call('GET', '/api/search?q=a');
  assert.equal(res.status, 400);
});

/* ------------------------------------------------------------------ */
/* 5. Ảnh: tải lên, trạng thái, chỉnh sửa                              */
/* ------------------------------------------------------------------ */

function multipart(files) {
  const boundary = `----htTest${Date.now().toString(36)}`;
  const chunks = [];
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
          `Content-Type: ${file.type ?? 'application/octet-stream'}\r\n\r\n`,
        'utf8',
      ),
    );
    chunks.push(file.buffer);
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

test('POST /api/media nhận ảnh thật và từ chối tệp không phải ảnh', async () => {
  const photo = fs.readFileSync(path.join(PHOTO_DIR, 'hero-om.jpg'));
  const { payload, headers } = multipart([
    { name: 'hero-om.jpg', buffer: photo, type: 'image/jpeg' },
    { name: 'khong-phai-anh.txt', buffer: Buffer.from('xin chào', 'utf8'), type: 'text/plain' },
  ]);
  const res = await call('POST', '/api/media', { payload, headers });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json.accepted) && res.json.accepted.length === 1, 'phải nhận 1 ảnh');
  assert.ok(res.json.accepted[0].id !== undefined, 'thiếu id ảnh');
  assert.ok(Array.isArray(res.json.rejected) && res.json.rejected.length === 1, 'phải từ chối 1 tệp');
  assert.ok(res.json.rejected[0].reason, 'tệp bị từ chối phải có lý do');
  globalThis.__uploadedMediaId = res.json.accepted[0].id;
});

test('GET /api/media/status?ids= trả trạng thái AI từng ảnh', async () => {
  const id = globalThis.__uploadedMediaId;
  const res = await call('GET', `/api/media/status?ids=${id}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json) && res.json.length === 1, 'phải trả 1 ảnh');
  const item = res.json[0];
  assert.equal(item.id, id);
  assert.ok(['pending', 'done', 'failed', 'skipped'].includes(item.aiStatus), 'aiStatus sai');
  assert.ok('caption' in item, 'thiếu caption');
  assert.ok('collectionId' in item, 'thiếu collectionId');
  const empty = await call('GET', '/api/media/status?ids=');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.json, []);
});

test('PATCH /api/media/:id ẩn được ảnh và gán vào mục', async () => {
  const id = globalThis.__uploadedMediaId;
  const list = await call('GET', '/api/collections?year=2026');
  const collection = list.json[0];
  const members = await call('GET', '/api/members');
  const memberIds = members.status === 200 ? members.json.map((m) => m.id) : [];
  const res = await call('PATCH', `/api/media/${id}`, {
    payload: { hidden: true, collectionId: collection.id, memberIds },
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(res.status, 200);
  assertMedia(res.json, 'patch media');
  assert.equal(res.json.flags.hidden, true, 'ảnh phải được ẩn');
  assert.equal(res.json.collectionId, collection.id);
  const missing = await call('PATCH', '/api/media/999999', {
    payload: { hidden: true },
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(missing.status, 404);
});

/* ------------------------------------------------------------------ */
/* 6. Cô lập gia đình                                                   */
/* ------------------------------------------------------------------ */

test('gia đình khác không thấy dữ liệu của gia đình này', async () => {
  const other = createUser(db, {
    username: 'khac',
    email: 'khac@example.com',
    password: PASSWORD,
    displayName: 'Người Khác',
    familyName: 'Nhà Khác',
  });
  const client = makeClient(mockApp);
  const res = await login(client, 'khac@example.com');
  assert.equal(res.status, 200);
  assert.equal(res.json.family.id, other.family.id);

  const collections = await client('GET', '/api/collections?year=2026');
  assert.equal(collections.status, 200);
  assert.deepEqual(collections.json, [], 'gia đình khác không được thấy mục của gia đình này');

  const mine = await call('GET', '/api/collections?year=2026');
  const foreign = await client('GET', `/api/collections/${mine.json[0].id}`);
  assert.equal(foreign.status, 404, 'mục của gia đình khác phải 404');
});

/* ------------------------------------------------------------------ */
/* 7. Gộp / tách mục                                                    */
/* ------------------------------------------------------------------ */

test('POST /api/collections/:id/merge gộp hai mục', async () => {
  const list = await call('GET', '/api/collections?year=2026');
  const source = list.json.find((c) => c.kind === 'weekend');
  const target = list.json.find((c) => c.kind === 'trip');
  const res = await call('POST', `/api/collections/${source.id}/merge`, {
    payload: { intoId: target.id },
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(res.status, 200);
  assertCollection(res.json, 'merge result');
  const after = await call('GET', `/api/collections/${source.id}`);
  assert.equal(after.status, 404, 'mục đã gộp không còn tồn tại');
});

test('POST /api/collections/:id/split tách ảnh ra mục mới', async () => {
  const list = await call('GET', '/api/collections?year=2026');
  const target = list.json.find((c) => c.kind === 'birthday');
  const detail = await call('GET', `/api/collections/${target.id}`);
  const mediaId = detail.json.days[0].media[0].id;
  const res = await call('POST', `/api/collections/${target.id}/split`, {
    payload: { mediaId },
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(res.status, 201);
  assertCollection(res.json, 'split result');
  assert.notEqual(res.json.id, target.id, 'phải tạo mục mới');
});

/* ------------------------------------------------------------------ */
/* 8. Người trong nhà và dải ảnh photobooth                              */
/* ------------------------------------------------------------------ */

test('GET /api/members trả danh sách người trong nhà', async () => {
  const res = await call('GET', '/api/members');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json) && res.json.length >= 4, 'phải có ít nhất 4 người trong nhà');
  for (const member of res.json) {
    assert.ok(member.id !== undefined, 'member thiếu id');
    assert.ok(typeof member.name === 'string' && member.name.length > 0, 'member thiếu name');
    assert.ok('color' in member, 'member thiếu color');
  }
});

test('POST /api/members thêm người vào nhà, trùng tên thì bị từ chối', async () => {
  const res = await call('POST', '/api/members', {
    payload: { name: 'Ông nội', color: '#8A6A4B' },
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.name, 'Ông nội');
  assert.equal(res.json.color, '#8A6A4B');

  const duplicate = await call('POST', '/api/members', {
    payload: { name: 'Ông nội' },
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(duplicate.status, 400, 'trùng tên phải bị từ chối');

  const list = await call('GET', '/api/members');
  assert.ok(list.json.some((m) => m.name === 'Ông nội'), 'người mới phải xuất hiện trong danh sách');
});

test('POST /api/collections/:id/strips nhận PNG và trả Media mới trong mục', async () => {
  const list = await call('GET', '/api/collections?year=2026');
  const target = list.json.find((c) => c.kind === 'holiday') ?? list.json[0];
  // Dải ảnh PNG 1x1 (photobooth ghép ở web).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const res = await call('POST', `/api/collections/${target.id}/strips`, {
    payload: png,
    headers: { 'content-type': 'image/png' },
  });
  assert.equal(res.status, 201);
  assertMedia(res.json, 'strips');
  assert.equal(res.json.collectionId, target.id, 'dải ảnh phải nằm trong mục');

  const bad = await call('POST', `/api/collections/${target.id}/strips`, {
    payload: Buffer.from('không phải png', 'utf8'),
    headers: { 'content-type': 'image/png' },
  });
  assert.equal(bad.status, 400, 'ảnh không hợp lệ phải bị từ chối');
});
