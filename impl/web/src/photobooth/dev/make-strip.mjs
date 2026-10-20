/** Tạo một dải PNG thử (không phụ thuộc server) — dùng khi kiểm tay API strips. */
import { writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { findChrome } from './browser.mjs';

const out = process.argv[2];
if (!out) {
  console.error('Cách dùng: node make-strip.mjs <đường-dẫn.png> [rộng] [cao]');
  process.exit(1);
}
const width = Number(process.argv[3] ?? 520);
const height = Number(process.argv[4] ?? 1820);

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('about:blank');
const dataUrl = await page.evaluate(
  (w, h) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFD9E1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#00293D';
    ctx.font = '700 40px sans-serif';
    ctx.fillText('THỬ DẢI ẢNH', 40, 120);
    return canvas.toDataURL('image/png');
  },
  width,
  height,
);
await browser.close();
const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
await writeFile(out, buffer);
console.log('wrote', out, buffer.length, `${width}x${height}`);
