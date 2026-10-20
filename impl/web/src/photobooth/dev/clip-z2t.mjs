/**
 * Cắt riêng cột "Kiểu dải có sẵn" để soi ảnh mẫu (việc Z2T).
 * Dùng: node scripts/clip-z2t.mjs http://127.0.0.1:5173
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/+$/, '');

const browser = await puppeteer.launch({
  executablePath: CHROME.find((p) => existsSync(p)),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(`${base}/photobooth?muc=he-da-lat`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
const el = await page.$('.htpb-entry__samples');
await el.screenshot({ path: 'D:/projects/hanh-trinh/shots/dev/Z2T-cot-mau.png' });
console.log('✓ D:/projects/hanh-trinh/shots/dev/Z2T-cot-mau.png');
await browser.close();
