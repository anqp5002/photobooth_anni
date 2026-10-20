import puppeteer from 'puppeteer-core';

/** Kiểm tra nhanh các tương tác của trang mục (G1) bằng Chrome thật. */
const BASE = process.argv[2] ?? 'http://localhost:5199';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/muc-dev.html?id=he-da-lat`, { waitUntil: 'networkidle2' });
await wait(1500);

const report = {};

// 1) gợi ý: giữ ẩn
report.sgBefore = await page.$$eval('.muc-page .sg', (n) => n.length);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.muc-page .sg .btn.dac')][0];
  btn?.click();
});
await wait(600);
report.sgDone = await page.$$eval('.muc-page .sg.done', (n) => n.length);
report.toast = await page.$eval('.muc-page .toast', (n) => n.textContent);

// 2) hoàn tác
await page.evaluate(() => {
  document.querySelector('.muc-page .sg.done button')?.click();
});
await wait(500);
report.sgUndone = await page.$$eval('.muc-page .sg.done', (n) => n.length);

// 3) đổi tên
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.muc-page .tools .btn')].find((b) =>
    b.textContent.includes('Đổi tên'),
  );
  btn?.click();
});
await wait(500);
report.renameOpen = await page.$('.muc-page .dialog h2');
await page.evaluate(() => {
  const input = document.querySelector('.muc-page .dialog input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'Đà Lạt tháng 7');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait(200);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.muc-page .dialog .btn')].find((b) =>
    b.textContent.includes('Lưu tên mới'),
  );
  btn?.click();
});
await wait(700);
report.coverTitle = await page.$eval('.muc-page .cover h1', (n) => n.textContent);
report.toastAfterRename = await page.$eval('.muc-page .toast', (n) => n.textContent);

// 4) gắn người
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.muc-page .tools .btn')].find((b) =>
    b.textContent.includes('Gắn người'),
  );
  btn?.click();
});
await wait(600);
report.memberChips = await page.$$eval('.muc-page .member-pick button', (n) => n.length);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.muc-page .member-pick button')];
  btns[btns.length - 1]?.click();
});
await wait(200);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.muc-page .dialog .btn')].find((b) =>
    b.textContent.includes('Lưu người'),
  );
  btn?.click();
});
await wait(600);
report.whoCount = await page.$$eval('.muc-page .who li', (n) => n.length);

// 5) gộp mục
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.muc-page .tools .btn')].find((b) =>
    b.textContent.includes('Gộp mục'),
  );
  btn?.click();
});
await wait(900);
report.mergeOptions = await page.$$eval('.muc-page .dialog .pick label', (n) => n.length);
await page.keyboard.press('Escape');
await wait(300);
await page.evaluate(() => {
  document.querySelector('.muc-page .dialog-bg')?.click();
});
await wait(300);
report.dialogClosed = !(await page.$('.muc-page .dialog-bg'));

report.errors = errors.filter((e) => !e.includes('404'));
console.log(JSON.stringify(report, null, 2));
await browser.close();
