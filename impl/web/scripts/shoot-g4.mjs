/**
 * Chụp ảnh trang photobooth r2 (G4) vào `shots/dev/<id>-<rộng>.png`.
 * Chạy: node scripts/shoot-g4.mjs [baseUrl]
 *
 * - Màn vào: hero ảnh mục + khung photobooth.
 * - Màn chỉnh sửa: bấm "Lấy ảnh từ mục" (ảnh của mục Hè Đà Lạt) → có dải thật.
 * - Hộp xuất: bấm "Xuất" để thấy dải + nút "Lưu vào mục".
 * Cần server dev đang chạy (mặc định http://localhost:5199).
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://localhost:5199';
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
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/photobooth?muc=he-da-lat`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(1800);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  return { page, errors, overflow };
}

async function shot(page, name, label) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`→ ${name}.png — ${label}`);
}

async function clickText(page, text) {
  await page.evaluate((needle) => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(needle))?.click();
  }, text);
}

/* ---------- 1440x900 ---------- */
{
  const { page, errors, overflow } = await open(1440, 900);
  await shot(page, 'g4-photobooth-1440', 'màn vào 1440x900');

  await clickText(page, 'Lấy ảnh từ mục');
  await page.waitForSelector('.htpb-editor:not([hidden])', { timeout: 30000 });
  await wait(1400);
  await shot(page, 'g4-photobooth-1440-chinh-sua', 'màn chỉnh sửa có dải 1440x900');

  await page.evaluate(() => {
    const input = document.querySelector('#htpb-strip-title');
    if (input instanceof HTMLInputElement) {
      input.value = 'hè đà lạt';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('.htpb-layout[data-layout="ticket"]')?.click();
  });
  await wait(900);
  await shot(page, 'g4-photobooth-1440-doi-kieu', 'đổi kiểu dải 1440x900');

  await clickText(page, 'Xuất');
  await page.waitForSelector('.htpb-dialog', { timeout: 10000 });
  await wait(900);
  await shot(page, 'g4-photobooth-1440-xuat', 'hộp xuất + nút lưu vào mục 1440x900');

  console.log(
    `[1440] tràn ngang ${overflow}px · ${errors.length ? `lỗi console: ${errors.join(' | ')}` : 'không lỗi console'}`,
  );
  await page.close();
}

/* ---------- 390x844 ---------- */
{
  const { page, errors, overflow } = await open(390, 844);
  await shot(page, 'g4-photobooth-390', 'màn vào 390x844');

  await clickText(page, 'Lấy ảnh từ mục');
  await page.waitForSelector('.htpb-editor:not([hidden])', { timeout: 30000 });
  await wait(1400);
  await page.evaluate(() => window.scrollTo(0, 520));
  await wait(700);
  await shot(page, 'g4-photobooth-390-chinh-sua', 'màn chỉnh sửa có dải 390x844');

  const over2 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(
    `[390] tràn ngang ${overflow}px (màn vào) / ${over2}px (chỉnh sửa) · ${
      errors.length ? `lỗi console: ${errors.join(' | ')}` : 'không lỗi console'
    }`,
  );
  await page.close();
}

await browser.close();
