/**
 * Chụp màn hình các trang r2 ở 1440x900 và 390x844.
 *
 * Dùng:  node scripts/shoot-r2.mjs --out <thư mục> --tag <F1> --route <tên>=<đường dẫn> ...
 * Cần máy chủ tĩnh phục vụ dist/ (npm run preview -- --port 4173) hoặc dev server.
 *
 * Mặc định chụp mọi trang của hợp đồng r2. Thêm --menu để mở drawer ở khổ 390.
 * Biến môi trường: BASE_URL (mặc định http://127.0.0.1:4173).
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

let BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';

const DEFAULT_ROUTES = [
  ['home', '/'],
  ['tong-ket', '/tong-ket/2026'],
  ['muc', '/muc/he-da-lat'],
  ['ban-do', '/ban-do'],
  ['dong-thoi-gian', '/dong-thoi-gian'],
  ['tim-kiem', '/tim-kiem?q=anh%20sinh%20nhat%20Su%20nam%20nay'],
  ['tai-anh', '/tai-anh'],
  ['photobooth', '/photobooth?muc=he-da-lat'],
  ['dang-nhap', '/dang-nhap'],
];

function parseArgs(argv) {
  const args = {
    out: 'D:/projects/hanh-trinh/shots/dev',
    tag: 'r2',
    routes: [],
    menu: false,
    full: false,
    scroll: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--out') args.out = argv[++i];
    else if (key === '--tag') args.tag = argv[++i];
    else if (key === '--base') BASE = argv[++i].replace(/\/+$/, '');
    else if (key === '--menu') args.menu = true;
    else if (key === '--full') args.full = true;
    else if (key === '--scroll') args.scroll = Number(argv[++i]) || 0;
    else if (key === '--route') {
      const value = argv[++i];
      const eq = value.indexOf('=');
      args.routes.push([value.slice(0, eq), value.slice(eq + 1)]);
    }
  }
  if (args.routes.length === 0) args.routes = DEFAULT_ROUTES;
  return args;
}

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Không tìm thấy Chrome/Edge để chụp màn hình');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

async function shoot(browser, { out, tag, slug, path, viewport, openMenu, full, scroll }) {
  const page = await browser.newPage();
  const errors = [];
  const failed = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
  });
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2200);
  if (openMenu) {
    await page.click('.burger');
    await sleep(700);
  }
  if (scroll > 0) {
    await page.evaluate((top) => window.scrollTo(0, top), scroll);
    // Chờ đủ lâu cho hiệu ứng hiện dần và đếm số chạy xong.
    await sleep(2200);
  }
  const suffix = scroll > 0 ? `-${scroll}` : '';
  const file = `${out}/${tag}-${slug}-${viewport.width}${suffix}.png`;
  await page.screenshot({ path: file, fullPage: full });
  await page.close();
  console.log(`✓ ${file}${errors.length ? ` — lỗi console: ${errors.length}` : ''}`);
  for (const error of errors.slice(0, 5)) console.log(`    ! ${error}`);
  for (const entry of failed.slice(0, 5)) console.log(`    ✗ ${entry}`);
  return errors.length + failed.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
      // WebGL trong Chrome headless không có GPU: dùng SwiftShader để bản đồ vẫn chạy.
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });

  let failed = 0;
  for (const [slug, path] of args.routes) {
    for (const viewport of VIEWPORTS) {
      failed += await shoot(browser, {
        out: args.out,
        tag: args.tag,
        slug,
        path,
        viewport,
        openMenu: args.menu && viewport.width === 390,
        full: args.full,
        scroll: args.scroll,
      });
    }
  }

  await browser.close();
  if (failed > 0) {
    console.error(`Có ${failed} trang bị lỗi console.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
