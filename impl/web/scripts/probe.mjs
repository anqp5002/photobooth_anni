import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const PATHNAME = process.argv[3] ?? '/';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.goto(`${BASE}${PATHNAME}`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));

const info = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('.credit, .maplibregl-ctrl-attrib, .maplibregl-ctrl-bottom-right')) {
    const box = el.getBoundingClientRect();
    out.push({
      cls: el.className,
      text: (el.textContent ?? '').trim().slice(0, 60),
      top: Math.round(box.top),
      left: Math.round(box.left),
    });
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
