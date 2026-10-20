/**
 * Chụp ảnh trang Tổng kết r2 (`/tong-ket/:year`) vào `shots/dev/F3-*.png`.
 * Chạy: node scripts/shoot-f3.mjs [baseUrl]
 *
 * - `F3-1440.png` / `F3-390.png`: màn mở đầu.
 * - `F3-<w>-<scroll>.png`: các mốc cuộn để soi chương, dải ảnh toàn màn,
 *   danh sách nơi đến nhiều nhất và chặn cuối trang.
 *
 * Cần một vite/server đang chạy (mặc định http://127.0.0.1:5173).
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/+$/, '');
const OUT = 'D:/projects/hanh-trinh/shots/dev';
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function chromePath() {
  for (const p of CHROME) if (existsSync(p)) return p;
  throw new Error('Không tìm thấy Chrome/Edge');
}

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

async function open(width, height) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`);
  });
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/tong-ket/2026`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2000);
  return { page, errors };
}

/** Báo cáo trạng thái trang: chương nào là dải toàn màn, phần nào còn ẩn. */
async function inspect(page) {
  return page.evaluate(() => {
    const doc = document;
    const root = doc.querySelector('.chapters');
    const sections = [...doc.querySelectorAll('.ch, .band')].map((el) => ({
      id: el.id,
      kind: el.classList.contains('band') ? 'band' : 'ch',
      title: el.querySelector('h2')?.textContent?.trim() ?? '',
      top: Math.round(el.getBoundingClientRect().top + window.scrollY),
      height: Math.round(el.getBoundingClientRect().height),
    }));
    const hidden = [...doc.querySelectorAll('.rv')].filter(
      (el) => !el.classList.contains('in'),
    ).length;
    return {
      sections,
      totalRv: doc.querySelectorAll('.rv').length,
      hiddenRv: hidden,
      topPlaces: doc.querySelectorAll('.tk-place').length,
      rail: doc.querySelectorAll('.rail a').length,
      bandId: sections.find((s) => s.kind === 'band')?.id ?? null,
      docHeight: doc.documentElement.scrollHeight,
      overflow: doc.documentElement.scrollWidth - doc.documentElement.clientWidth,
      bodyState: doc.body.dataset.state ?? null,
      rootFound: Boolean(root),
    };
  });
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`→ ${name}.png`);
}

async function scrollTo(page, top) {
  await page.evaluate((y) => window.scrollTo(0, y), top);
  await wait(2000);
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const { page, errors } = await open(width, height);
  const info = await inspect(page);
  console.log(`\n=== ${width}x${height} ===`);
  console.log(JSON.stringify(info, null, 2));
  await shot(page, `F3-${width}`);

  // Các mốc cuộn: đầu chương, dải ảnh toàn màn, nơi đến nhiều nhất, chặn cuối.
  const marks = info.sections
    .map((s) => Math.max(0, s.top - 60))
    .filter((top, i, arr) => arr.indexOf(top) === i);
  for (const top of marks) {
    await scrollTo(page, top);
    await shot(page, `F3-${width}-${top}`);
  }

  await scrollTo(page, Math.max(0, info.docHeight - height));
  await shot(page, `F3-${width}-${Math.max(0, info.docHeight - height)}`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(
    `[${width}] tràn ngang ${overflow}px · ${errors.length ? `lỗi: ${errors.join(' | ')}` : 'không lỗi console'}`,
  );
  await page.close();
}

/* ---------- Hộp thoại dải ảnh ở chặn cuối trang ---------- */
{
  const { page, errors } = await open(1440, 900);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(1500);
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Ghép dải ảnh kỷ niệm'))
      ?.click();
  });
  await wait(900);
  const strip = await page.evaluate(() => ({
    open: document.querySelector('.dialog-bg')?.classList.contains('on') ?? false,
    photos: document.querySelectorAll('.strip4 img').length,
  }));
  console.log(`\nHộp thoại dải ảnh: ${JSON.stringify(strip)}`);
  await shot(page, 'F3-1440-dai-anh');
  console.log(errors.length ? `lỗi console: ${errors.join(' | ')}` : 'không lỗi console');
  await page.close();
}

/* ---------- Các route còn lại của hợp đồng ---------- */
for (const [slug, path] of [
  ['ban-do', '/ban-do'],
  ['dong-thoi-gian', '/dong-thoi-gian'],
  ['tai-anh', '/tai-anh'],
]) {
  const { page, errors } = await open(1440, 900);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2000);
  const info = await page.evaluate(() => ({
    title: document.querySelector('main h1, main h2')?.textContent?.trim() ?? '',
    state: document.body.dataset.state ?? null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log(`${path} → ${JSON.stringify(info)}${errors.length ? ` · lỗi: ${errors.join(' | ')}` : ''}`);
  await page.close();
}

await browser.close();
