import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage();
page.on('console', (m) => console.log('console:', m.type(), m.text().slice(0, 300)));
await page.goto('http://localhost:5199/muc-dev.html?id=he-da-lat', { waitUntil: 'networkidle2' });
const out = await page.evaluate(async () => {
  const mod = await import('/src/dev/mock/index.ts');
  const d = mod.mockGet('/api/collections/he-da-lat', {});
  return {
    keys: d ? Object.keys(d) : null,
    daysType: d ? Array.isArray(d.days) : 'no data',
    detailKeys: Object.keys(mod.collectionDetails),
    stringified: JSON.stringify(d).slice(0, 200),
  };
});
console.log(out);
await browser.close();
