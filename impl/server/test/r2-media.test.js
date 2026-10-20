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
import { createFreeLlmClient, mockAnalysis, normalizeAnalysis, parseJsonLoose } from '../src/ai/freellm.js';

const geo = createGeoIndex(
  [{ name: 'Đà Lạt', lat: 11.94646, lon: 108.44193, countryCode: 'VN', timezone: 'Asia/Ho_Chi_Minh' }],
  [['VN', 'Vietnam']],
);

async function makeApp(overrides = {}) {
  const mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanhtrinh-media-'));
  const config = {
    ...loadConfig({}),
    dbPath: ':memory:',
    mediaDir,
    webDist: path.join(mediaDir, 'khong-co-web'),
    aiProvider: 'mock',
    logger: false,
    ...overrides,
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

function multipart(files) {
  const boundary = `----hanhtrinh${Date.now().toString(16)}`;
  const chunks = [];
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.contentType ?? 'application/octet-stream'}\r\n\r\n`,
      ),
    );
    chunks.push(Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

async function jpeg(color) {
  return sharp({ create: { width: 320, height: 240, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
}

test('S2 mock: tải ảnh → hàng đợi phân tích → status done, FTS có dữ liệu', async (t) => {
  const { app, db, mediaDir } = await makeApp({ aiProvider: 'mock' });
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const owner = client(app);
  await owner('POST', '/api/auth/register', {
    payload: { username: 'bin', email: 'bin@example.com', password: 'kyniem123', displayName: 'Bin' },
  });

  const upload = multipart([
    { filename: 'bien-1.jpg', buffer: await jpeg('#88bbdd'), contentType: 'image/jpeg' },
    { filename: 'bien-2.jpg', buffer: await jpeg('#ddaa88'), contentType: 'image/jpeg' },
    { filename: 'ghi-chu.txt', buffer: 'không phải ảnh', contentType: 'text/plain' },
  ]);
  let r = await owner('POST', '/api/media', upload);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.accepted.length, 2);
  assert.equal(r.json.rejected.length, 1);
  assert.match(r.json.rejected[0].reason, /ảnh/);
  const ids = r.json.accepted.map((item) => item.id);
  assert.deepEqual(r.json.accepted.map((item) => item.file), ['bien-1.jpg', 'bien-2.jpg']);

  await app.ai.idle();

  r = await owner('GET', `/api/media/status?ids=${ids.join(',')}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.length, 2);
  for (const item of r.json) {
    assert.equal(item.aiStatus, 'done');
    assert.ok(item.caption && item.caption.length > 3, 'caption tiếng Việt từ AI');
    assert.equal(item.collectionId, null);
  }

  const rows = db.prepare('SELECT * FROM media WHERE id IN (?, ?)').all(...ids);
  for (const row of rows) {
    assert.ok(row.dhash, 'lưu dHash để phát hiện ảnh gần trùng');
    assert.match(row.ai_tags, /^\[".*"\]$/);
    assert.ok(row.ai_score >= 5 && row.ai_score <= 9, `score 1–10, nhận ${row.ai_score}`);
    assert.ok(row.ai_kind_hint);
    assert.equal(row.family_id, db.prepare('SELECT family_id FROM users WHERE username = ?').get('bin').family_id);
    assert.equal(row.uploader_id, db.prepare('SELECT id FROM users WHERE username = ?').get('bin').id);
  }

  const fts = db.prepare('SELECT COUNT(*) AS n FROM media_fts WHERE media_id IN (?, ?)').get(...ids.map(String));
  assert.equal(fts.n, 2, 'mỗi ảnh có một dòng FTS sau khi AI xong');

  // ảnh cùng nội dung → gần trùng và có gợi ý ẩn
  const again = multipart([{ filename: 'bien-1-copy.jpg', buffer: await jpeg('#88bbdd'), contentType: 'image/jpeg' }]);
  r = await owner('POST', '/api/media', again);
  const copyId = r.json.accepted[0].id;
  await app.ai.idle();
  const copy = db.prepare('SELECT * FROM media WHERE id = ?').get(copyId);
  assert.ok(copy.near_duplicate === 1 || copy.blurry === 1, 'ảnh chép lại phải bị đánh dấu');
  const suggestion = db.prepare('SELECT * FROM suggestions WHERE media_id = ? AND status = ?').get(copyId, 'open');
  assert.ok(suggestion, 'có gợi ý ẩn ảnh mờ/trùng');
  assert.equal(suggestion.type, 'hide_blurry');
});

test('S2 none: không gọi AI nhưng vẫn chấm mờ/trùng và ghi skipped', async (t) => {
  const { app, db, mediaDir } = await makeApp({ aiProvider: 'none' });
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const owner = client(app);
  await owner('POST', '/api/auth/register', {
    payload: { username: 'su98', email: 'su@example.com', password: 'kyniem123' },
  });
  const r = await owner(
    'POST',
    '/api/media',
    multipart([{ filename: 'nha.jpg', buffer: await jpeg('#445566'), contentType: 'image/jpeg' }]),
  );
  assert.equal(r.status, 200, r.text);
  const id = r.json.accepted[0].id;
  await app.ai.idle();

  const status = await owner('GET', `/api/media/status?ids=${id}`);
  assert.equal(status.json[0].aiStatus, 'skipped');
  assert.equal(status.json[0].caption, null);
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  assert.equal(row.ai_status, 'skipped');
  assert.ok(row.dhash, 'vẫn có dHash dù không gọi AI');
});

test('S2 PATCH media: ẩn, gán mục, gắn người; 404 với gia đình khác; 401 khi chưa đăng nhập', async (t) => {
  const { app, db, mediaDir } = await makeApp({ aiProvider: 'none' });
  t.after(async () => {
    await app.close();
    await fs.rm(mediaDir, { recursive: true, force: true });
  });
  const owner = client(app);
  const stranger = client(app);
  await owner('POST', '/api/auth/register', {
    payload: { username: 'bin', email: 'bin@example.com', password: 'kyniem123', displayName: 'Bin' },
  });
  await stranger('POST', '/api/auth/register', {
    payload: { username: 'khach', email: 'khach@example.com', password: 'kyniem123' },
  });

  const upload = await owner(
    'POST',
    '/api/media',
    multipart([{ filename: 'a.jpg', buffer: await jpeg('#112233'), contentType: 'image/jpeg' }]),
  );
  const mediaId = upload.json.accepted[0].id;
  await app.ai.idle();

  const familyId = db.prepare('SELECT family_id FROM users WHERE username = ?').get('bin').family_id;
  const memberId = db.prepare('SELECT id FROM members WHERE family_id = ?').get(familyId).id;
  const collection = db
    .prepare(
      `INSERT INTO collections (family_id, kind, title, summary, place, start_at, end_at, status, source, created_at, updated_at)
       VALUES (?, 'trip', 'Hè ở Đà Lạt', 'Mấy ngày mát mẻ', 'Đà Lạt', '2026-06-01T00:00:00Z',
               '2026-06-03T00:00:00Z', 'accepted', 'user', '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z')`,
    )
    .run(familyId);

  let r = await owner('PATCH', `/api/media/${mediaId}`, {
    payload: { hidden: true, collectionId: Number(collection.lastInsertRowid), memberIds: [memberId] },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.flags.hidden, true);
  assert.equal(r.json.collectionId, Number(collection.lastInsertRowid));

  const links = db.prepare('SELECT member_id FROM media_members WHERE media_id = ?').all(mediaId);
  assert.deepEqual(links.map((row) => row.member_id), [memberId]);

  // FTS cập nhật tiêu đề mục: tìm không dấu ra ảnh
  const found = db
    .prepare(
      `SELECT media_id FROM media_fts WHERE media_fts MATCH ? AND family_id = ? ORDER BY bm25(media_fts)`,
    )
    .all('"da"* AND "lat"*', String(familyId));
  assert.deepEqual(found.map((row) => Number(row.media_id)), [mediaId]);

  r = await owner('PATCH', `/api/media/${mediaId}`, { payload: { collectionId: 999999 } });
  assert.equal(r.status, 400);
  r = await owner('PATCH', `/api/media/${mediaId}`, { payload: { memberIds: [999999] } });
  assert.equal(r.status, 400);
  r = await owner('PATCH', `/api/media/${mediaId}`, { payload: { hidden: 'yes' } });
  assert.equal(r.status, 400);

  r = await stranger('PATCH', `/api/media/${mediaId}`, { payload: { hidden: true } });
  assert.equal(r.status, 404);

  r = await client(app)('POST', '/api/media', multipart([]));
  assert.equal(r.status, 401);
  const anonStatus = await client(app)('GET', '/api/media/status?ids=1');
  assert.equal(anonStatus.status, 401);
});

test('S2 freellm client: parse JSON an toàn, chuẩn hoá, thử lại 2 lần khi lỗi', async () => {
  assert.deepEqual(parseJsonLoose('```json\n{"caption":"Đi biển","tags":["biển"],}\n```'), {
    caption: 'Đi biển',
    tags: ['biển'],
  });
  assert.equal(parseJsonLoose('xin chào'), null);
  assert.equal(parseJsonLoose('{"a":1'), null);

  const normalized = normalizeAnalysis({
    caption: '  Bánh kem sinh nhật  ',
    tags: ['bánh kem', 'sinh nhật', '', 7, 'nến'],
    score: 12,
    kind_hint: 'BIRTHDAY',
    extra: 'bỏ',
  });
  assert.deepEqual(normalized, {
    caption: 'Bánh kem sinh nhật',
    tags: ['bánh kem', 'sinh nhật', '7', 'nến'],
    score: 10,
    kindHint: 'birthday',
    seed: '',
  });

  const mock = mockAnalysis('bien-1.jpg');
  assert.deepEqual(mockAnalysis('bien-1.jpg'), mock, 'mock phải cố định theo tên tệp');
  assert.ok(mock.caption && mock.kindHint && mock.tags.length > 0);

  let calls = 0;
  const failing = createFreeLlmClient({
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 500, json: async () => ({}) };
    },
    retries: 2,
  });
  await assert.rejects(failing.analyzePhoto({ dataUrl: 'data:image/jpeg;base64,AAAA' }), /FreeLLM 500/);
  assert.equal(calls, 3, '1 lần gọi + 2 lần thử lại');

  let okCalls = 0;
  const good = createFreeLlmClient({
    baseUrl: 'http://127.0.0.1:3001/',
    fetchImpl: async (url, init) => {
      okCalls += 1;
      assert.equal(url, 'http://127.0.0.1:3001/v1/chat/completions');
      assert.equal(JSON.parse(init.body).model, 'auto');
      assert.ok(JSON.parse(init.body).messages[1].content[1].image_url.url.startsWith('data:image/jpeg;base64,'));
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"caption":"Cả nhà đi biển","tags":["biển"],"kind_hint":"trip","score":8}' } }],
        }),
      };
    },
  });
  const out = await good.analyzePhoto({ dataUrl: 'data:image/jpeg;base64,AAAA', place: 'Nha Trang' });
  assert.equal(out.caption, 'Cả nhà đi biển');
  assert.equal(out.kindHint, 'trip');
  assert.equal(out.score, 8);
  assert.equal(okCalls, 1);
});
