/**
 * Chụp ảnh trang mục `/muc/:id` (G1) vào `shots/dev/<id>-<rộng>.png`.
 * Chạy: node scripts/shoot-g1.mjs [baseUrl]
 * Cần server đang chạy với VITE_MOCK=1 (xem muc-dev.html).
 */
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const OUT = 'D:/projects/hanh-trinh/shots/dev';
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function chromePath() {
  const { existsSync } = await import('node:fs');
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  throw new Error('Không tìm thấy Chrome/Edge');
}

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: await chromePath(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

async function shoot(name, width, height, url, scrollY = 0, prepare) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(1600);
  if (prepare) {
    await prepare(page);
    await wait(1400);
  }
  if (scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await wait(1200);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  console.log(
    `→ ${name}.png (${width}x${height})${overflow > 1 ? ` ⚠ tràn ngang ${overflow}px` : ''}${
      errors.length ? ` ⚠ ${errors.length} lỗi console: ${errors.slice(0, 3).join(' | ')}` : ''
    }`,
  );
  await page.close();
  return { overflow, errors };
}

const url = (id, extra = '') => `${BASE}/muc-dev.html?id=${id}${extra}`;

await shoot('g1-muc-1440', 1440, 900, url('he-da-lat'));
await shoot('g1-muc-1440-cuon', 1440, 900, url('he-da-lat'), 900);
await shoot('g1-muc-1440-ngay', 1440, 900, url('he-da-lat'), 2100);
await shoot('g1-muc-1440-loading', 1440, 900, url('he-da-lat', '&state=loading'));
await shoot('g1-muc-1440-empty', 1440, 900, url('he-da-lat', '&state=empty'), 1050);
await shoot('g1-muc-1440-error', 1440, 900, url('he-da-lat', '&state=error'));
await shoot('g1-muc-390', 390, 844, url('he-da-lat'));
await shoot('g1-muc-390-1000', 390, 844, url('he-da-lat'), 1000);
await shoot('g1-muc-390-2000', 390, 844, url('he-da-lat'), 2000);
await shoot('g1-muc-1440-xem-anh', 1440, 900, url('he-da-lat'), 2100, async (page) => {
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.muc-page .photo-btn')];
    buttons[buttons.length - 1]?.click();
  });
});

await browser.close();
