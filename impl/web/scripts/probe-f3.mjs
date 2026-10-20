/**
 * Kiểm tra hộp thoại dải ảnh ở chặn cuối trang Tổng kết: nút bấm có bấm được không.
 * Chạy: node scripts/probe-f3.mjs [baseUrl]
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/+$/, '');
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const chromePath = () => {
  for (const p of CHROME) if (existsSync(p)) return p;
  throw new Error('Không tìm thấy Chrome/Edge');
};

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(`${BASE}/tong-ket/2026`, { waitUntil: 'networkidle2', timeout: 60000 });
await wait(2000);
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await wait(1200);
await page.evaluate(() => {
  [...document.querySelectorAll('button')]
    .find((b) => b.textContent?.includes('Ghép dải ảnh kỷ niệm'))
    ?.click();
});
await wait(800);

const info = await page.evaluate(() => {
  const dialog = document.querySelector('.dialog');
  const cta = dialog?.querySelector('.cta');
  const rect = cta?.getBoundingClientRect();
  return {
    dialogHeight: Math.round(dialog?.getBoundingClientRect().height ?? 0),
    dialogScroll: dialog?.scrollHeight ?? 0,
    dialogClient: dialog?.clientHeight ?? 0,
    ctaBottom: rect ? Math.round(rect.bottom) : null,
    ctaVisible: rect ? rect.bottom <= window.innerHeight && rect.top >= 0 : false,
    viewport: window.innerHeight,
  };
});
console.log(JSON.stringify(info, null, 2));

// Cuộn trong hộp thoại rồi bấm nút "Ghép dải này" để chắc chắn nút dùng được.
const clicked = await page.evaluate(() => {
  const dialog = document.querySelector('.dialog');
  dialog?.scrollTo(0, dialog.scrollHeight);
  const btn = [...document.querySelectorAll('.dialog button, .dialog a')].find((b) =>
    b.textContent?.includes('Ghép dải này'),
  );
  btn?.click();
  return Boolean(btn);
});
await wait(1200);
const after = await page.evaluate(() => location.pathname);
console.log(`bấm nút: ${clicked} → đường dẫn sau đó: ${after}`);

await browser.close();
