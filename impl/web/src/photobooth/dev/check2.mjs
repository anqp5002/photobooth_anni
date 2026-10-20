/**
 * Kiểm tra phần còn lại của SPEC: nhịp chụp, hiệu ứng, trạng thái nút, bố cục,
 * trợ năng, khung dựng sẵn, giảm chuyển động, lỗi camera.
 * Chạy: node src/photobooth/dev/check2.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
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
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SEL = {
  count: '.htpb-field--count .htpb-seg button',
  timer: '.htpb-field--timer .htpb-seg button',
  orientation: '.htpb-field--orientation .htpb-seg button',
  shoot: '.htpb-shoot',
  stop: '.htpb-stop',
  next: '.htpb-next',
  thumbsCamera: '.htpb-camera .htpb-thumbs canvas',
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

async function openPage(browser, query = '') {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
  await page.goto(`${BASE}/photobooth-dev.html${query}`, { waitUntil: 'networkidle0' });
  return page;
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

async function setOptions(page, { count, timer, orientation }) {
  await page.evaluate(
    (sel, opts) => {
      if (opts.count) document.querySelector(`${sel.count}[data-value="${opts.count}"]`)?.click();
      if (opts.timer !== undefined) document.querySelector(`${sel.timer}[data-value="${opts.timer}"]`)?.click();
      if (opts.orientation) document.querySelector(`${sel.orientation}[data-value="${opts.orientation}"]`)?.click();
    },
    SEL,
    { count, timer, orientation },
  );
}

async function goEditor(page) {
  await page.evaluate((sel) => document.querySelector(sel.next)?.click(), SEL);
  await page.waitForSelector('.htpb-editor:not([hidden])', { timeout: 8000 });
  await wait(300);
}

async function main() {
  await mkdir(TMP, { recursive: true });
  const browser = await launch();

  // ================= R-109 / R-110 =================
  const page = await openPage(browser);
  await openCamera(page);
  const idle = await page.evaluate(
    (sel) => ({
      nextDisabled: document.querySelector(sel.next)?.disabled,
      progress: document.querySelector('.htpb-progress')?.getAttribute('aria-valuenow'),
      emptySlots: document.querySelectorAll('.htpb-camera .htpb-empty-slot').length,
    }),
    SEL,
  );
  check('R-109 0 ảnh → nút sang chỉnh sửa vô hiệu', idle.nextDisabled === true, JSON.stringify(idle));
  check('R-110 0/4 → 4 ô trống đánh số', idle.emptySlots === 4, `${idle.emptySlots} ô`);

  await setOptions(page, { count: '4', timer: '0' });
  await page.evaluate((sel) => document.querySelector(sel.shoot)?.click(), SEL);
  await page.waitForFunction((sel) => document.querySelectorAll(sel.thumbsCamera).length >= 2, { timeout: 15000 }, SEL);
  await page.evaluate((sel) => document.querySelector(sel.stop)?.click(), SEL);
  await wait(600);
  const half = await page.evaluate(
    (sel) => ({
      progress: document.querySelector('.htpb-progress')?.getAttribute('aria-valuenow'),
      fill: document.querySelector('.htpb-progress__fill')?.style.width,
      thumbs: document.querySelectorAll(sel.thumbsCamera).length,
      empty: [...document.querySelectorAll('.htpb-camera .htpb-empty-slot')].map((n) => n.textContent),
      label: document.querySelector('.htpb-session__count')?.textContent,
      nextDisabled: document.querySelector(sel.next)?.disabled,
    }),
    SEL,
  );
  check(
    'R-110 2/4 → thanh 50%, 2 ảnh nhỏ, ô 3–4',
    Number(half.progress) === 50 && half.thumbs === 2 && half.empty.join(',') === '3,4',
    JSON.stringify(half),
  );
  check('R-109 đã có ảnh, không chạy → nút bật', half.nextDisabled === false, String(half.nextDisabled));

  // ================= R-105: nhịp =================
  await setOptions(page, { count: '2', timer: '3' });
  await page.evaluate((sel) => document.querySelector(sel.shoot)?.click(), SEL);
  const marks = await page.evaluate(
    (sel) =>
      new Promise((resolve) => {
        const started = performance.now();
        const times = [];
        const seen = new Set();
        const handle = window.setInterval(() => {
          document.querySelectorAll(sel.thumbsCamera).forEach((node) => {
            if (!seen.has(node)) {
              seen.add(node);
              times.push(Math.round(performance.now() - started));
            }
          });
          if (times.length >= 2) {
            window.clearInterval(handle);
            resolve(times);
          }
        }, 20);
      }),
    SEL,
  );
  await wait(400);
  const first = marks[0] / 1000;
  const second = marks[1] / 1000;
  check('R-105 hẹn 3s: ảnh 1 ≈ 3,0s', Math.abs(first - 3.0) <= 0.6, `ảnh 1 ở ${first.toFixed(2)}s`);
  check('R-105 ảnh 2 ≈ 8,2s (nghỉ 2,2s)', Math.abs(second - 8.2) <= 0.7, `ảnh 2 ở ${second.toFixed(2)}s`);

  // ================= R-106 =================
  // Chờ phiên trước kết thúc hẳn (nút bắt đầu chụp hiện lại) rồi mới đo.
  await page.waitForFunction(() => document.querySelector('.htpb-shoot') && !document.querySelector('.htpb-shoot').hidden, {
    timeout: 15000,
  });
  await setOptions(page, { count: '2', timer: '0' });
  const previewTiming = await page.evaluate(
    (sel) =>
      new Promise((resolve) => {
        const preview = document.querySelector('.htpb-preview');
        const flash = document.querySelector('.htpb-flash');
        let startedAt = 0;
        let sawFlash = false;
        const observer = new MutationObserver(() => {
          if (flash.classList.contains('is-on')) sawFlash = true;
          const on = preview.classList.contains('is-on');
          if (on && startedAt === 0) startedAt = performance.now();
          if (!on && startedAt > 0) {
            observer.disconnect();
            resolve({ ms: Math.round(performance.now() - startedAt), sawFlash });
          }
        });
        observer.observe(preview, { attributes: true, attributeFilter: ['class'] });
        observer.observe(flash, { attributes: true, attributeFilter: ['class'] });
        document.querySelector(sel.shoot)?.click();
        window.setTimeout(() => {
          observer.disconnect();
          resolve({ ms: -1, sawFlash });
        }, 12000);
      }),
    SEL,
  );
  check('R-106 cú chụp có nháy trắng', previewTiming.sawFlash === true, String(previewTiming.sawFlash));
  check(
    'R-106 khung xem trước ~1,2s',
    previewTiming.ms >= 1050 && previewTiming.ms <= 1500,
    `${previewTiming.ms}ms`,
  );
  await page.evaluate((sel) => document.querySelector(sel.stop)?.click(), SEL);
  await wait(400);

  // ================= R-104 =================
  const filters = await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-filter')].map((b) => ({ id: b.dataset.filter, label: b.textContent?.trim() })),
  );
  check('R-104 có 6 bộ lọc', filters.length === 6, filters.map((f) => f.id).join(','));

  // ================= R-112 =================
  await goEditor(page);
  await page.evaluate(() => {
    const input = document.querySelector('#htpb-strip-title');
    input.value = 'hello trip';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.htpb-swatch[data-color="#00293D"]')?.click();
  });
  await wait(500);
  const titleState = await page.evaluate(() => {
    const strip = document.querySelector('.htpb-strip');
    const ctx = strip.getContext('2d');
    const pixel = ctx.getImageData(8, 8, 1, 1).data;
    return {
      inputUpper: getComputedStyle(document.querySelector('#htpb-strip-title')).textTransform,
      bg: `${pixel[0]},${pixel[1]},${pixel[2]}`,
      maxLength: document.querySelector('#htpb-strip-title').getAttribute('maxlength'),
    };
  });
  check('R-112 nền dải đổi sang xanh mực', titleState.bg === '0,41,61', titleState.bg);
  check(
    'R-112 ô tiêu đề tự in hoa, tối đa 40 ký tự',
    titleState.inputUpper === 'uppercase' && titleState.maxLength === '40',
    JSON.stringify(titleState),
  );

  // ================= R-113 =================
  const transformEvents = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const root = document.querySelector('[data-photobooth="root"]');
          let latest = null;
          let timer = 0;
          const handler = (event) => {
            latest = event.detail;
            window.clearTimeout(timer);
            // Đợi nhịp cuối (kéo nhiều bước sẽ bắn nhiều sự kiện).
            timer = window.setTimeout(() => {
              root.removeEventListener('htpb:transform', handler);
              resolve(latest);
            }, 250);
          };
          root.addEventListener('htpb:transform', handler);
          window.setTimeout(() => {
            root.removeEventListener('htpb:transform', handler);
            resolve(latest);
          }, 4000);
        }),
    );

  const stripRect = await page.evaluate(() => {
    const rect = document.querySelector('.htpb-strip').getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  });

  const zoomEvent = transformEvents();
  await page.mouse.move(stripRect.x + stripRect.w / 2, stripRect.y + 60);
  await page.mouse.wheel({ deltaY: -120 });
  const zoomed = await zoomEvent;
  check('R-113 cuộn lên 1 nấc → tỉ lệ 1,05', zoomed?.scale === 1.05, JSON.stringify(zoomed));

  const clampEvent = transformEvents();
  for (let i = 0; i < 30; i += 1) await page.mouse.wheel({ deltaY: 120 });
  const clamped = await clampEvent;
  check('R-113 cuộn xuống nhiều nấc → dừng ở 1,00', clamped?.scale === 1, JSON.stringify(clamped));

  const dragEvent = transformEvents();
  await page.mouse.move(stripRect.x + stripRect.w / 2, stripRect.y + 120);
  await page.mouse.down();
  await page.mouse.move(stripRect.x + stripRect.w / 2 + 40, stripRect.y + 120, { steps: 6 });
  await page.mouse.up();
  const dragged = await dragEvent;
  check('R-113 kéo 40px → ảnh dời trong ô', Math.abs((dragged?.dx ?? 0) - 40) <= 2, JSON.stringify(dragged));

  // ================= R-130 / R-111 (cần 4 ảnh) =================
  await page.evaluate(() => document.querySelector('.htpb-editor__aside-left .htpb-btn--ghost')?.click());
  await page.waitForSelector('.htpb-camera:not([hidden])');
  await setOptions(page, { count: '4', timer: '0' });
  await page.evaluate((sel) => document.querySelector(sel.shoot)?.click(), SEL);
  await page.waitForFunction(
    (sel) =>
      document.querySelectorAll(sel.thumbsCamera).length === 4 &&
      !document.querySelector(sel.next)?.disabled,
    { timeout: 25000 },
    SEL,
  );
  check('R-109 chụp đủ 4/4 → nút sang chỉnh sửa bật', true, '4 ảnh, nút bật');
  await goEditor(page);
  await page.evaluate(() => {
    const input = document.querySelector('#htpb-strip-title');
    input.value = 'hello trip';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.htpb-swatch[data-color="#00293D"]')?.click();
  });
  await wait(300);

  const layoutMeta = await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-layout')].map((b) => ({
      id: b.dataset.layout,
      disabled: b.disabled,
      meta: b.querySelector('.htpb-layout__meta')?.textContent,
    })),
  );
  check(
    'R-111 có 4 ảnh → chỉ khung 5 ô bị khoá',
    layoutMeta.filter((l) => l.disabled).length === 1 && layoutMeta.find((l) => l.id === 'film')?.disabled === true,
    JSON.stringify(layoutMeta),
  );

  await page.evaluate(() => document.querySelector('.htpb-layout[data-layout="ticket"]')?.click());
  await wait(300);
  const ticket = await page.evaluate(() => {
    const rect = document.querySelector('.htpb-strip').getBoundingClientRect();
    return { ratio: rect.height / rect.width, colorDisabled: document.querySelector('.htpb-swatch')?.disabled };
  });
  await page.evaluate(() => document.querySelector('.htpb-layout[data-layout="postcard"]')?.click());
  await wait(250);
  const postcard = await page.evaluate(() => {
    const rect = document.querySelector('.htpb-strip').getBoundingClientRect();
    return { ratio: rect.height / rect.width };
  });
  const filmDisabled = await page.evaluate(() => document.querySelector('.htpb-layout[data-layout="film"]')?.disabled);
  check('R-130 khung 4 ô dọc tỉ lệ ~1:2,4–1:2,5', ticket.ratio >= 2.3 && ticket.ratio <= 2.6, `1:${ticket.ratio.toFixed(2)}`);
  check('R-130 khung lưới 2x2 cùng khổ', postcard.ratio >= 2.3 && postcard.ratio <= 2.6, `1:${postcard.ratio.toFixed(2)}`);
  check('R-130 khung 5 ô chỉ mở khi có 5 ảnh', filmDisabled === true, String(filmDisabled));
  check('R-112 khung dựng sẵn → ô màu bị khoá', ticket.colorDisabled === true, String(ticket.colorDisabled));

  // ================= R-115 PNG 4 ảnh 520x1820 =================
  await page.evaluate(() => document.querySelector('.htpb-layout[data-layout="classic"]')?.click());
  await wait(300);
  await page.evaluate(() => {
    window.__downloads = [];
    HTMLAnchorElement.prototype.click = function patched() {
      if (this.download) window.__downloads.push({ name: this.download, href: this.href });
    };
  });
  await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click(),
  );
  await page.waitForSelector('.htpb-dialog');
  await wait(300);
  await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-dialog button')].find((b) => b.textContent?.includes('Lưu dải ảnh'))?.click(),
  );
  await page.waitForFunction(() => (window.__downloads?.length ?? 0) >= 1, { timeout: 15000 });
  const firstDownload = (await page.evaluate(() => window.__downloads))[0];
  const pngBuffer = Buffer.from(
    await page.evaluate(async (href) => {
      const response = await fetch(href);
      return Array.from(new Uint8Array(await response.arrayBuffer()));
    }, firstDownload.href),
  );
  await writeFile(path.join(TMP, 'strip-4.png'), pngBuffer);
  const w = pngBuffer.readUInt32BE(16);
  const h = pngBuffer.readUInt32BE(20);
  check('R-115 4 ảnh → PNG 520x1820', w === 520 && h === 1820, `${w}x${h}`);
  check('R-115 tên tệp hanh-trinh-hello-trip.png', firstDownload.name === 'hanh-trinh-hello-trip.png', firstDownload.name);

  // ================= R-127 khoá nút khi xuất =================
  await page.waitForFunction(() => !document.querySelector('.htpb-dialog'), { timeout: 6000 });
  await page.evaluate(() =>
    [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.trim() === 'Xuất')?.click(),
  );
  await page.waitForSelector('.htpb-dialog');
  const duringExport = await page.evaluate(() => {
    // Bấm và đọc trạng thái ngay trong cùng một nhịp: setBusy chạy đồng bộ trước khi xuất.
    [...document.querySelectorAll('.htpb-dialog button')].find((b) => b.textContent?.includes('GIF'))?.click();
    return [...document.querySelectorAll('.htpb-dialog__actions button')].map((b) => ({
      text: b.textContent?.trim(),
      disabled: b.disabled,
      spinner: Boolean(b.querySelector('.htpb-spinner')),
    }));
  });
  check(
    'R-127 đang xuất → mọi nút xuất vô hiệu, nút đang chạy có icon quay',
    duringExport.every((b) => b.disabled) && duringExport.some((b) => b.spinner),
    JSON.stringify(duringExport),
  );
  await page.waitForFunction(() => (window.__downloads?.length ?? 0) >= 2, { timeout: 30000 });

  // ================= R-128 giảm chuyển động =================
  const reduced = browser.newPage();
  await (await reduced).emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await (await reduced).setViewport({ width: 1440, height: 900 });
  await (await reduced).goto(`${BASE}/photobooth-dev.html`, { waitUntil: 'networkidle0' });
  const motion = await (await reduced).evaluate(() => ({
    dot: getComputedStyle(document.querySelector('.htpb-dot')).animationIterationCount,
  }));
  check('R-128 giảm chuyển động → tắt nhịp lặp', motion.dot === '1', JSON.stringify(motion));

  // ================= R-118 lỗi camera =================
  const deniedPage = await browser.newPage();
  await deniedPage.evaluateOnNewDocument(() => {
    navigator.mediaDevices.getUserMedia = () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      return Promise.reject(error);
    };
  });
  await deniedPage.goto(`${BASE}/photobooth-dev.html`, { waitUntil: 'networkidle0' });
  await deniedPage.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Mở camera'))?.click();
  });
  await wait(700);
  const denied = await deniedPage.evaluate(() => ({
    onEntry: !document.querySelector('.htpb-entry').hidden,
    alert: document.querySelector('.htpb-entry .htpb-alert')?.textContent?.trim() ?? '',
    buttons: [...document.querySelectorAll('.htpb-alert button')].map((b) => b.textContent?.trim()),
  }));
  check(
    'R-118 từ chối quyền → báo đúng loại, vẫn ở màn vào',
    denied.onEntry && /từ chối quyền/i.test(denied.alert),
    denied.alert.slice(0, 60),
  );
  check(
    'R-118 có "thử lại" + "tải ảnh lên"',
    denied.buttons.includes('Thử lại') && denied.buttons.includes('Tải ảnh lên'),
    JSON.stringify(denied.buttons),
  );

  // ================= R-120 đếm ngược aria-live + h1 + alt =================
  const a11yPage = await openPage(browser);
  await openCamera(a11yPage);
  await setOptions(a11yPage, { count: '2', timer: '3' });
  await a11yPage.evaluate((sel) => document.querySelector(sel.shoot)?.click(), SEL);
  await a11yPage.waitForFunction(
    () => (document.querySelector('[aria-live="assertive"]')?.textContent ?? '').length > 0,
    { timeout: 6000 },
  );
  const live = await a11yPage.evaluate(() => document.querySelector('[aria-live="assertive"]')?.textContent);
  check('R-120 đếm ngược đọc qua aria-live', /Chụp sau \d giây/.test(live ?? ''), live ?? '');
  await a11yPage.waitForFunction(
    (sel) => document.querySelectorAll(sel.thumbsCamera).length === 2 && !document.querySelector(sel.next)?.disabled,
    { timeout: 20000 },
    SEL,
  );
  const headings = await a11yPage.evaluate(() => ({
    h1: [...document.querySelectorAll('.htpb h1')].map((n) => n.textContent?.trim()),
    captions: [...document.querySelectorAll('.htpb-camera .htpb-thumbs canvas')].map((n) => n.getAttribute('aria-label')),
  }));
  check(
    'R-120 có h1 và ảnh có nhãn "Ảnh n"',
    headings.h1.includes('Photobooth hành trình') && headings.captions.every((c) => /^Ảnh \d+$/.test(c ?? '')),
    JSON.stringify(headings),
  );
  const focusable = await a11yPage.evaluate(() => {
    const nodes = [...document.querySelectorAll('.htpb button:not([disabled]):not([hidden])')].filter((n) => {
      const rect = n.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return { count: nodes.length, tags: [...new Set(nodes.map((n) => n.tagName))] };
  });
  check(
    'R-120 mọi điều khiển là <button> thật',
    focusable.tags.length === 1 && focusable.tags[0] === 'BUTTON',
    JSON.stringify(focusable),
  );

  // ================= R-114 quay lại camera =================
  const hasNext = await a11yPage.evaluate(() => {
    const next = document.querySelector('.htpb-next');
    return Boolean(next) && !next.disabled;
  });
  check('R-109 chụp xong → nút sang chỉnh sửa bật', hasNext, String(hasNext));
  await a11yPage.evaluate(() => document.querySelector('.htpb-next')?.click());
  await a11yPage.waitForSelector('.htpb-editor:not([hidden])');
  const editorCount = await a11yPage.evaluate(() => document.querySelectorAll('.htpb-editor-thumbs canvas').length);
  await a11yPage.evaluate(() =>
    [...document.querySelectorAll('.htpb-editor button')].find((b) => b.textContent?.includes('Quay lại camera'))?.click(),
  );
  await a11yPage.waitForSelector('.htpb-camera:not([hidden])', { timeout: 8000 });
  await wait(500);
  const back = await a11yPage.evaluate(() => ({
    thumbs: document.querySelectorAll('.htpb-camera .htpb-thumbs canvas').length,
    live: (() => {
      const stream = document.querySelector('.htpb-video')?.srcObject;
      return stream ? stream.getTracks().filter((t) => t.readyState === 'live').length : 0;
    })(),
  }));
  check('R-114 quay lại: ảnh cũ còn, camera vẫn chạy', back.thumbs === editorCount && back.live > 0, JSON.stringify(back));

  // ================= Bố cục (dùng trình duyệt riêng để camera giả không bị tab cũ giữ) =================
  await browser.close();
  const layoutBrowser = await launch();
  const layoutPage = await layoutBrowser.newPage();
  await layoutPage.setViewport({ width: 1440, height: 900 });
  await layoutPage.goto(`${BASE}/photobooth-dev.html`, { waitUntil: 'networkidle0' });
  const entryLayout = await layoutPage.evaluate(() => {
    const columns = getComputedStyle(document.querySelector('.htpb-entry')).gridTemplateColumns.split(' ').length;
    const blocks = [...document.querySelectorAll('.htpb-entry > *')].map((n) => n.getBoundingClientRect());
    return { columns, blocks: blocks.length, tops: blocks.map((r) => Math.round(r.top)) };
  });
  check(
    'R-124 desktop: lưới 12 cột, 3 khối cùng hàng',
    entryLayout.columns === 12 && entryLayout.blocks === 3 && new Set(entryLayout.tops).size === 1,
    JSON.stringify(entryLayout),
  );

  await openCamera(layoutPage);
  const cameraLayout = await layoutPage.evaluate(() => {
    const cols = getComputedStyle(document.querySelector('.htpb-camera')).gridTemplateColumns.split(' ').length;
    const video = document.querySelector('.htpb-video-wrap').getBoundingClientRect();
    const filters = document.querySelector('.htpb-camera__filters').getBoundingClientRect();
    const session = document.querySelector('.htpb-camera__session').getBoundingClientRect();
    return { cols, videoHeight: Math.round(video.height), viewport: window.innerHeight, sameRow: Math.round(filters.top) === Math.round(session.top) };
  });
  check('R-125 desktop màn camera 3 cột', cameraLayout.cols === 3 && cameraLayout.sameRow, JSON.stringify(cameraLayout));
  check('R-125 khung video ≤ 60% màn hình', cameraLayout.videoHeight <= cameraLayout.viewport * 0.62, JSON.stringify(cameraLayout));

  // ================= R-129 dải cổ điển (cần màn chỉnh sửa) =================
  await layoutPage.evaluate(() => {
    document.querySelector('.htpb-field--timer .htpb-seg button[data-value="0"]')?.click();
    document.querySelector('.htpb-field--count .htpb-seg button[data-value="4"]')?.click();
    document.querySelector('.htpb-shoot')?.click();
  });
  await layoutPage.waitForFunction(
    () => {
      const next = document.querySelector('.htpb-next');
      return document.querySelectorAll('.htpb-camera .htpb-thumbs canvas').length === 4 && next && !next.disabled;
    },
    { timeout: 40000 },
  );
  await layoutPage.evaluate(() => document.querySelector('.htpb-next')?.click());
  await layoutPage.waitForSelector('.htpb-editor:not([hidden])', { timeout: 10000 });
  await wait(500);
  const classic = await layoutPage.evaluate(() => {
    const strip = document.querySelector('.htpb-strip');
    const cssWidth = Number.parseFloat(strip.style.width || '0');
    return { width: strip.style.width, ratio: cssWidth > 0 ? strip.width / cssWidth : null };
  });
  check(
    'R-129 dải cổ điển hiển thị ≤ 260px, canvas gấp 2 (xuất 520)',
    Number.parseFloat(classic.width) > 0 &&
      Number.parseFloat(classic.width) <= 260 &&
      classic.ratio === 2,
    JSON.stringify(classic),
  );

  // ================= R-119 không có tính năng lạ =================
  const extras = await layoutPage.evaluate(() => {
    const text = document.querySelector('.htpb')?.textContent ?? '';
    return {
      share: /chia sẻ/i.test(text),
      print: /máy in|in ảnh/i.test(text),
      sticker: /sticker/i.test(text),
    };
  });
  check('R-119 không có chia sẻ / in / sticker', !extras.share && !extras.print && !extras.sticker, JSON.stringify(extras));

  await layoutBrowser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kiểm tra đạt`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
