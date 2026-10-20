/**
 * Chụp màn hình trang chuyến (Playwright không cần — dùng Chrome đã cài).
 * Chạy:  node scripts/shoot.mjs
 * Cần một máy chủ tĩnh phục vụ dist/ (ví dụ: npm run preview -- --port 4173)
 */
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const OUT = process.env.SHOTS_DIR ?? 'D:/projects/hanh-trinh/shots';
const TRIP = process.env.TRIP_URL ?? `${BASE}/minh/tripxuyenviet-xuyen-viet`;
const FIRST_STEP = process.env.FIRST_STEP ?? 's-hanoi-ha-noi';

async function findChrome() {
  const { existsSync } = await import('node:fs');
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Không tìm thấy Chrome/Edge để chụp màn hình');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shoot(browser, { name, width, height, url, before, wait = 3200 }) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(wait);
  if (before) {
    await before(page);
    await sleep(1400);
  }
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  await page.close();
  console.log(`✓ ${name}.png (${width}x${height})${errors.length ? ` — lỗi console: ${errors.length}` : ''}`);
  if (errors.length) errors.slice(0, 6).forEach((e) => console.log(`    ! ${e}`));
  return file;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const executablePath = await findChrome();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  await shoot(browser, {
    name: '1440-home',
    width: 1440,
    height: 900,
    url: BASE,
  });

  await shoot(browser, {
    name: '390-home',
    width: 390,
    height: 844,
    url: BASE,
  });

  await shoot(browser, {
    name: '1440-login',
    width: 1440,
    height: 900,
    url: `${BASE}/login`,
  });

  await shoot(browser, {
    name: '390-login',
    width: 390,
    height: 844,
    url: `${BASE}/login`,
  });

  await shoot(browser, {
    name: '1440-home-cuon',
    width: 1440,
    height: 900,
    url: BASE,
    before: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 900));
    },
  });

  await shoot(browser, {
    name: '1440-bento',
    width: 1440,
    height: 900,
    url: BASE,
    before: async (page) => {
      await page.evaluate(() => {
        document.querySelector('.bento')?.scrollIntoView({ block: 'center' });
      });
    },
  });

  await shoot(browser, {
    name: '1440-trip',
    width: 1440,
    height: 900,
    url: TRIP,
  });

  await shoot(browser, {
    name: '390-trip',
    width: 390,
    height: 844,
    url: TRIP,
  });

  await shoot(browser, {
    name: '390-story',
    width: 390,
    height: 844,
    url: `${TRIP}/${FIRST_STEP}`,
    before: async (page) => {
      await page.evaluate(() => {
        localStorage.setItem('hanh-trinh:story-guide-seen', '1');
      });
      await page.reload({ waitUntil: 'networkidle2' });
      await sleep(2600);
    },
  });

  await shoot(browser, {
    name: '390-story-huong-dan',
    width: 390,
    height: 844,
    url: `${TRIP}/${FIRST_STEP}`,
    before: async (page) => {
      await page.evaluate(() => {
        localStorage.removeItem('hanh-trinh:story-guide-seen');
      });
      await page.reload({ waitUntil: 'networkidle2' });
      await sleep(2600);
    },
  });

  await shoot(browser, {
    name: '1440-dialog',
    width: 1440,
    height: 900,
    url: TRIP,
    before: async (page) => {
      await page.waitForSelector('.photo-item', { timeout: 20000 });
      await page.click('.photo-item');
    },
  });

  await shoot(browser, {
    name: '1440-mo-ta-dai',
    width: 1440,
    height: 900,
    url: TRIP,
    before: async (page) => {
      await page.waitForSelector('.step-card', { timeout: 20000 });
      await page.evaluate(() => {
        const card = document.querySelector('#step-s-dalat');
        card?.scrollIntoView({ block: 'start' });
      });
      await sleep(900);
    },
  });

  await shoot(browser, {
    name: '1440-profile',
    width: 1440,
    height: 900,
    url: `${BASE}/minh`,
  });

  await shoot(browser, {
    name: '1440-photobooth',
    width: 1440,
    height: 900,
    url: `${BASE}/photobooth?title=Xuyên Việt`,
  });

  await shoot(browser, {
    name: '1440-error',
    width: 1440,
    height: 900,
    url: `${BASE}/khong-co-ai/999-abc`,
  });

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
