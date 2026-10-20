/**
 * Chụp 18 ảnh smoke r2: `shots/r2-<trang>-<1440|390>.png` cho 9 trang × 2 khung.
 *
 * Script tự dựng môi trường: DB + MEDIA tạm → `scripts/seed-family.js` → máy chủ thật
 * (AI_PROVIDER=mock) → Chromium đăng nhập `bo@bin-su.vn` → chụp.
 *
 * Chạy: node tests/shots-r2.mjs
 * Biến môi trường: SHOTS_PORT (mặc định 8972), KEEP=1 (giữ DB tạm), SHOTS_DIR (mặc định shots/)
 *   SHOTS_PAGES=dong-thoi-gian,tai-anh   chỉ chụp vài trang
 *   SHOTS_PREFIX=G5-                     tiền tố tên tệp
 *   SHOTS_QUERY=tab=dang-ky              thêm query vào đường dẫn (chụp tab / trạng thái khác)
 *   SHOTS_LOGGED_OUT=dang-nhap           chụp các trang này bằng trình duyệt CHƯA đăng nhập
 *                                        (mặc định `dang-nhap` để thấy biểu mẫu đăng nhập)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SERVER_DIR = path.join(ROOT, 'impl', 'server');
const SHOTS_DIR = path.resolve(ROOT, process.env.SHOTS_DIR || 'shots');
const PORT = Number(process.env.SHOTS_PORT || 8972);
const BASE = `http://127.0.0.1:${PORT}`;

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440' },
  { width: 390, height: 844, label: '390' },
];

/** Chọn phụ (dùng khi chụp riêng cho một màn): SHOTS_PAGES=dong-thoi-gian,tai-anh */
const ONLY_PAGES = (process.env.SHOTS_PAGES ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const FILE_PREFIX = process.env.SHOTS_PREFIX ?? 'r2';
/** Chọn tệp mẫu để trang tải ảnh có dữ liệu (mô phỏng người dùng chọn ảnh). */
const PREPARE_UPLOAD = process.env.SHOTS_PREPARE_UPLOAD === '1';
/** Query thêm vào mọi đường dẫn (chụp tab / trạng thái khác của cùng một trang). */
const EXTRA_QUERY = (process.env.SHOTS_QUERY ?? '').trim();
/** Trang chụp bằng trình duyệt chưa đăng nhập (đăng nhập/đăng ký phải thấy biểu mẫu). */
const LOGGED_OUT = new Set(
  (process.env.SHOTS_LOGGED_OUT ?? 'dang-nhap')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);
const PROTO_PHOTOS = path.join(ROOT, 'design', 'proto', 'assets', 'photos');

/** 9 trang theo MEGAPLAN_r2.md → "Trang (SPA)". `needCollection` = cần id mục thật. */
const PAGES = [
  { slug: 'home', path: '/', needCollection: false },
  { slug: 'tong-ket', path: '/tong-ket/2026', needCollection: false },
  { slug: 'muc', path: '/muc/{id}', needCollection: true },
  { slug: 'ban-do', path: '/ban-do', needCollection: false },
  { slug: 'dong-thoi-gian', path: '/dong-thoi-gian', needCollection: false },
  {
    slug: 'tim-kiem',
    path: `/tim-kiem?q=${encodeURIComponent('ảnh sinh nhật Su năm nay')}`,
    needCollection: false,
  },
  { slug: 'tai-anh', path: '/tai-anh', needCollection: false },
  { slug: 'photobooth', path: '/photobooth?muc={id}', needCollection: true },
  { slug: 'dang-nhap', path: '/dang-nhap', needCollection: false },
].filter((item) => ONLY_PAGES.length === 0 || ONLY_PAGES.includes(item.slug));

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* chưa lên */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('máy chủ không lên');
}

async function main() {
  await fsp.mkdir(SHOTS_DIR, { recursive: true });
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ht-shots-'));
  const dbPath = path.join(tmp, 'db.sqlite');
  const mediaDir = path.join(tmp, 'media');
  const env = {
    ...process.env,
    DB_PATH: dbPath,
    MEDIA_DIR: mediaDir,
    AI_PROVIDER: 'mock',
    PORT: String(PORT),
    HOST: '127.0.0.1',
  };

  console.log(`[shots] DB tạm: ${dbPath}`);
  console.log('[shots] seed-family.js…');
  await run(process.execPath, ['scripts/seed-family.js'], { cwd: SERVER_DIR, env, stdio: 'pipe' });

  console.log(`[shots] dựng máy chủ ${BASE}…`);
  const server = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env,
    stdio: 'pipe',
  });
  const serverLog = [];
  server.stdout.on('data', (d) => serverLog.push(String(d)));
  server.stderr.on('data', (d) => serverLog.push(String(d)));

  const cleanup = async () => {
    server.kill();
    // Chờ máy chủ thoát hẳn rồi mới xoá DB tạm (file WAL còn khoá trên Windows).
    await new Promise((resolve) => {
      server.once('exit', resolve);
      setTimeout(resolve, 5000);
    });
    if (process.env.KEEP !== '1') {
      await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  };

  try {
    await waitForServer();

    const browser = await chromium.launch({
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    const results = [];

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: 'vi-VN',
        permissions: ['camera', 'microphone'],
      });
      const login = await context.request.post(`${BASE}/api/auth/login`, {
        data: { email: 'bo@bin-su.vn', password: 'kyniem123' },
      });
      if (!login.ok()) throw new Error(`đăng nhập thất bại: ${login.status()}`);

      // Id mục kỷ niệm đầu tiên (dùng cho /muc/<id> và /photobooth?muc=<id>).
      const listRes = await context.request.get(`${BASE}/api/collections?year=2026`);
      const collectionId = listRes.ok() ? (await listRes.json())[0]?.id : null;

      for (const target of PAGES) {
        const loggedOut = LOGGED_OUT.has(target.slug);
        const pageContext = loggedOut
          ? await browser.newContext({
              viewport: { width: viewport.width, height: viewport.height },
              locale: 'vi-VN',
            })
          : context;
        const page = await pageContext.newPage();
        const errors = [];
        page.on('console', (m) => {
          if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) {
            errors.push(m.text());
          }
        });
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        const basePath = target.path.replace('{id}', String(collectionId ?? 1));
        const url = EXTRA_QUERY
          ? `${basePath}${basePath.includes('?') ? '&' : '?'}${EXTRA_QUERY}`
          : basePath;
        const separator = FILE_PREFIX && !FILE_PREFIX.endsWith('-') ? '-' : '';
        const file = path.join(
          SHOTS_DIR,
          `${FILE_PREFIX}${separator}${target.slug}-${viewport.label}.png`,
        );
        try {
          await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        } catch (err) {
          errors.push(`goto: ${err.message}`);
        }
        // Mô phỏng người dùng chọn ảnh để trang tải ảnh có danh sách và tiến độ.
        if (PREPARE_UPLOAD && target.slug === 'tai-anh') {
          await page
            .setInputFiles('input[type=file]', path.join(PROTO_PHOTOS, 'hero-om.jpg'))
            .catch((err) => errors.push(`setInputFiles: ${err.message}`));
          await page.waitForTimeout(4000);
        }
        // Chờ ảnh tải xong + canvas bản đồ (nếu có) rồi chụp.
        await page
          .waitForFunction(
            () =>
              Array.from(document.images).every((img) => img.complete),
            null,
            { timeout: 8000 },
          )
          .catch(() => {});
        await page.waitForSelector('canvas', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(900);
        await page.screenshot({ path: file });
        results.push({ slug: target.slug, viewport: viewport.label, file, url, errors });
        console.log(
          `[shots] ${path.basename(file)} <- ${url}${errors.length ? ` (${errors.length} lỗi console)` : ''}`,
        );
        await page.close();
        if (loggedOut) await pageContext.close();
      }
      await context.close();
    }

    await browser.close();
    const files = results.map((item) => path.basename(item.file));
    console.log(`[shots] xong: ${files.length} ảnh trong ${SHOTS_DIR}`);
    const withErrors = results.filter((item) => item.errors.length);
    if (withErrors.length) {
      console.log('[shots] trang có lỗi console:');
      for (const item of withErrors) {
        console.log(`  - ${path.basename(item.file)}: ${item.errors.join(' | ')}`);
      }
    }
    await fsp.writeFile(
      path.join(SHOTS_DIR, 'r2-shots.json'),
      `${JSON.stringify(results, null, 2)}\n`,
      'utf8',
    );
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error('[shots] lỗi:', err);
  process.exit(1);
});
