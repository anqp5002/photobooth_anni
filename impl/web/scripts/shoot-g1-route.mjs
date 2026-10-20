import puppeteer from 'puppeteer-core';

/** Chụp trang mục qua route thật của router r2 (`/muc/:id`). */
const BASE = process.argv[2] ?? 'http://localhost:5199';
const OUT = 'D:/projects/hanh-trinh/shots/dev';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(name, width, height, url, scroll = 0) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(1800);
  if (scroll) {
    await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await wait(1000);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const headers = await page.evaluate(() => ({
    ann: document.querySelectorAll('.ann').length,
    hd: document.querySelectorAll('.hd').length,
    cover: document.querySelectorAll('.cover').length,
    title: document.querySelector('.cover h1')?.textContent ?? null,
  }));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, JSON.stringify({ overflow, ...headers }), errors.length ? errors : '');
  await page.close();
}

await shot('g1-route-1440', 1440, 900, `${BASE}/muc/he-da-lat`);
await shot('g1-route-390', 390, 844, `${BASE}/muc/he-da-lat`);
await browser.close();
