import puppeteer from 'puppeteer-core';

const FLAGS = ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: FLAGS,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => errors.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:5199/muc/he-da-lat', { waitUntil: 'networkidle2' });
await wait(5000);
const info = await page.evaluate(() => {
  const canvas = document.querySelector('.muc-page .mini canvas');
  const mini = document.querySelector('.muc-page .mini');
  return {
    canvasRect: canvas ? canvas.getBoundingClientRect().width + 'x' + canvas.getBoundingClientRect().height : null,
    canvasStyle: canvas ? `${getComputedStyle(canvas).opacity} ${getComputedStyle(canvas).backgroundColor}` : null,
    miniPos: mini ? getComputedStyle(mini).position + ' z' + getComputedStyle(mini).zIndex : null,
    miniBg: mini ? getComputedStyle(mini).backgroundColor : null,
    maplibreCanvasContainer: !!document.querySelector('.maplibregl-canvas-container'),
  };
});
console.log(info);
console.log(errors.slice(0, 8));
await page.evaluate(() => document.querySelector('.muc-page .mapc')?.scrollIntoView({ block: 'center' }));
await wait(2500);
const el = await page.$('.muc-page .mapc');
await el.screenshot({ path: 'D:/projects/hanh-trinh/shots/dev/g1-route-map.png' });
await browser.close();
