/**
 * Chụp ảnh kiểm tra photobooth bằng Chromium + camera giả.
 * Chạy: node src/photobooth/dev/shoot.mjs [--url http://localhost:5199] [--out ../../../shots]
 * Không thuộc app; chỉ công cụ kiểm tra của module photobooth.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { findChrome } from './browser.mjs';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}

const baseUrl = arg('url', 'http://localhost:5199');
const outDir = path.resolve(arg('out', path.join(process.cwd(), '..', '..', 'shots')));
const chromePath = findChrome();
if (!chromePath) {
  console.error('Không tìm thấy Chromium/Chrome. Đặt CHROME_PATH hoặc cài Playwright.');
  process.exit(1);
}

const CHROME_ARGS = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--no-sandbox',
  '--disable-dev-shm-usage',
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shot(page, name, label) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  console.log(`[shot] ${label} -> ${file}`);
}

async function clickText(page, text) {
  await page.evaluate((needle) => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(needle))?.click();
  }, text);
}

async function shootSession(page, count) {
  await page.evaluate((n) => {
    document.querySelector('.htpb-field--timer .htpb-seg button[data-value="0"]')?.click();
    document.querySelector(`.htpb-field--count .htpb-seg button[data-value="${n}"]`)?.click();
    document.querySelector('.htpb-shoot')?.click();
  }, count);
  await page.waitForFunction(
    (n) => {
      const next = document.querySelector('.htpb-next');
      return document.querySelectorAll('.htpb-camera .htpb-thumbs canvas').length === n && next && !next.disabled;
    },
    { timeout: 40000 },
    count,
  );
}

async function captureStrip(page, name) {
  // Lấy thẳng canvas của dải (không phụ thuộc cuộn) — đúng những gì người dùng thấy trong dải.
  const dataUrl = await page.evaluate(() => document.querySelector('.htpb-strip').toDataURL('image/png'));
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(path.join(outDir, name), buffer);
  console.log(`[shot] ${name} (${buffer.length} bytes)`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: CHROME_ARGS,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    protocolTimeout: 60000,
  });

  const page = await browser.newPage();
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));

  // ---------- Desktop: màn vào ----------
  await page.goto(`${baseUrl}/photobooth-dev.html`, { waitUntil: 'networkidle0' });
  await wait(700);
  await shot(page, 'photobooth-01-entry-1440.png', 'màn vào 1440x900');

  // ---------- Màn camera ----------
  await clickText(page, 'Mở camera');
  await page.waitForSelector('.htpb-camera:not([hidden])', { timeout: 20000 });
  await wait(1200);
  await shot(page, 'photobooth-02-camera-1440.png', 'màn camera 1440x900');

  // ---------- Đang chụp (đếm ngược + khung xem trước) ----------
  await page.evaluate(() => {
    document.querySelector('.htpb-field--timer .htpb-seg button[data-value="3"]')?.click();
    document.querySelector('.htpb-field--count .htpb-seg button[data-value="4"]')?.click();
    document.querySelector('.htpb-shoot')?.click();
  });
  await page.waitForFunction(() => document.querySelector('.htpb-countdown.is-on'), { timeout: 8000 });
  await wait(120);
  await shot(page, 'photobooth-03-countdown-1440.png', 'đếm ngược 1440x900');
  await page.waitForFunction(() => document.querySelector('.htpb-preview.is-on'), { timeout: 12000 });
  await shot(page, 'photobooth-04-preview-1440.png', 'khung xem trước sau khi chụp');
  await page.evaluate(() => document.querySelector('.htpb-stop')?.click());
  await wait(500);

  // ---------- Chụp đủ 4 ảnh ----------
  await shootSession(page, 4);
  await wait(400);
  await shot(page, 'photobooth-05-camera-4shots-1440.png', 'camera đã chụp 4 ảnh 1440x900');

  // ---------- Màn chỉnh sửa ----------
  await page.evaluate(() => document.querySelector('.htpb-next')?.click());
  await page.waitForSelector('.htpb-editor:not([hidden])', { timeout: 10000 });
  await wait(600);
  await shot(page, 'photobooth-06-editor-1440.png', 'màn chỉnh sửa 1440x900');

  // ---------- Chỉnh tiêu đề + màu ----------
  await page.evaluate(() => {
    const input = document.querySelector('#htpb-strip-title');
    if (input instanceof HTMLInputElement) {
      input.value = 'hello trip';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('.htpb-swatch[data-color="#FFD9E1"]')?.click();
  });
  await wait(500);
  await shot(page, 'photobooth-07-editor-title-1440.png', 'chỉnh sửa có tiêu đề + màu 1440x900');

  // ---------- Hộp xuất ----------
  await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click(),
  );
  await page.waitForSelector('.htpb-dialog', { timeout: 10000 });
  await wait(600);
  await shot(page, 'photobooth-08-export-1440.png', 'hộp xuất 1440x900');
  await page.evaluate(() => document.querySelector('.htpb-dialog .htpb-close-dialog')?.click());
  await wait(300);

  // ---------- Ba khung dựng sẵn ----------
  for (const layout of ['ticket', 'postcard']) {
    await page.evaluate((id) => document.querySelector(`.htpb-layout[data-layout="${id}"]`)?.click(), layout);
    await wait(500);
    await captureStrip(page, `photobooth-09-frame-${layout}-1440.png`);
  }

  // ---------- Khung 5 ô: chụp thêm 1 ảnh ----------
  await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.includes('Quay lại camera'))?.click(),
  );
  await page.waitForSelector('.htpb-camera:not([hidden])', { timeout: 10000 });
  await shootSession(page, 5);
  await page.evaluate(() => document.querySelector('.htpb-next')?.click());
  await page.waitForSelector('.htpb-editor:not([hidden])', { timeout: 10000 });
  await wait(400);
  await page.evaluate(() => document.querySelector('.htpb-layout[data-layout="film"]')?.click());
  await wait(500);
  await captureStrip(page, 'photobooth-10-frame-film-1440.png');

  // Tắt camera trên tab desktop trước khi mở tab điện thoại (camera giả dùng chung).
  await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.includes('Quay lại camera'))?.click(),
  );
  await page.waitForSelector('.htpb-camera:not([hidden])', { timeout: 10000 });
  await page.evaluate(() => document.querySelector('.htpb-close')?.click());
  await wait(500);

  // ---------- Điện thoại 390x844 ----------
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await mobile.goto(`${baseUrl}/photobooth-dev.html`, { waitUntil: 'networkidle0' });
  await wait(700);
  await shot(mobile, 'photobooth-11-entry-390.png', 'màn vào 390x844');
  console.log(`[check] 390 scrollWidth = ${await mobile.evaluate(() => document.documentElement.scrollWidth)}`);

  await clickText(mobile, 'Mở camera');
  await mobile.waitForSelector('.htpb-camera:not([hidden])', { timeout: 20000 });
  await wait(1000);
  await shot(mobile, 'photobooth-12-camera-390.png', 'màn camera 390x844');

  await shootSession(mobile, 4);
  await mobile.evaluate(() => document.querySelector('.htpb-next')?.click());
  await mobile.waitForSelector('.htpb-editor:not([hidden])', { timeout: 10000 });
  await wait(800);
  await mobile.screenshot({ path: path.join(outDir, 'photobooth-13-editor-390.png'), fullPage: true });
  console.log('[shot] màn chỉnh sửa 390x844 (full page)');
  console.log(`[check] 390 editor scrollWidth = ${await mobile.evaluate(() => document.documentElement.scrollWidth)}`);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
