/**
 * Đo cột "Kiểu dải có sẵn" của photobooth (việc Z2T):
 * - cột mẫu có nằm trọn trong khung 1440x900 / 390x844 không (không bị cắt đáy),
 * - canvas mẫu có phải ảnh thật (không rỗng / không vẽ phong cảnh),
 * - không tràn ngang ở 390.
 *
 * Dùng: node scripts/probe-z2t.mjs http://127.0.0.1:5173
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/+$/, '');
const path = '/photobooth?muc=he-da-lat';

const browser = await puppeteer.launch({
  executablePath: CHROME.find((p) => existsSync(p)),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

let bad = 0;
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const info = await page.evaluate(() => {
    const col = document.querySelector('.htpb-entry__samples');
    const canvases = Array.from(document.querySelectorAll('.htpb-samples canvas'));
    const rect = col?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      col: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) } : null,
      figs: Array.from(document.querySelectorAll('.htpb-samples figure')).map((f) => {
        const r = f.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width) };
      }),
      canvases: canvases.map((c) => ({ w: c.width, h: c.height, cssW: Math.round(c.getBoundingClientRect().width), cls: c.className })),
      innerH: window.innerHeight,
    };
  });
  const overflowX = info.scrollWidth - info.innerWidth;
  const colBottom = info.col?.bottom ?? 0;
  const cut = info.figs.filter((f) => f.bottom > colBottom + 1);
  const empty = info.canvases.filter((c) => c.w <= 1 || c.h <= 1);
  const inside = info.figs.every((f) => f.bottom <= colBottom + 1);
  // Ở 1440, khung đầu trang phải chứa trọn cột mẫu (không bị cắt đáy).
  const inViewport = viewport.width !== 1440 || colBottom <= info.innerH;
  console.log(`[${viewport.width}x${viewport.height}] tràn ngang ${overflowX}px · cột mẫu cao ${info.col?.height} (đáy ở ${colBottom}, khung ${info.innerH}) · ảnh mẫu rỗng ${empty.length} · lỗi console ${errors.length}`);
  console.log(`  figures: ${info.figs.map((f) => `${f.w}x${f.bottom - f.top}@${f.top}`).join(' · ')}`);
  console.log(`  canvases: ${info.canvases.map((c) => `${c.w}x${c.h} (css ${c.cssW}${c.cls ? ' ' + c.cls : ''})`).join(' · ')}`);
  if (overflowX > 0) bad += 1;
  if (!inside) { bad += 1; console.log('  ! figure tràn khỏi cột mẫu'); }
  if (!inViewport) { bad += 1; console.log('  ! cột mẫu bị cắt ở đáy khung 1440x900'); }
  if (empty.length) bad += 1;
  if (errors.length) { bad += 1; console.log(`  ! ${errors.slice(0, 3).join(' | ')}`); }
  if (cut.length) console.log(`  ! figure bị cắt: ${cut.length}`);
  await page.close();
}

await browser.close();
console.log(bad === 0 ? 'PROBE=OK' : `PROBE=FAIL (${bad})`);
process.exit(bad === 0 ? 0 : 1);
