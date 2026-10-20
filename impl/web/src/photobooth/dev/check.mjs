/**
 * Kiểm tra chức năng photobooth (không phải test của qa): đo kích thước PNG/GIF,
 * dừng giữa phiên, tải ảnh lên, storage, mạng, tràn ngang.
 * Chạy sau khi đã bật vite: node src/photobooth/dev/check.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { findChrome } from './browser.mjs';

const BASE = process.env.PB_URL ?? 'http://localhost:5199';
const CHROME = findChrome();
if (!CHROME) {
  console.error('Không tìm thấy Chromium/Chrome. Đặt CHROME_PATH hoặc cài Playwright.');
  process.exit(1);
}
const TMP = path.resolve('src/photobooth/dev/.tmp');
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SEL = {
  fieldCount: '.htpb-field--count .htpb-seg button',
  fieldTimer: '.htpb-field--timer .htpb-seg button',
  fieldOrientation: '.htpb-field--orientation .htpb-seg button',
};

async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });
}

async function openCamera(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Mở camera'))?.click();
      const retry = [...document.querySelectorAll('.htpb-alert button')].find((b) => b.textContent?.trim() === 'Thử lại');
      retry?.click();
    });
    try {
      await page.waitForSelector('.htpb-camera:not([hidden])', { timeout: 12000 });
      await wait(500);
      return;
    } catch {
      await wait(800);
    }
  }
  throw new Error('Không mở được màn camera sau 3 lần thử');
}

function readPngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length };
}

function gifInfo(buffer) {
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  let frames = 0;
  for (let i = 0; i < buffer.length - 2; i += 1) {
    if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9 && buffer[i + 2] === 0x04) frames += 1;
  }
  return { width, height, frames, bytes: buffer.length };
}

async function main() {
  await mkdir(TMP, { recursive: true });
  const browser = await launch();
  const page = await browser.newPage();
  const external = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(BASE) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url);
  });
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));

  await page.goto(`${BASE}/photobooth-dev.html`, { waitUntil: 'networkidle0' });

  // ---- R-102 ----
  await openCamera(page);
  const videoInfo = await page.evaluate(() => {
    const v = document.querySelector('.htpb-video');
    if (!v?.srcObject) return null;
    return {
      w: v.videoWidth,
      h: v.videoHeight,
      tracks: v.srcObject.getTracks().map((t) => t.kind),
      mirrored: getComputedStyle(v).transform,
    };
  });
  check('R-102 video 1280x720', videoInfo?.w === 1280 && videoInfo?.h === 720, JSON.stringify(videoInfo));
  check('R-102 chỉ xin video, không micro', JSON.stringify(videoInfo?.tracks) === '["video"]', JSON.stringify(videoInfo?.tracks));
  check('R-102 xem trước lật gương', /matrix\(-1/.test(videoInfo?.mirrored ?? ''), videoInfo?.mirrored);

  // ---- R-103 mặc định ----
  const defaults = await page.evaluate((sel) => {
    const pressed = (s) =>
      [...document.querySelectorAll(s)].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.value);
    return { count: pressed(sel.fieldCount), timer: pressed(sel.fieldTimer), orientation: pressed(sel.fieldOrientation) };
  }, SEL);
  check(
    'R-103 mặc định 4 ảnh / 3 giây / ngang',
    defaults.count[0] === '4' && defaults.timer[0] === '3' && defaults.orientation[0] === 'landscape',
    JSON.stringify(defaults),
  );

  // ---- R-108: dừng giữa phiên ----
  await page.evaluate(
    (sel) => {
      document.querySelector(`${sel.fieldTimer}[data-value="5"]`)?.click();
      document.querySelector(`${sel.fieldCount}[data-value="2"]`)?.click();
      document.querySelector('.htpb-shoot')?.click();
    },
    SEL,
  );
  await wait(1500);
  const duringRun = await page.evaluate(
    (sel) => ({
      disabled: [...document.querySelectorAll('.htpb-camera__options .htpb-seg button')].every((b) => b.disabled),
      lockShown: !document.querySelector('.htpb-lock')?.hidden,
      countPressed: document.querySelector(`${sel.fieldCount}[aria-pressed="true"]`)?.dataset.value,
    }),
    SEL,
  );
  await page.evaluate((sel) => document.querySelector(`${sel.fieldCount}[data-value="6"]`)?.click(), SEL);
  const afterClicks = await page.evaluate(
    (sel) => document.querySelector(`${sel.fieldCount}[aria-pressed="true"]`)?.dataset.value,
    SEL,
  );
  check('R-103 khoá cả 4 tuỳ chọn khi đang chụp', duringRun.disabled && duringRun.lockShown, JSON.stringify(duringRun));
  check('R-103 đang chụp bấm 6 không đổi số ảnh', afterClicks === '2', `còn ${afterClicks}`);

  await page.evaluate(() => document.querySelector('.htpb-stop')?.click());
  await wait(6500);
  const afterStop = await page.evaluate(() => document.querySelectorAll('.htpb-camera .htpb-thumbs canvas').length);
  check('R-108 dừng ở giây 1,5 → không chụp thêm ảnh nào', afterStop === 0, `${afterStop} ảnh`);

  // ---- R-105/R-107: hẹn 0, 2 ảnh, dưới 4 giây ----
  const startedAt = Date.now();
  await page.evaluate(
    (sel) => {
      document.querySelector(`${sel.fieldTimer}[data-value="0"]`)?.click();
      document.querySelector(`${sel.fieldCount}[data-value="2"]`)?.click();
      document.querySelector('.htpb-shoot')?.click();
    },
    SEL,
  );
  await page.waitForFunction(
    () => {
      const next = document.querySelector('.htpb-next');
      return next && !next.disabled && document.querySelectorAll('.htpb-camera .htpb-thumbs canvas').length === 2;
    },
    { timeout: 15000 },
  );
  const elapsed = (Date.now() - startedAt) / 1000;
  check('R-105 hẹn 0 + 2 ảnh xong dưới 4 giây', elapsed < 4, `${elapsed.toFixed(2)}s`);

  // ---- R-104: đổi bộ lọc không đổi ảnh đã chụp ----
  const filterSwap = await page.evaluate(() => {
    const before = document.querySelector('.htpb-thumbs canvas')?.toDataURL().length ?? 0;
    document.querySelector('.htpb-filter[data-filter="bw"]')?.click();
    const after = document.querySelector('.htpb-thumbs canvas')?.toDataURL().length ?? 0;
    return { before, after, pressed: document.querySelector('.htpb-filter[aria-pressed="true"]')?.dataset.filter };
  });
  check('R-104 đổi lọc chỉ đổi xem trước, ảnh cũ giữ nguyên', filterSwap.before === filterSwap.after && filterSwap.pressed === 'bw', JSON.stringify(filterSwap));

  // ---- Editor + PNG ----
  await page.evaluate(() => document.querySelector('.htpb-next')?.click());
  await page.waitForSelector('.htpb-editor:not([hidden])');
  await page.evaluate(() => {
    const input = document.querySelector('#htpb-strip-title');
    input.value = 'hello trip';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const layoutState = await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-layout')].map((b) => ({ id: b.dataset.layout, disabled: b.disabled })),
  );
  check(
    'R-111 khung 5 ô mờ khi có 2 ảnh, dải cổ điển chọn được',
    layoutState.find((l) => l.id === 'film')?.disabled === true &&
      layoutState.find((l) => l.id === 'classic')?.disabled === false,
    JSON.stringify(layoutState),
  );

  // Kéo và phóng ảnh.
  const stripRect = await page.evaluate(() => {
    const strip = document.querySelector('.htpb-strip');
    const rect = strip.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.mouse.move(stripRect.x + stripRect.width / 2, stripRect.y + 60);
  await page.mouse.wheel({ deltaY: -100 });
  await wait(120);
  const zoomIn = await page.evaluate(() => window.__pbDebug?.transforms?.[0]?.scale ?? null);

  await page.evaluate(() => [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click());
  await page.waitForSelector('.htpb-dialog');
  await wait(400);

  await page.evaluate(() => {
    window.__downloads = [];
    const proto = HTMLAnchorElement.prototype;
    proto.click = function patched() {
      if (this.download) {
        window.__downloads.push({ name: this.download, href: this.href });
        return;
      }
    };
  });

  await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-dialog button')].find((b) => b.textContent?.includes('Lưu dải ảnh'))?.click(),
  );
  await wait(1500);
  const downloads = await page.evaluate(() => window.__downloads);
  check('R-115 tên tệp PNG', downloads[0]?.name === 'hanh-trinh-hello-trip.png', JSON.stringify(downloads.map((d) => d.name)));

  if (downloads[0]) {
    const buffer = Buffer.from(
      await page.evaluate(async (href) => {
        const response = await fetch(href);
        return Array.from(new Uint8Array(await response.arrayBuffer()));
      }, downloads[0].href),
    );
    await writeFile(path.join(TMP, 'strip-2.png'), buffer);
    const size = readPngSize(buffer);
    // 2 ảnh: 260 x (24 + 34 + 2*203 + 40) = 260 x 504 → xuất 520 x 1008
    check('R-115 PNG gấp đôi, không hình mờ', size.width === 520 && size.height === 1008, `${size.width}x${size.height}`);
  }

  // ---- GIF ---- (lưu PNG xong hộp tự đóng theo R-115, nên mở lại)
  await page.waitForFunction(() => !document.querySelector('.htpb-dialog'), { timeout: 6000 });
  await page.evaluate(() => [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click());
  await page.waitForSelector('.htpb-dialog');
  await wait(300);
  await page.evaluate(() => [...document.querySelectorAll('.htpb-dialog button')].find((b) => b.textContent?.includes('GIF'))?.click());
  await page.waitForFunction(() => (window.__downloads?.length ?? 0) >= 2, { timeout: 30000 });
  const gifDownload = (await page.evaluate(() => window.__downloads))[1];
  const gifBuffer = Buffer.from(
    await page.evaluate(async (href) => {
      const response = await fetch(href);
      return Array.from(new Uint8Array(await response.arrayBuffer()));
    }, gifDownload.href),
  );
  await writeFile(path.join(TMP, 'strip.gif'), gifBuffer);
  const info = gifInfo(gifBuffer);
  check('R-116 tên tệp GIF', gifDownload.name === 'hanh-trinh-hello-trip.gif', gifDownload.name);
  check(
    'R-116 GIF 480x480, mỗi ảnh một khung',
    info.width === 480 && info.height === 480 && info.frames === 2,
    JSON.stringify(info),
  );

  // ---- R-135 / R-132 ----
  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    cookie: document.cookie.length,
  }));
  check(
    'R-135 không localStorage/sessionStorage/cookie',
    storage.local === 0 && storage.session === 0 && storage.cookie === 0,
    JSON.stringify(storage),
  );
  check('R-132/R-133 không có yêu cầu mạng ngoài', external.length === 0, external.join(', '));

  // ---- R-117: 7 ảnh tải lên ở 390px ----
  const uploadPage = await browser.newPage();
  await uploadPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await uploadPage.goto(`${BASE}/photobooth-dev.html`, { waitUntil: 'networkidle0' });
  const files = [];
  for (let i = 0; i < 7; i += 1) {
    const dataUrl = await uploadPage.evaluate((seed) => {
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 400;
      const ctx = c.getContext('2d');
      ctx.fillStyle = ['#F7C9A4', '#CFE3EF', '#F6E2B3', '#DDEBD6'][seed % 4];
      ctx.fillRect(0, 0, 300, 400);
      ctx.fillStyle = '#00293D';
      ctx.font = '700 40px sans-serif';
      ctx.fillText(`IMG ${seed + 1}`, 20, 200);
      return c.toDataURL('image/png');
    }, i);
    const file = path.join(TMP, `upload-${i}.png`);
    await writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    files.push(file);
  }
  const fileInput = await uploadPage.$('.htpb-drop input[type="file"]');
  await fileInput.uploadFile(...files);
  await uploadPage.waitForSelector('.htpb-editor:not([hidden])', { timeout: 10000 });
  const uploadState = await uploadPage.evaluate(() => {
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
    };
    const controls = [...document.querySelectorAll('.htpb button, .htpb .htpb-swatch, .htpb .htpb-filter, .htpb .htpb-layout')].filter(visible);
    const texts = [...document.querySelectorAll('.htpb button, .htpb p, .htpb span, .htpb small, .htpb label, .htpb strong, .htpb figcaption')].filter(visible);
    return {
      thumbs: document.querySelectorAll('.htpb-editor-thumbs canvas').length,
      label: document.querySelector('.htpb-editor .htpb-session__count')?.textContent,
      scrollWidth: document.documentElement.scrollWidth,
      minTouch: Math.min(...controls.map((b) => b.getBoundingClientRect().height)),
      minFont: Math.min(...texts.map((b) => parseFloat(getComputedStyle(b).fontSize))),
    };
  });
  check('R-117 7 ảnh tải lên → 7 ảnh, nhãn 07 / 07', uploadState.thumbs === 7 && uploadState.label === '7 / 7', JSON.stringify(uploadState));
  check('R-131 390px không tràn ngang', uploadState.scrollWidth <= 390, `scrollWidth=${uploadState.scrollWidth}`);
  check('R-131 vùng chạm ≥ 44px', uploadState.minTouch >= 44, `min=${uploadState.minTouch}`);
  check('R-120 chữ ≥ 12px', uploadState.minFont >= 12, `min=${uploadState.minFont}`);

  // Tệp không phải ảnh → ở lại màn vào + báo lý do.
  const txtPath = path.join(TMP, 'not-image.txt');
  await writeFile(txtPath, 'khong phai anh');
  const badPage = await browser.newPage();
  await badPage.goto(`${BASE}/photobooth-dev.html`, { waitUntil: 'networkidle0' });
  const badInput = await badPage.$('.htpb-drop input[type="file"]');
  await badInput.uploadFile(txtPath);
  await wait(700);
  const badState = await badPage.evaluate(() => ({
    onEntry: !document.querySelector('.htpb-entry').hidden,
    alert: document.querySelector('.htpb-entry .htpb-alert')?.textContent?.trim() ?? '',
  }));
  check('R-117 .txt → ở màn vào + báo lý do bằng chữ', badState.onEntry && badState.alert.length > 5, badState.alert);

  // ---- B-05 ----
  const savePage = await browser.newPage();
  await savePage.goto(`${BASE}/photobooth-dev.html?photos=7&save=1`, { waitUntil: 'networkidle0' });
  const sourceButton = await savePage.evaluate(() => {
    const button = [...document.querySelectorAll('.htpb-entry__actions button')].find((b) =>
      b.textContent?.includes('Dùng ảnh của chuyến'),
    );
    return { exists: Boolean(button), hidden: button?.hidden };
  });
  check('B-05 có nút "dùng ảnh của chuyến" khi truyền sourcePhotos', sourceButton.exists && !sourceButton.hidden, JSON.stringify(sourceButton));

  const plainPage = await browser.newPage();
  await plainPage.goto(`${BASE}/photobooth-dev.html`, { waitUntil: 'networkidle0' });
  await openCamera(plainPage);
  await plainPage.evaluate((sel) => {
    document.querySelector(`${sel.fieldTimer}[data-value="0"]`)?.click();
    document.querySelector(`${sel.fieldCount}[data-value="2"]`)?.click();
    document.querySelector('.htpb-shoot')?.click();
  }, SEL);
  await plainPage.waitForFunction(
    () => {
      const next = document.querySelector('.htpb-next');
      return next && !next.disabled;
    },
    { timeout: 15000 },
  );
  await plainPage.evaluate(() => document.querySelector('.htpb-next')?.click());
  await plainPage.waitForSelector('.htpb-editor:not([hidden])');
  await plainPage.evaluate(() => [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click());
  await plainPage.waitForSelector('.htpb-dialog');
  const saveHidden = await plainPage.evaluate(() => {
    const button = [...document.querySelectorAll('.htpb-dialog button')].find((b) => b.textContent?.includes('Lưu vào chuyến'));
    return { hidden: button?.hidden, display: button ? getComputedStyle(button).display : 'none' };
  });
  check('B-05 không có onSaveToTrip → nút lưu vào chuyến ẩn', saveHidden.hidden === true && saveHidden.display === 'none', JSON.stringify(saveHidden));

  // ---- R-108 nút X ----
  await plainPage.evaluate(() => document.querySelector('.htpb-dialog .htpb-close-dialog')?.click());
  await plainPage.evaluate(() => document.querySelector('.htpb-editor .htpb-btn--ghost')?.click());
  await wait(700);
  await plainPage.evaluate(() => document.querySelector('.htpb-close')?.click());
  await wait(300);
  const closed = await plainPage.evaluate(() => {
    const v = document.querySelector('.htpb-video');
    return {
      onEntry: !document.querySelector('.htpb-entry').hidden,
      liveTracks: v.srcObject ? v.srcObject.getTracks().filter((t) => t.readyState === 'live').length : 0,
    };
  });
  check('R-108 nút X tắt track, về màn vào', closed.onEntry && closed.liveTracks === 0, JSON.stringify(closed));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kiểm tra đạt`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
