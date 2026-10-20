/**
 * T6 — kiểm B-05 trên bản build thật + server thật.
 * Chạy: node src/photobooth/dev/check-t6.mjs [--base http://localhost:8811] [--trip 1]
 * Cần server đã seed và `impl/web/dist` đã build.
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
const EMAIL = 'minh@example.com';
const PASSWORD = 'hanhtrinh123';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME_ARGS = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--no-sandbox',
  '--disable-dev-shm-usage',
];

async function launch() {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: CHROME_ARGS,
    defaultViewport: { width: 1440, height: 900 },
    protocolTimeout: 90000,
  });
}

/** Đăng nhập bằng chính form của app (đường người dùng thật). */
async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', EMAIL);
  await page.type('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 });
  await wait(800);
  const me = await page.evaluate(async () => {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    return res.ok ? res.json() : null;
  });
  return me;
}

async function openPhotoboothFromTrip(page) {
  // Đi qua nút thật trên trang chuyến, không gõ URL trực tiếp.
  const trip = await page.evaluate(async () => {
    const res = await fetch('/api/users/minh', { credentials: 'same-origin' });
    const data = await res.json();
    return data.trips?.[0] ?? null;
  });
  if (!trip) throw new Error('Không có chuyến nào để mở');
  await page.goto(`${BASE}/minh/${trip.id}-${trip.slug}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('button', { timeout: 15000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => /mở photobooth/i.test(b.textContent ?? ''))?.click();
  });
  await page.waitForFunction(() => location.pathname === '/photobooth', { timeout: 10000 });
  return page.url();
}

async function countStepPhotos(page, stepId) {
  return page.evaluate(
    async (id) => {
      const res = await fetch(`/api/trips/${id.trip}?limit=100`, { credentials: 'same-origin' });
      const data = await res.json();
      const step = data.steps.find((s) => String(s.id) === String(id.step));
      return step ? step.media.filter((m) => m.type === 'photo').length : -1;
    },
    { trip: TRIP_ID, step: stepId },
  );
}

async function main() {
  if (!TRIP_ID) throw new Error('Thiếu --trip <id>');
  const browser = await launch();

  // ---------------- Chủ chuyến ----------------
  const ownerPage = await browser.newPage();
  ownerPage.on('pageerror', (error) => console.log(`[pageerror owner] ${error.message}`));
  const me = await login(ownerPage);
  check('đăng nhập minh bằng form /login', me?.username === 'minh', JSON.stringify(me?.username));

  const url = await openPhotoboothFromTrip(ownerPage);
  const parsed = new URL(url);
  check('nút "mở photobooth" → /photobooth?trip=…&step=…', parsed.pathname === '/photobooth' && parsed.searchParams.get('trip') === TRIP_ID, url);
  const stepParam = parsed.searchParams.get('step');
  check('URL có ?step=<chặng đang xem>', Boolean(stepParam), String(stepParam));

  await ownerPage.waitForSelector('.htpb-entry:not([hidden])', { timeout: 20000 });
  await wait(500);

  const entry = await ownerPage.evaluate(() => ({
    title: document.querySelector('#htpb-entry-title')?.textContent ?? '',
    sourceBtn: (() => {
      const b = [...document.querySelectorAll('.htpb-entry__actions button')].find((x) =>
        /ảnh của chuyến/i.test(x.textContent ?? ''),
      );
      return b ? { exists: true, hidden: b.hidden } : { exists: false, hidden: true };
    })(),
    stripTitle: document.querySelector('#htpb-strip-title')?.value ?? '',
  }));
  check('màn vào nạp trong app thật', Boolean(entry.title), entry.title);
  check('có nút "dùng ảnh của chuyến" (nguồn ảnh chuyến)', entry.sourceBtn.exists && !entry.sourceBtn.hidden, JSON.stringify(entry.sourceBtn));

  // Nguồn ảnh: bấm nút, phải sang màn chỉnh sửa với đúng số ảnh của chuyến.
  const expected = await ownerPage.evaluate(async (id) => {
    const res = await fetch(`/api/trips/${id}?limit=100`, { credentials: 'same-origin' });
    const data = await res.json();
    return data.steps.reduce(
      (n, s) => n + s.media.filter((m) => m.type === 'photo' && !m.flags.hidden).length,
      0,
    );
  }, TRIP_ID);
  await ownerPage.evaluate(() => {
    [...document.querySelectorAll('.htpb-entry__actions button')].find((b) => /ảnh của chuyến/i.test(b.textContent ?? ''))?.click();
  });
  await ownerPage.waitForSelector('.htpb-editor:not([hidden])', { timeout: 30000 });
  await wait(800);
  const sourceState = await ownerPage.evaluate(() => ({
    count: document.querySelectorAll('.htpb-editor-thumbs canvas').length,
    label: document.querySelector('.htpb-editor .htpb-session__count')?.textContent ?? '',
    title: document.querySelector('#htpb-strip-title')?.value ?? '',
  }));
  check(
    `nguồn ảnh chuyến = ${expected} ảnh, tiêu đề = tên chuyến`,
    sourceState.count === expected && sourceState.label === `${expected} / ${expected}` && sourceState.title.length > 0,
    JSON.stringify({ ...sourceState, expected }),
  );

  const before = await countStepPhotos(ownerPage, stepParam);
  await ownerPage.evaluate(() =>
    [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click(),
  );
  await ownerPage.waitForSelector('.htpb-dialog', { timeout: 15000 });
  const dialog = await ownerPage.evaluate(() => {
    const button = [...document.querySelectorAll('.htpb-dialog button')].find((b) =>
      /lưu vào chuyến/i.test(b.textContent ?? ''),
    );
    return { exists: Boolean(button), hidden: button?.hidden, display: button ? getComputedStyle(button).display : 'none' };
  });
  check('chủ chuyến THẤY nút "lưu vào chuyến"', dialog.exists && !dialog.hidden && dialog.display !== 'none', JSON.stringify(dialog));

  await ownerPage.evaluate(() =>
    [...document.querySelectorAll('.htpb-dialog button')].find((b) => /lưu vào chuyến/i.test(b.textContent ?? ''))?.click(),
  );
  await ownerPage.waitForFunction(
    () => /Đã lưu dải ảnh vào chuyến/.test(document.querySelector('.htpb-dialog__status')?.textContent ?? ''),
    { timeout: 60000 },
  );
  const status = await ownerPage.evaluate(() => document.querySelector('.htpb-dialog__status')?.textContent ?? '');
  check('bấm lưu → báo "Đã lưu dải ảnh vào chuyến."', /Đã lưu dải ảnh vào chuyến/.test(status), status);

  await ownerPage.waitForFunction(() => !document.querySelector('.htpb-dialog'), { timeout: 8000 });
  const after = await countStepPhotos(ownerPage, stepParam);
  check('dải xuất hiện trong chặng (media mới type photo)', after === before + 1, `${before} → ${after}`);

  // Quay lại trang chuyến: dữ liệu tải lại (no-store), dải mới hiện trong thẻ chặng.
  await ownerPage.goto(`${BASE}/minh/${TRIP_ID}-xuyen-viet`, { waitUntil: 'networkidle0' });
  await wait(1500);
  const shown = await ownerPage.evaluate(
    async (id) => {
      const res = await fetch(`/api/trips/${id.trip}?limit=100`, { credentials: 'same-origin' });
      const data = await res.json();
      const step = data.steps.find((s) => String(s.id) === String(id.step));
      return { count: step ? step.media.filter((m) => m.type === 'photo').length : -1 };
    },
    { trip: TRIP_ID, step: stepParam },
  );
  const imgCount = await ownerPage.evaluate(() => document.querySelectorAll('img').length);
  check('trang chuyến tải lại thấy dải mới', shown.count === after && imgCount > 0, JSON.stringify({ ...shown, imgCount }));

  // ---------------- Khách (không đăng nhập) ----------------
  // Dùng cửa sổ ẩn danh riêng: tab thường dùng chung cookie với tab chủ chuyến.
  const guestContext = await browser.createBrowserContext();
  const guestPage = await guestContext.newPage();
  guestPage.on('pageerror', (error) => console.log(`[pageerror guest] ${error.message}`));
  const guestUrl = `${BASE}/photobooth?trip=${encodeURIComponent(TRIP_ID)}&step=${encodeURIComponent(stepParam ?? '')}&title=Xuyen%20Viet`;
  await guestPage.goto(guestUrl, { waitUntil: 'networkidle0' });
  await guestPage.waitForSelector('.htpb-entry:not([hidden])', { timeout: 20000 });
  await wait(600);
  const guestMe = await guestPage.evaluate(async () => {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    return res.status;
  });
  check('khách: /api/me trả 401', guestMe === 401, String(guestMe));

  await guestPage.evaluate(() => {
    [...document.querySelectorAll('.htpb-entry__actions button')].find((b) => /ảnh của chuyến/i.test(b.textContent ?? ''))?.click();
  });
  await guestPage.waitForSelector('.htpb-editor:not([hidden])', { timeout: 30000 });
  await wait(600);
  await guestPage.evaluate(() =>
    [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click(),
  );
  await guestPage.waitForSelector('.htpb-dialog', { timeout: 15000 });
  const guestDialog = await guestPage.evaluate(() => {
    const button = [...document.querySelectorAll('.htpb-dialog button')].find((b) =>
      /lưu vào chuyến/i.test(b.textContent ?? ''),
    );
    return { exists: Boolean(button), hidden: button?.hidden, display: button ? getComputedStyle(button).display : 'none' };
  });
  check(
    'khách KHÔNG có nút "lưu vào chuyến"',
    !guestDialog.exists || guestDialog.hidden === true || guestDialog.display === 'none',
    JSON.stringify(guestDialog),
  );
  const guestTried = await guestPage.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const res = await fetch('/api/steps/999999/strips', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      credentials: 'same-origin',
      body: blob,
    });
    return res.status;
  });
  check('khách gọi thẳng API strips → 401 (máy chủ vẫn chặn)', guestTried === 401, String(guestTried));

  await guestContext.close();
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kiểm tra đạt`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
