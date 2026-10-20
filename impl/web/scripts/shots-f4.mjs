/**
 * Chụp ảnh trang bản đồ (F4) ở 1440x900 và 390x844 (và trạng thái thẻ ảnh).
 * Chạy: node scripts/shots-f4.mjs   (cần dev server: VITE_MOCK=1 npm run dev -- --port 5199)
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const OUT = process.env.SHOTS_DIR ?? 'D:/projects/hanh-trinh/shots/dev';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) if (existsSync(candidate)) return candidate;
  throw new Error('Không tìm thấy Chrome/Edge');
}

async function shoot(browser, { name, width, height, before, wait = 4200 }) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/ban-do`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(wait);
  if (before) await before(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
  console.log(`✓ ${name}.png (${width}x${height})${errors.length ? ` — lỗi console: ${errors.length}` : ''}`);
  for (const error of errors.slice(0, 8)) console.log(`    ! ${error}`);
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});
await mkdir(OUT, { recursive: true });

await shoot(browser, { name: 'F4-1440', width: 1440, height: 900 });
await shoot(browser, { name: 'F4-390', width: 390, height: 844 });
await shoot(browser, {
  name: 'F4-1440-the-anh',
  width: 1440,
  height: 900,
  before: async (page) => {
    await page.waitForSelector('.places button', { timeout: 20000 });
    await page.click('.places button');
    await sleep(2200);
  },
});
await shoot(browser, {
  name: 'F4-390-the-anh',
  width: 390,
  height: 844,
  before: async (page) => {
    await page.waitForSelector('.grab', { timeout: 20000 });
    await page.click('.grab');
    await sleep(700);
  },
});

await browser.close();
