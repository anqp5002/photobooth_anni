/**
 * Kiểm tra dữ liệu giả của web r2 khớp hợp đồng API (MEGAPLAN_r2.md).
 *
 * Chạy: node tests/mock-contract.mjs
 * Không phụ thuộc gói ngoài.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOCK_DIR = path.join(ROOT, 'impl', 'web', 'src', 'dev', 'mock');
const PHOTOS_DIR = path.join(ROOT, 'design', 'proto', 'assets', 'photos');

const problems = [];
const ok = [];
const fail = (msg) => problems.push(msg);
const pass = (msg) => ok.push(msg);

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(MOCK_DIR, file), 'utf8'));

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkMedia(m, where) {
  if (!isObj(m)) return fail(`${where}: media không phải object`);
  for (const key of ['id', 'type', 'takenAt', 'place', 'country', 'caption']) {
    if (!isStr(m[key])) fail(`${where}: media thiếu "${key}"`);
  }
  if (!['photo', 'video'].includes(m.type)) fail(`${where}: media.type sai (${m.type})`);
  if (!isNum(m.lat) || !isNum(m.lon)) fail(`${where}: media thiếu lat/lon`);
  if (!Array.isArray(m.tags)) fail(`${where}: media.tags không phải mảng`);
  if (!isNum(m.score)) fail(`${where}: media thiếu score`);
  if (!isNum(m.width) || !isNum(m.height)) fail(`${where}: media thiếu width/height`);
  if (!isObj(m.url) || !isStr(m.url.sm) || !isStr(m.url.lg) || !isStr(m.url.orig)) {
    fail(`${where}: media.url phải có sm/lg/orig`);
  }
  if (!isObj(m.flags)) fail(`${where}: media thiếu flags`);
  else {
    for (const f of ['blurry', 'nearDuplicate', 'hidden']) {
      if (typeof m.flags[f] !== 'boolean') fail(`${where}: media.flags.${f} phải là boolean`);
    }
  }
  if (!['pending', 'done', 'failed', 'skipped'].includes(m.aiStatus)) {
    fail(`${where}: media.aiStatus sai (${m.aiStatus})`);
  }
  if (m.collectionId !== null && !isStr(m.collectionId)) fail(`${where}: media.collectionId sai`);
}

function checkCollection(c, where) {
  if (!isObj(c)) return fail(`${where}: collection không phải object`);
  for (const key of ['id', 'kind', 'title', 'summary', 'place', 'startAt', 'endAt']) {
    if (!isStr(c[key])) fail(`${where}: collection thiếu "${key}"`);
  }
  if (!['suggested', 'accepted'].includes(c.status)) fail(`${where}: collection.status sai`);
  if (!isNum(c.count)) fail(`${where}: collection thiếu count`);
  if (!Array.isArray(c.members) || c.members.length === 0) fail(`${where}: collection thiếu members`);
  else {
    for (const m of c.members) {
      if (!isObj(m) || !isStr(m.id) || !isStr(m.name) || !isStr(m.color)) {
        fail(`${where}: member thiếu id/name/color`);
      }
    }
  }
  checkMedia(c.cover, `${where}.cover`);
}

function checkDetail(d, where) {
  checkCollection(d, where);
  if (!Array.isArray(d.days) || d.days.length === 0) fail(`${where}: thiếu days`);
  else {
    for (const day of d.days) {
      if (!isStr(day.date)) fail(`${where}: day thiếu date`);
      if (!Array.isArray(day.media) || day.media.length === 0) fail(`${where}: day thiếu media`);
      else day.media.forEach((m) => checkMedia(m, `${where}.days[${day.date}]`));
    }
  }
  if (!Array.isArray(d.route) || d.route.length === 0) fail(`${where}: thiếu route`);
  else {
    for (const p of d.route) {
      if (!isNum(p.lat) || !isNum(p.lon)) fail(`${where}: route thiếu lat/lon`);
    }
  }
  const types = new Set();
  if (!Array.isArray(d.suggestions) || d.suggestions.length === 0) fail(`${where}: thiếu suggestions`);
  else {
    for (const s of d.suggestions) {
      if (!isStr(s.id) || !isStr(s.text) || !isObj(s.payload)) fail(`${where}: suggestion thiếu id/text/payload`);
      if (!['hide_blurry', 'merge', 'split', 'rename'].includes(s.type)) {
        fail(`${where}: suggestion.type sai (${s.type})`);
      }
      types.add(s.type);
    }
    for (const t of ['hide_blurry', 'merge', 'split', 'rename']) {
      if (!types.has(t)) fail(`${where}: thiếu suggestion loại "${t}"`);
    }
  }
}

/* ---------------- me ---------------- */
const me = readJson('me.json');
if (!isObj(me.user) || !isStr(me.user.id) || !isStr(me.user.username) || !isStr(me.user.displayName)
  || !isStr(me.user.avatarColor)) fail('me.json: user thiếu trường');
if (!isObj(me.family) || !isStr(me.family.id) || !isStr(me.family.name) || !isStr(me.family.slug)) {
  fail('me.json: family thiếu trường');
}
pass('me.json');

/* ---------------- home ---------------- */
const home = readJson('home.json');
if (!isStr(home.greeting)) fail('home.json: thiếu greeting');
for (const key of ['photos', 'videos', 'places', 'collections']) {
  if (!isNum(home.stats?.[key])) fail(`home.json: stats.${key} thiếu`);
}
if (!Array.isArray(home.recent) || home.recent.length === 0) fail('home.json: recent rỗng');
else {
  if (home.recent.length > 12) fail('home.json: recent phải ≤ 12');
  home.recent.forEach((m) => checkMedia(m, 'home.recent'));
}
if (!Array.isArray(home.collections) || home.collections.length !== 7) {
  fail('home.json: collections phải có 7 mục');
} else home.collections.forEach((c) => checkCollection(c, 'home.collections'));
if (!isObj(home.onThisDay) || !isNum(home.onThisDay.yearsAgo) || !isStr(home.onThisDay.date)) {
  fail('home.json: onThisDay thiếu trường');
} else checkMedia(home.onThisDay.media, 'home.onThisDay.media');
if (!Array.isArray(home.mapPreview?.points) || home.mapPreview.points.length === 0) {
  fail('home.json: mapPreview.points rỗng');
} else {
  for (const p of home.mapPreview.points) {
    if (!isNum(p.lat) || !isNum(p.lon) || !isNum(p.count)) fail('home.json: mapPreview point thiếu lat/lon/count');
  }
}
pass('home.json');

/* ---------------- collections ---------------- */
const collections = readJson('collections.json');
if (!Array.isArray(collections) || collections.length !== 7) fail('collections.json: phải có 7 mục');
else collections.forEach((c) => checkCollection(c, 'collections'));
const kinds = new Set(collections.map((c) => c.kind));
for (const k of ['tet', 'baby', 'birthday', 'trip', 'weekend', 'holiday']) {
  if (!kinds.has(k)) fail(`collections.json: thiếu kind "${k}"`);
}
pass('collections.json');

/* ---------------- chi tiết từng mục ---------------- */
const detailFiles = fs.readdirSync(MOCK_DIR).filter((f) => f.startsWith('collection-') && f.endsWith('.json'));
if (detailFiles.length < 2) fail('thiếu file collection-<id>.json');
for (const f of detailFiles) {
  const d = readJson(f);
  checkDetail(d, f);
  if (!collections.some((c) => c.id === d.id)) fail(`${f}: id không khớp collections.json`);
}
pass(`${detailFiles.length} file collection-<id>.json`);

/* ---------------- recap ---------------- */
const recap = readJson('recap-2026.json');
if (recap.year !== 2026) fail('recap-2026.json: year phải là 2026');
if (!isStr(recap.intro)) fail('recap-2026.json: thiếu intro');
for (const key of ['photos', 'videos', 'places', 'collections', 'birthdays', 'trips']) {
  if (!isNum(recap.stats?.[key])) fail(`recap-2026.json: stats.${key} thiếu`);
}
if (!Array.isArray(recap.chapters) || recap.chapters.length === 0) fail('recap-2026.json: chapters rỗng');
else {
  for (const ch of recap.chapters) {
    if (!isNum(ch.month) || ch.month < 1 || ch.month > 12) fail('recap-2026.json: chapter.month sai');
    checkCollection(ch.collection, 'recap.chapter.collection');
    if (!Array.isArray(ch.highlights) || ch.highlights.length > 4) {
      fail('recap-2026.json: highlights phải ≤ 4');
    } else ch.highlights.forEach((m) => checkMedia(m, 'recap.highlight'));
  }
}
if (!Array.isArray(recap.topPlaces) || recap.topPlaces.length === 0) fail('recap-2026.json: topPlaces rỗng');
pass('recap-2026.json');

/* ---------------- timeline ---------------- */
const timeline = readJson('timeline-2026.json');
if (!Array.isArray(timeline.months) || timeline.months.length === 0) fail('timeline-2026.json: months rỗng');
else {
  for (const m of timeline.months) {
    if (!isNum(m.month)) fail('timeline-2026.json: thiếu month');
    if (!Array.isArray(m.days) || m.days.length === 0) fail('timeline-2026.json: thiếu days');
    for (const d of m.days) {
      if (!isStr(d.date)) fail('timeline-2026.json: day thiếu date');
      if (d.collectionId !== null && !isStr(d.collectionId)) fail('timeline-2026.json: collectionId sai');
      if (!Array.isArray(d.media) || d.media.length === 0) fail('timeline-2026.json: day thiếu media');
      else d.media.forEach((x) => checkMedia(x, 'timeline.media'));
    }
  }
}
if (!('nextCursor' in timeline)) fail('timeline-2026.json: thiếu nextCursor');
pass('timeline-2026.json');

/* ---------------- map ---------------- */
const map = readJson('map.json');
if (!Array.isArray(map.points) || map.points.length !== 9) fail('map.json: phải có 9 nơi');
else {
  for (const p of map.points) {
    if (!isStr(p.id) || !isStr(p.place) || !isNum(p.lat) || !isNum(p.lon) || !isNum(p.count)) {
      fail('map.json: point thiếu trường');
    }
    checkMedia(p.cover, 'map.point.cover');
  }
}
pass('map.json');

/* ---------------- tìm kiếm ---------------- */
const searchFiles = fs.readdirSync(MOCK_DIR).filter((f) => f.startsWith('search-') && f.endsWith('.json'));
const needQueries = ['ảnh sinh nhật Su năm nay', 'đi biển tháng 8', 'Tết ở quê', 'ảnh có bánh kem'];
const slugify = (t) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
for (const q of needQueries) {
  const file = `search-${slugify(q)}.json`;
  if (!fs.existsSync(path.join(MOCK_DIR, file))) {
    fail(`thiếu ${file} cho câu "${q}"`);
    continue;
  }
  const s = readJson(file);
  if (s.query !== q) fail(`${file}: query phải là "${q}"`);
  for (const key of ['from', 'to', 'places', 'tags', 'kinds', 'members']) {
    if (!(key in (s.filters ?? {}))) fail(`${file}: filters.${key} thiếu`);
  }
  if (!Array.isArray(s.results) || s.results.length === 0) fail(`${file}: results rỗng`);
  else s.results.forEach((m) => checkMedia(m, `${file}.results`));
  if (!Array.isArray(s.collections)) fail(`${file}: thiếu collections`);
}
const empty = readJson('search-empty.json');
if (!Array.isArray(empty.results) || empty.results.length !== 0) fail('search-empty.json: results phải rỗng');
pass(`${searchFiles.length} file search-*.json`);

/* ---------------- media status + members ---------------- */
const status = readJson('media-status.json');
if (!Array.isArray(status) || status.length === 0) fail('media-status.json: rỗng');
else {
  for (const s of status) {
    if (!isStr(s.id) || !isStr(s.aiStatus) || !('caption' in s) || !('collectionId' in s)) {
      fail('media-status.json: thiếu trường');
    }
  }
}
const members = readJson('members.json');
if (!Array.isArray(members) || members.length === 0) fail('members.json: rỗng');
else {
  for (const m of members) {
    if (!isStr(m.id) || !isStr(m.name) || !isStr(m.color)) fail('members.json: thiếu id/name/color');
  }
}
pass('media-status.json + members.json');

/* ---------------- ảnh: dùng đúng 27 ảnh proto ---------------- */
const photoFiles = fs.readdirSync(PHOTOS_DIR).filter((f) => f.endsWith('.jpg'));
const used = new Set();
const collectUrls = (node) => {
  if (Array.isArray(node)) return node.forEach(collectUrls);
  if (isObj(node)) {
    if (isObj(node.url)) {
      for (const key of ['sm', 'lg', 'orig']) {
        const v = node.url[key];
        if (typeof v === 'string' && v.startsWith('/proto-photos/')) used.add(v.replace('/proto-photos/', ''));
      }
    }
    Object.values(node).forEach(collectUrls);
  }
};
for (const f of fs.readdirSync(MOCK_DIR).filter((x) => x.endsWith('.json'))) {
  collectUrls(readJson(f));
}
const missing = photoFiles.filter((f) => !used.has(f));
const extra = [...used].filter((f) => !photoFiles.includes(f));
if (missing.length) fail(`ảnh proto chưa dùng: ${missing.join(', ')}`);
if (extra.length) fail(`url trỏ tới ảnh không tồn tại: ${extra.join(', ')}`);
if (used.size !== 27) fail(`đã dùng ${used.size}/27 ảnh proto`);
else pass(`27/27 ảnh proto được dùng`);

/* ---------------- index.ts có bảng route ---------------- */
const indexTs = fs.readFileSync(path.join(MOCK_DIR, 'index.ts'), 'utf8');
for (const route of ['/api/me', '/api/home', '/api/recap', '/api/collections', '/api/timeline', '/api/map', '/api/search', '/api/media/status', '/api/members']) {
  if (!indexTs.includes(route)) fail(`index.ts: thiếu route ${route}`);
}
if (!fs.existsSync(path.join(MOCK_DIR, 'README.md'))) fail('thiếu README.md');
pass('index.ts + README.md');

/* ---------------- kết quả ---------------- */
for (const line of ok) console.log(`  ok  ${line}`);
if (problems.length) {
  console.error(`\n${problems.length} lỗi:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nMock khớp hợp đồng API r2.');
