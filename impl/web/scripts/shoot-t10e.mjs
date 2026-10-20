/**
 * T10e — chụp minh hoạ cho lỗi avatar rỗng + dải tối tên chuyến.
 * Ghi vào shots/extra/ (KHÔNG ghi vào thư mục gốc shots/ — phải giữ đúng 12 ảnh).
 * Dùng: node scripts/shoot-t10e.mjs [baseUrl]
 */
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8822';
const OUT = 'D:/projects/hanh-trinh/shots/extra';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

async function shoot(name, width, height, url) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await wait(2200);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  const info = await page.evaluate(() => ({
    avatarFallback: document.querySelectorAll('.avatar-fallback').length,
    brokenImg: [...document.querySelectorAll('img.avatar')].filter(
      (img) => !img.getAttribute('src') || img.complete === false,
    ).length,
  }));
  console.log(`✓ ${name}.png (${width}x${height}) · avatar-fallback: ${info.avatarFallback} · ảnh vỡ: ${info.brokenImg}`);
  await page.close();
}

await shoot('t10e-1440-profile', 1440, 900, `${BASE}/minh`);
await shoot('t10e-390-profile', 390, 844, `${BASE}/minh`);
await shoot('t10e-390-trip', 390, 844, `${BASE}/minh/1-xuyen-viet`);

await browser.close();
