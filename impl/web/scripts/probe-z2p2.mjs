/**
 * Đo mức tràn dấu tiếng Việt của thanh thông báo (`.ann`).
 * Chạy: node scripts/probe-z2p2.mjs [baseUrl]
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
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(`${BASE}/dong-thoi-gian`, { waitUntil: 'networkidle2', timeout: 60000 });
await wait(2500);

const info = await page.evaluate(async () => {
  await document.fonts.ready;
  const ann = document.querySelector('.ann');
  const span = document.querySelector('.ann-t');
  const cs = span ? getComputedStyle(span) : null;
  const annCs = ann ? getComputedStyle(ann) : null;

  // Bề rộng và chiều cao thật của nét chữ (ink) bằng canvas.
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = annCs ? annCs.font : '500 11px Inter';
  const text = span?.textContent?.trim() ?? '';
  const m = ctx.measureText(text);
  const glyphs = ['Á', 'Ả', 'Ấ', 'Ớ', 'Ừ', 'Ộ', 'Đ', 'É', 'Ó'];
  const perGlyph = glyphs.map((g) => {
    const mm = ctx.measureText(g);
    return { g, ascent: +mm.actualBoundingBoxAscent.toFixed(2), descent: +mm.actualBoundingBoxDescent.toFixed(2) };
  });

  const rect = span?.getBoundingClientRect();
  const annRect = ann?.getBoundingClientRect();
  // Vị trí chữ so với mép trên của khối chứa (để biết dấu có bị cắt không).
  const range = document.createRange();
  range.selectNodeContents(span);
  const textRect = range.getBoundingClientRect();

  // Đường chân chữ và biên nét mực để biết dấu có tràn ra ngoài khối không.
  const lineHeight = parseFloat(cs?.lineHeight ?? '11');
  const fontAscent = m.fontBoundingBoxAscent;
  const fontDescent = m.fontBoundingBoxDescent;
  const halfLeading = (lineHeight - (fontAscent + fontDescent)) / 2;
  const lineBoxTop = textRect.top;
  const baseline = lineBoxTop + halfLeading + fontAscent;
  const inkTop = baseline - m.actualBoundingBoxAscent;
  const inkBottom = baseline + m.actualBoundingBoxDescent;

  return {
    text,
    annFont: annCs?.font,
    annHeight: annRect?.height,
    spanRect: { top: rect?.top, height: rect?.height },
    spanLineHeight: cs?.lineHeight,
    spanPaddingBlock: `${cs?.paddingTop} ${cs?.paddingBottom}`,
    lineBoxTopInBar: annRect ? +(lineBoxTop - annRect.top).toFixed(2) : null,
    inkTopInSpan: rect ? +(inkTop - rect.top).toFixed(2) : null,
    inkBottomInSpan: rect ? +(inkBottom - rect.top).toFixed(2) : null,
    clipped:
      rect !== undefined && (inkTop < rect.top || inkBottom > (rect?.top ?? 0) + (rect?.height ?? 0)),
    inkAscent: +m.actualBoundingBoxAscent.toFixed(2),
    inkDescent: +m.actualBoundingBoxDescent.toFixed(2),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

console.log(JSON.stringify(info, null, 2));

// Cắt riêng vùng thanh thông báo để soi dấu.
const ann = await page.$('.ann');
if (ann) {
  await ann.screenshot({ path: 'D:/projects/hanh-trinh/shots/dev/Z2P2-ann-1440.png' });
  console.log('→ shots/dev/Z2P2-ann-1440.png');
}

await browser.close();
