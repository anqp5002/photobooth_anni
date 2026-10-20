import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { createGeoIndex } from '../src/geo.js';
import { loadConfig } from '../src/config.js';
import { createSession } from '../src/auth.js';

const geo = createGeoIndex([], []);

async function makeApp({ withWeb = false, aiProvider = 'mock' } = {}) {
  const mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-app-'));
  let webDist = path.join(mediaDir, 'khong-co-web');
  if (withWeb) {
    webDist = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-web-'));
    await fs.writeFile(
      path.join(webDist, 'index.html'),
      '<!doctype html><html><head><title>Hành Trình</title></head><body>ok</body></html>',
    );
    await fs.mkdir(path.join(webDist, 'assets'));
    await fs.writeFile(path.join(webDist, 'assets', 'app-abc123.js'), 'console.log(1)');
  }
  const config = {
    ...loadConfig({}),
    dbPath: ':memory:',
    mediaDir,
    webDist,
    aiProvider,
    logger: false,
  };
  const db = openDb(':memory:');
  const app = await buildApp({ config, db, geo });
  return { app, db, mediaDir, webDist };
}

function client(app, db) {
  let cookie = db ? `sid=${createSession(db, 1, 30).token}` : '';
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
    return { status: res.statusCode, json, text: res.body };
  };
}

async function register(app, body = {}) {
  const call = client(app);
  const res = await call('POST', '/api/auth/register', {
    payload: {
      username: 'bin',
      email: 'bin@example.com',
      password: 'kyniem123',
      familyName: 'Nhà Bin & Su',
      ...body,
    },
  });
  return { call, res };
}

test('S6 SPA: phục vụ web đã dựng, fallback index.html, tài sản tĩnh cache 1 năm', async (t) => {
  const { app, mediaDir, webDist } = await makeApp({ withWeb: true });
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
    await fs.rm(webDist, { recursive: true, force: true });
  });

  let r = await app.inject({ method: 'GET', url: '/timeline' });
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /Hành Trình/);

  r = await app.inject({ method: 'GET', url: '/assets/app-abc123.js' });
  assert.equal(r.statusCode, 200);
  assert.match(String(r.headers['cache-control']), /max-age=31536000/);

  r = await app.inject({ method: 'GET', url: '/api/khong-co' });
  assert.equal(r.statusCode, 404);
  assert.equal(r.json().error, 'not_found');

  r = await app.inject({ method: 'GET', url: '/media/abc12345/lg.jpg' });
  assert.equal(r.statusCode, 404);
  assert.equal(r.json().error, 'not_found');
});

test('S6 route r1 đã bỏ đăng ký: trips/steps/users trả 404', async (t) => {
  const { app, db, mediaDir } = await makeApp();
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const { call } = await register(app);
  for (const url of ['/api/trips', '/api/trips/1', '/api/steps/1', '/api/users/bin']) {
    const res = await call('GET', url);
    assert.equal(res.status, 404, `${url} phải 404`);
    assert.equal(res.json.error, 'not_found');
  }
  // Route r2 vẫn sống.
  assert.equal((await call('GET', '/api/me')).status, 200);
  assert.equal((await call('GET', '/api/home')).status, 200);
  assert.ok(db);
});

test('S6 members: đọc danh sách, thêm tay, chặn trùng và màu sai', async (t) => {
  const { app, mediaDir } = await makeApp();
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const { call } = await register(app);

  let res = await call('GET', '/api/members');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json));
  const initial = res.json.length;
  assert.ok(res.json.every((item) => item.id && item.name && 'color' in item));

  res = await call('POST', '/api/members', { payload: { name: 'Su', color: '#6E8BB5' } });
  assert.equal(res.status, 201);
  assert.equal(res.json.name, 'Su');
  assert.equal(res.json.color, '#6E8BB5');
  const suId = res.json.id;

  res = await call('POST', '/api/members', { payload: { name: 'Su' } });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'duplicate_member');

  res = await call('POST', '/api/members', { payload: { name: 'Bin', color: 'xanh' } });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'invalid_color');

  res = await call('GET', '/api/members');
  assert.equal(res.json.length, initial + 1);

  // Gắn người vào mục qua PATCH memberIds.
  const ownerFamily = res.json.length > 0;
  assert.ok(ownerFamily);
  const collection = dbInsertCollection(app);
  res = await call('PATCH', `/api/collections/${collection}`, { payload: { memberIds: [suId] } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.members.map((item) => item.name), ['Su']);

  const anonymous = await app.inject({ method: 'GET', url: '/api/members' });
  assert.equal(anonymous.statusCode, 401);
});

function dbInsertCollection(app) {
  const db = app.db;
  const family = db.prepare('SELECT id FROM families ORDER BY id LIMIT 1').get();
  const info = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, start_at, end_at, status, source, created_at, updated_at)
       VALUES (?, 'everyday', 'Mục thử', '2026-05-01', '2026-05-01', 'accepted', 'user', ?, ?)`,
    )
    .run(family.id, '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z');
  return Number(info.lastInsertRowid);
}

test('S6 strips: PNG thô thành ảnh mới trong mục, có file lg/sm, vào hàng đợi AI', async (t) => {
  const { app, db, mediaDir } = await makeApp();
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const { call, res: registered } = await register(app);
  assert.equal(registered.status, 201);
  const collectionId = dbInsertCollection(app);
  const png = await sharp({
    create: { width: 48, height: 96, channels: 3, background: { r: 240, g: 230, b: 220 } },
  })
    .png()
    .toBuffer();

  let res = await call('POST', `/api/collections/${collectionId}/strips`, {
    payload: png,
    headers: { 'content-type': 'image/png' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.type, 'photo');
  assert.equal(res.json.collectionId, collectionId);
  assert.equal(res.json.width, 48);
  assert.equal(res.json.height, 96);
  assert.ok(res.json.url.lg.endsWith('lg.jpg'));

  await app.ai.idle();
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(res.json.id);
  assert.equal(row.family_id, 1);
  assert.equal(row.collection_id, collectionId);
  assert.ok(['done', 'skipped'].includes(row.ai_status));
  for (const file of ['orig.png', 'lg.jpg', 'sm.jpg']) {
    await fs.access(path.join(mediaDir, row.code, file));
  }

  // Nội dung không phải PNG → 400, không tạo ảnh.
  const before = db.prepare('SELECT COUNT(*) AS n FROM media').get().n;
  res = await call('POST', `/api/collections/${collectionId}/strips`, {
    payload: Buffer.from('day khong phai png'),
    headers: { 'content-type': 'image/png' },
  });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'invalid_png');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media').get().n, before);

  // Mục của nhà khác → 404.
  const other = db
    .prepare("INSERT INTO families (name, slug, created_at) VALUES ('Nhà khác', 'nha-khac', '2026-01-01T00:00:00Z')")
    .run();
  const stranger = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, start_at, end_at, status, source, created_at, updated_at)
       VALUES (?, 'everyday', 'Mục lạ', '2026-05-01', '2026-05-01', 'accepted', 'user', ?, ?)`,
    )
    .run(Number(other.lastInsertRowid), '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z');
  res = await call('POST', `/api/collections/${Number(stranger.lastInsertRowid)}/strips`, {
    payload: png,
    headers: { 'content-type': 'image/png' },
  });
  assert.equal(res.status, 404);
});
