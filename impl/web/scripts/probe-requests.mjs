/**
 * T10d — ghi lại các request API mà trang chuyến gọi khi mở (SPEC R-036).
 * Dùng: node scripts/probe-requests.mjs [baseUrl] [tripPath]
 */
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8822';
const TRIP_PATH = process.argv[3] ?? '/minh/1-xuyen-viet';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

const requests = [];
const startedAt = new Map();
page.on('request', (req) => {
  if (req.url().includes('/api/')) startedAt.set(req, Date.now());
});
page.on('response', (res) => {
  const url = res.url();
  if (!url.includes('/api/')) return;
  const began = startedAt.get(res.request());
  requests.push({
    method: res.request().method(),
    url: url.replace(BASE, ''),
    status: res.status(),
    ms: began === undefined ? null : Date.now() - began,
  });
});

const started = Date.now();
await page.goto(`${BASE}${TRIP_PATH}`, { waitUntil: 'domcontentloaded' });
// R-024: thẻ chặng đầu phải hiện dưới 2 giây (không bị chặn bởi lời gọi hồ sơ).
const firstCard = await page
  .waitForSelector('.step-card', { timeout: 10000 })
  .then(() => Date.now() - started)
  .catch(() => null);
await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
const elapsed = Date.now() - started;

const rendered = await page.evaluate(() => ({
  title: document.querySelector('.trip-title-text')?.textContent ?? null,
  cards: document.querySelectorAll('.step-card').length,
  author: document.querySelector('.trip-author-name')?.textContent ?? null,
  avatar: document.querySelector('.trip-author .avatar')?.getAttribute('src')?.slice(0, 40) ?? null,
  firstCardAt: null,
}));

console.log(`Mở ${BASE}${TRIP_PATH}`);
console.log('— Request tới /api/ —');
for (const r of requests) {
  console.log(`  ${r.method} ${r.url} → ${r.status}${r.ms !== null ? ` (${r.ms}ms)` : ''}`);
}
console.log(`— Trang render sau ~${elapsed}ms —`);
console.log(`  thẻ chặng đầu hiện sau ${firstCard ?? '>10000'}ms (R-024: dưới 2000ms)`);
console.log(`  tiêu đề: ${rendered.title}`);
console.log(`  tác giả: ${rendered.author}`);
console.log(`  avatar: ${rendered.avatar}`);
console.log(`  số thẻ chặng: ${rendered.cards}`);

const wantUser = requests.some((r) => r.url.startsWith('/api/users/'));
const wantTrip = requests.some((r) => r.url.startsWith('/api/trips/'));
const allOk = requests.filter((r) => r.url.startsWith('/api/users/') || r.url.startsWith('/api/trips/')).every((r) => r.status === 200);
console.log(
  `\nR-036: GET /api/users/<tên> = ${wantUser ? 'CÓ' : 'THIẾU'} · GET /api/trips/<id> = ${wantTrip ? 'CÓ' : 'THIẾU'} · tất cả 200 = ${allOk ? 'CÓ' : 'KHÔNG'}`,
);

await browser.close();

/* Thêm: hồ sơ lỗi/404 thì chuyến vẫn phải hiện (dùng trip.author). */
const browser2 = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
});
const page2 = await browser2.newPage();
await page2.setRequestInterception(true);
page2.on('request', (req) => {
  if (req.url().includes('/api/users/')) {
    req.respond({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
    return;
  }
  req.continue();
});
await page2.goto(`${BASE}${TRIP_PATH}`, { waitUntil: 'networkidle0' });
await wait(1200);
const fallback = await page2.evaluate(() => ({
  cards: document.querySelectorAll('.step-card').length,
  author: document.querySelector('.trip-author-name')?.textContent ?? null,
  error: document.querySelector('.error-title')?.textContent ?? null,
}));
console.log(
  `\n— Hồ sơ 404 (mô phỏng) — thẻ chặng: ${fallback.cards} · tác giả: ${fallback.author} · trang lỗi: ${fallback.error ?? 'không có'}`,
);
await browser2.close();
process.exit(wantUser && wantTrip && allOk && fallback.cards > 0 ? 0 : 1);
