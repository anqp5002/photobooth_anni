import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:5199/muc-dev.html?id=he-da-lat', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
const info = await page.evaluate(() => {
  const el = document.elementFromPoint(727, 450);
  const chain = [];
  let node = el;
  while (node && chain.length < 5) {
    chain.push(`${node.tagName}.${node.className} ${node.getBoundingClientRect().width}x${node.getBoundingClientRect().height}`);
    node = node.parentElement;
  }
  return {
    chain,
    dialogOpen: document.querySelector('dialog')?.open,
    dialogRect: (() => {
      const d = document.querySelector('dialog');
      if (!d) return null;
      const r = d.getBoundingClientRect();
      return { w: r.width, h: r.height, display: getComputedStyle(d).display };
    })(),
    markers: document.querySelectorAll('.muc-page .mk').length,
  };
});
console.log(info);
await browser.close();
