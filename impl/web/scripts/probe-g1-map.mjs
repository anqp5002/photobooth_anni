import puppeteer from 'puppeteer-core';

/** Kiểm tra bản đồ nhỏ trong card thông tin (route thật `/muc/:id`). */
const BASE = process.argv[2] ?? 'http://localhost:5199';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const failed = [];
page.on('requestfailed', (r) => failed.push(`${r.url().slice(0, 80)} :: ${r.failure()?.errorText}`));
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/muc/he-da-lat`, { waitUntil: 'networkidle2' });
await wait(4000);
const info = await page.evaluate(() => {
  const box = document.querySelector('.muc-page .mini');
  const canvas = document.querySelector('.muc-page .mini canvas');
  const markers = document.querySelectorAll('.muc-page .mk').length;
  return {
    miniExists: !!box,
    canvas: !!canvas,
    canvasSize: canvas ? `${canvas.clientWidth}x${canvas.clientHeight}` : null,
    markers,
    miniBg: box ? getComputedStyle(box).backgroundColor : null,
    cardH: document.querySelector('.muc-page .mapc')?.getBoundingClientRect().height,
  };
});
console.log(info, failed.slice(0, 5));
await page.screenshot({ path: 'D:/projects/hanh-trinh/shots/dev/g1-route-map.png', clip: { x: 660, y: 760, width: 700, height: 140 } });
await browser.close();
