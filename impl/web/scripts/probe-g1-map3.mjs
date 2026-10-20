import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const url of [
  'http://localhost:5199/muc/he-da-lat',
  'http://localhost:5199/muc-dev.html?id=he-da-lat',
]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await wait(4000);
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('.muc-page .mini canvas');
    const mini = document.querySelector('.muc-page .mini');
    const cs = mini ? getComputedStyle(mini) : null;
    return {
      canvasRect: canvas ? JSON.stringify(canvas.getBoundingClientRect()) : null,
      miniRect: mini ? JSON.stringify(mini.getBoundingClientRect()) : null,
      miniZ: cs?.zIndex,
      miniPos: cs?.position,
      miniOpacity: cs?.opacity,
      canvases: document.querySelectorAll('.muc-page .mini canvas').length,
      miniClass: mini?.className,
    };
  });
  console.log(url, info);
  await page.close();
}
await browser.close();
