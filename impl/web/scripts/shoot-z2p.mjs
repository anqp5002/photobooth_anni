/**
 * Chụp ảnh kiểm tra Z2P (pane cmd w1:pP) vào `shots/dev/Z2P-*.png`.
 * Chạy: node scripts/shoot-z2p.mjs [baseUrl]
 *
 * - `Z2P-1440.png` / `Z2P-390.png`: trang /dang-nhap (chưa đăng nhập) — header
 *   chỉ còn logo, không menu / nút tải lên / avatar.
 * - `Z2P-tim-kiem-390.png`: thanh thông báo dài ở khổ 390 — phải cắt bằng dấu …
 *   chứ không cắt cụt hai đầu.
 * Cần vite/server đang chạy (mặc định http://127.0.0.1:5173).
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
const chromePath = () => {
  for (const p of CHROME) if (existsSync(p)) return p;
  throw new Error('Không tìm thấy Chrome/Edge');
};

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

async function shoot(name, path, width, height) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2200);
  const info = await page.evaluate(() => {
    const ann = document.querySelector('.ann');
    const annText = document.querySelector('.ann-t');
    const header = document.querySelector('.hd');
    return {
      ann: ann?.textContent?.trim() ?? null,
      annClipped:
        ann && annText ? annText.scrollWidth > annText.clientWidth + 1 : null,
      nav: document.querySelectorAll('.hd-l a').length,
      burger: document.querySelectorAll('.hd .burger').length,
      hdRight: document.querySelectorAll('.hd-r').length,
      brand: document.querySelector('.brand b')?.textContent ?? null,
      sub: document.querySelector('.brand small')?.textContent ?? null,
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`→ ${name}.png  ${JSON.stringify(info)}${errors.length ? ` · lỗi: ${errors.join(' | ')}` : ''}`);
  await page.close();
}

await shoot('Z2P-1440', '/dang-nhap', 1440, 900);
await shoot('Z2P-390', '/dang-nhap', 390, 844);
await shoot('Z2P-tim-kiem-390', '/tim-kiem?q=anh%20sinh%20nhat%20Su%20nam%20nay', 390, 844);
await shoot('Z2P-tim-kiem-1440', '/tim-kiem?q=anh%20sinh%20nhat%20Su%20nam%20nay', 1440, 900);

/* ---------- Duyệt các route: header + tràn ngang + lỗi console ---------- */
for (const path of [
  '/',
  '/tong-ket/2026',
  '/muc/he-da-lat',
  '/ban-do',
  '/dong-thoi-gian',
  '/tai-anh',
  '/photobooth?muc=he-da-lat',
]) {
  await shoot(`Z2P-quet${path.replace(/[^a-z0-9]+/gi, '-')}`, path, 390, 844);
}

/* ---------- Drawer điện thoại vẫn mở được khi đã đăng nhập ---------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2200);
  await page.click('.burger');
  await wait(800);
  const drawer = await page.evaluate(() => {
    const el = document.querySelector('.drawer');
    return {
      open: el?.classList.contains('on') ?? false,
      links: el?.querySelectorAll('li a, li button').length ?? 0,
    };
  });
  console.log(`drawer ở 390: ${JSON.stringify(drawer)}`);
  await page.screenshot({ path: `${OUT}/Z2P-drawer-390.png` });
  console.log('→ Z2P-drawer-390.png');
  await page.close();
}

await browser.close();
