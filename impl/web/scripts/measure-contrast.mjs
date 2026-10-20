/**
 * T10a — đo tương phản THẬT cho chữ nằm trên ảnh/nền mờ + quét chữ < 12px + vùng chạm.
 *
 * Cách đo (giống T8): chụp vùng chữ 2 lần — lần 1 ẩn chữ (color: transparent) để lấy
 * nền thật, lần 2 giữ chữ; chỉ tính pixel thuộc nét chữ (lệch ≥ 60 và gần màu chữ),
 * rồi tính WCAG theo từng pixel và lấy phân vị p05/p50/p90/p99.
 *
 * Dùng: node scripts/measure-contrast.mjs [baseUrl] [outJson]
 */
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8822';
const OUT_JSON = process.argv[3] ?? 'D:/projects/hanh-trinh/shots/t10a/contrast-t10a.json';
const CHROME_FALLBACK = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const root = 'C:/Users/Pham An/AppData/Local/ms-playwright';
  if (existsSync(root)) {
    const list = readdirSync(root)
      .filter((n) => /^chromium-\d+$/.test(n))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const dir of list) {
      const exe = path.join(root, dir, 'chrome-win64/chrome.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return CHROME_FALLBACK;
}

/** Tính tương phản + phân vị trong trình duyệt (giảm bớt dữ liệu qua CDP). */
async function analyse(page, bgB64, fgB64, color) {
  return page.evaluate(
    async (bgData, fgData, fgColor) => {
      const load = async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      };
      const srgb = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
      const ratio = (l1, l2) => {
        const hi = Math.max(l1, l2);
        const lo = Math.min(l1, l2);
        return (hi + 0.05) / (lo + 0.05);
      };
      const bg = await load(bgData);
      const fg = await load(fgData);
      const fgLum = lum(fgColor.r, fgColor.g, fgColor.b);
      const ratios = [];
      let darkest = null;
      let darkestC = Infinity;
      for (let i = 0; i + 2 < bg.data.length; i += 4) {
        const d =
          Math.abs(fg.data[i] - bg.data[i]) +
          Math.abs(fg.data[i + 1] - bg.data[i + 1]) +
          Math.abs(fg.data[i + 2] - bg.data[i + 2]);
        if (d < 60) continue;
        const near =
          Math.abs(fg.data[i] - fgColor.r) +
          Math.abs(fg.data[i + 1] - fgColor.g) +
          Math.abs(fg.data[i + 2] - fgColor.b);
        if (near > 200) continue;
        const c = ratio(fgLum, lum(bg.data[i], bg.data[i + 1], bg.data[i + 2]));
        ratios.push(c);
        if (c < darkestC) {
          darkestC = c;
          darkest = { r: bg.data[i], g: bg.data[i + 1], b: bg.data[i + 2] };
        }
      }
      if (ratios.length < 12) return { glyphPixels: ratios.length, worst: null };
      ratios.sort((a, b) => a - b);
      const at = (q) => Math.round(ratios[Math.floor(ratios.length * q)] * 100) / 100;
      return {
        glyphPixels: ratios.length,
        worst: Math.round(ratios[0] * 100) / 100,
        p05: at(0.05),
        p50: at(0.5),
        p90: at(0.9),
        p99: at(0.99),
        avg: Math.round((ratios.reduce((s, v) => s + v, 0) / ratios.length) * 100) / 100,
        darkestBg: darkest,
      };
    },
    bgB64,
    fgB64,
    color,
  );
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 900 },
    protocolTimeout: 120000,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const results = [];

  async function measure(sel, label) {
    const handles = await page.$$(sel);
    if (handles.length === 0) {
      console.log(`SKIP  ${label} ${sel} — không có phần tử`);
      return;
    }
    for (const handle of handles.slice(0, 3)) {
      const info = await handle.evaluate((node) => {
        const cs = getComputedStyle(node);
        const m = cs.color.match(/rgba?\(([^)]+)\)/);
        const p = m ? m[1].split(/[,\s/]+/).filter(Boolean).map(Number) : [0, 0, 0];
        const r = node.getBoundingClientRect();
        return {
          color: { r: p[0], g: p[1], b: p[2] },
          fontSize: parseFloat(cs.fontSize),
          fontWeight: Number(cs.fontWeight),
          text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 42),
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        };
      });
      const clip = {
        x: Math.max(0, Math.floor(info.rect.x)),
        y: Math.max(0, Math.floor(info.rect.y)),
        width: Math.min(Math.ceil(info.rect.w), 1200),
        height: Math.min(Math.ceil(info.rect.h), 600),
      };
      if (clip.width < 4 || clip.height < 4) continue;

      await handle.evaluate((node) => {
        node.dataset.t10Color = node.style.color;
        node.dataset.t10Shadow = node.style.textShadow;
        node.style.color = 'transparent';
        node.style.textShadow = 'none';
      });
      const bgShot = await page.screenshot({ clip, encoding: 'base64' });
      await handle.evaluate((node) => {
        node.style.color = node.dataset.t10Color ?? '';
        node.style.textShadow = node.dataset.t10Shadow ?? '';
      });
      const fgShot = await page.screenshot({ clip, encoding: 'base64' });

      const measured = await analyse(page, bgShot, fgShot, info.color);
      if (measured.worst == null) {
        console.log(`SKIP  ${label} ${sel} "${info.text}" — chỉ ${measured.glyphPixels} pixel nét chữ`);
        continue;
      }
      const large = info.fontSize >= 24 || (info.fontSize >= 18.66 && info.fontWeight >= 700);
      const need = large ? 3 : 4.5;
      const row = {
        label,
        selector: sel,
        text: info.text,
        fontSize: info.fontSize,
        fontWeight: info.fontWeight,
        color: `rgb(${info.color.r}, ${info.color.g}, ${info.color.b})`,
        ...measured,
        need,
        passWorst: measured.worst >= need,
        passP90: measured.p90 >= need,
      };
      results.push(row);
      console.log(
        `${row.passP90 ? 'PASS' : 'FAIL'}  ${label} ${sel} "${info.text}" → p90 ${measured.p90}:1 · p50 ${measured.p50}:1 · worst ${measured.worst}:1 (cần ${need}:1, chữ ${info.fontSize}px/${info.fontWeight})`,
      );
    }
  }

  const users = await (await fetch(`${BASE}/api/users/minh`)).json();
  const trip = users.trips[0];
  const tripPath = `/minh/${trip.id}-${trip.slug}`;

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await wait(1600);
  await measure('.home-hero-title', 'hero 1440');
  await measure('.home-hero-sub', 'hero 1440');
  await measure('.bento-red .bento-title', 'bento đỏ 1440');
  await measure('.bento-red .bento-text', 'bento đỏ 1440');

  await page.goto(`${BASE}${tripPath}`, { waitUntil: 'networkidle0' });
  await wait(2200);
  await measure('.map-qr-meta', 'trang chuyến 1440');
  await measure('.map-marker-count', 'trang chuyến 1440');
  await measure('.map-attribution', 'trang chuyến 1440');
  await measure('.avatar-fallback', 'trang chuyến 1440');

  // V-1: mọi chữ < 12px trên các trang của T5a.
  const tiny = [];
  for (const [url, viewport] of [
    ['/', { width: 1440, height: 900 }],
    [tripPath, { width: 1440, height: 900 }],
    [tripPath, { width: 390, height: 844 }],
    ['/login', { width: 1440, height: 900 }],
  ]) {
    await page.setViewport(viewport);
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
    await wait(1200);
    const found = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!el.textContent?.trim()) continue;
        const hasText = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
        );
        if (!hasText) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 12) {
          out.push({
            sel: el.className && typeof el.className === 'string'
              ? `${el.tagName.toLowerCase()}.${el.className.split(' ').join('.')}`
              : el.tagName.toLowerCase(),
            size,
            text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 28),
          });
        }
      }
      return out;
    });
    for (const f of found) tiny.push({ url, viewport: viewport.width, ...f });
  }
  console.log(`\nChữ < 12px: ${tiny.length} chỗ`);
  for (const t of tiny) console.log(`  ${t.viewport}px ${t.url} ${t.sel} = ${t.size}px "${t.text}"`);

  // V-2/V-3: vùng chạm (hộp thật + phần nới ::after).
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}${tripPath}`, { waitUntil: 'networkidle0' });
  await wait(2200);
  const touch = await page.evaluate(() => {
    const read = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el, '::after');
      const grow = cs.content !== 'none' && cs.content !== 'normal' ? Math.abs(parseFloat(cs.inset)) || 0 : 0;
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        grow: Math.round(grow),
        touch: Math.round(Math.max(r.width, r.height) + grow * 2),
      };
    };
    return {
      marker: read(document.querySelector('.map-marker')),
      zoom: read(document.querySelector('.map-zoom button')),
    };
  });
  console.log('Vùng chạm:', JSON.stringify(touch));

  // V-5 + L-4: 390 story (tắt lớp hướng dẫn để đo được chữ story).
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}${tripPath}`, { waitUntil: 'networkidle0' });
  await wait(1200);
  await page.evaluate(() => {
    localStorage.setItem('hanh-trinh:story-guide-seen', '1');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1600);
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.strip-card')];
    (cards[1] ?? cards[0])?.click();
  });
  const storyOpen = await page
    .waitForSelector('.story-sheet', { timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  if (storyOpen) {
    await wait(1600);
    await measure('.story-title', 'story 390');
    await measure('.story-desc', 'story 390');
    await measure('.story-meta', 'story 390');
    await measure('.story-action', 'story 390');
  } else {
    console.log('! không mở được story để đo');
  }

  // V-5: tên chuyến đè bản đồ ở 390.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}${tripPath}`, { waitUntil: 'networkidle0' });
  await wait(2000);
  await measure('.mobile-trip-title', 'tên chuyến trên bản đồ 390');

  await browser.close();
  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  await writeFile(
    OUT_JSON,
    JSON.stringify({ measuredAt: new Date().toISOString(), base: BASE, results, tiny, touch }, null, 1),
    'utf8',
  );
  const fails = results.filter((r) => !r.passP90);
  console.log(`\n${results.length - fails.length}/${results.length} đạt ngưỡng p90; ${fails.length} dưới ngưỡng`);
  for (const f of fails) console.log(`  FAIL ${f.label} ${f.selector} p90 ${f.p90} (cần ${f.need})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
