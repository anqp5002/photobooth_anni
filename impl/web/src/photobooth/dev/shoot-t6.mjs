/**
 * T6 — chụp 2 ảnh bắt buộc: photobooth mở từ chuyến (có nguồn ảnh + nút lưu vào chuyến).
 * Chạy: node src/photobooth/dev/shoot-t6.mjs --trip 2 [--base http://localhost:8811]
 */
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { findChrome } from './browser.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const BASE = arg('base', 'http://localhost:8811');
const TRIP_ID = arg('trip', '');
const OUT = path.resolve(arg('out', path.join(process.cwd(), '..', '..', 'shots')));
const EMAIL = 'minh@example.com';
const PASSWORD = 'hanhtrinh123';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', EMAIL);
  await page.type('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 });
  await wait(600);
}

/** Mở photobooth bằng nút thật trên trang chuyến rồi chọn nguồn ảnh của chuyến. */
async function openWithTripSource(page) {
  const trip = await page.evaluate(async () => {
    const res = await fetch('/api/users/minh', { credentials: 'same-origin' });
    const data = await res.json();
    return data.trips?.[0] ?? null;
  });
  if (!trip) throw new Error('Không có chuyến');
  await page.goto(`${BASE}/minh/${trip.id}-${trip.slug}`, { waitUntil: 'networkidle0' });
  await wait(900);
  await page.evaluate(() => {
    const byText = [...document.querySelectorAll('button')].find((b) => /mở photobooth/i.test(b.textContent ?? ''));
    const byLabel = document.querySelector('button[aria-label="Mở photobooth của chuyến"]');
    (byText ?? byLabel)?.click();
  });
  await page.waitForSelector('.htpb-entry:not([hidden])', { timeout: 20000 });
  await wait(700);
  // Màn vào có nguồn ảnh chuyến: ảnh này là ảnh chụp chính (có nút "dùng ảnh của chuyến").
  return page.url();
}

async function main() {
  if (!TRIP_ID) throw new Error('Thiếu --trip <id>');
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
    protocolTimeout: 90000,
  });

  /** Vào photobooth từ chuyến, nạp nguồn ảnh của chuyến, mở hộp xuất (có nút "lưu vào chuyến"). */
  async function openExportFromTrip(page, { shotEntry, shotEditor }) {
    await login(page);
    const url = await openWithTripSource(page);
    console.log('[url]', url);
    if (shotEntry) {
      await page.screenshot({ path: shotEntry });
      console.log('[shot]', path.basename(shotEntry));
    }
    await page.evaluate(() => {
      [...document.querySelectorAll('.htpb-entry__actions button')].find((b) => /ảnh của chuyến/i.test(b.textContent ?? ''))?.click();
    });
    await page.waitForSelector('.htpb-editor:not([hidden])', { timeout: 60000 });
    await wait(900);
    if (shotEditor) {
      await page.screenshot({ path: shotEditor });
      console.log('[shot]', path.basename(shotEditor));
    }
    await page.evaluate(() =>
      [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click(),
    );
    await page.waitForSelector('.htpb-dialog', { timeout: 20000 });
    await wait(900);
    return url;
  }

  // ---------- 1440x900: hộp xuất có dải ghép từ ảnh chuyến + nút "lưu vào chuyến" ----------
  const desktop = await browser.newPage();
  desktop.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
  await openExportFromTrip(desktop, {});
  // Hộp xuất đã mở: chụp cả trang để thấy dải ghép + nút "lưu vào chuyến".
  await desktop.screenshot({ path: path.join(OUT, '1440-photobooth-trip.png') });
  console.log('[shot] 1440-photobooth-trip.png');

  // ---------- 390x844 ----------
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await openExportFromTrip(mobile, {});
  await mobile.screenshot({ path: path.join(OUT, '390-photobooth-trip.png') });
  console.log('[shot] 390-photobooth-trip.png');
  console.log('[check] 390 scrollWidth =', await mobile.evaluate(() => document.documentElement.scrollWidth));
  const saveVisible = await mobile.evaluate(() => {
    const button = [...document.querySelectorAll('.htpb-dialog button')].find((b) =>
      /lưu vào chuyến/i.test(b.textContent ?? ''),
    );
    if (!button) return false;
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(button).display !== 'none';
  });
  console.log('[check] 390 có nút lưu vào chuyến =', saveVisible);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
