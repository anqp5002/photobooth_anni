/**
 * Kiểm tra trang /login trong trình duyệt với máy chủ thật (cùng origin 8787).
 * Dùng: node scripts/check-login.mjs
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let passed = 0;
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const stamp = Date.now();
const username = `web${stamp % 100000}`;
const email = `web${stamp}@example.com`;

/* --- Đăng ký --- */
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(800);

await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.login-tab')].find((b) =>
    b.textContent.includes('Đăng ký'),
  );
  tab?.click();
});
await sleep(300);

const fields = await page.$$('.login-input');
await fields[0].type(username);
await fields[1].type('Tên hiển thị');
await fields[2].type(email);
await fields[3].type('matkhau123');
await page.click('.login-submit');
await sleep(1800);

const afterRegister = await page.evaluate(() => ({
  url: location.pathname,
  error: document.querySelector('.login-error')?.textContent ?? '',
  headerName: document.querySelector('.header-user-name')?.textContent ?? '',
  headerLink: document.querySelector('.header-login')?.textContent ?? '',
}));
ok('đăng ký → chuyển tới /me', afterRegister.url === '/me', `url ${afterRegister.url}`);
ok('đăng ký → thanh đầu hiện tên người dùng', afterRegister.headerName === 'Tên hiển thị', afterRegister.headerName);
ok('đăng ký → nút "chuyến của tôi" thay cho "đăng nhập"', afterRegister.headerLink.includes('chuyến của tôi'), afterRegister.headerLink);

/* --- Tên bị cấm --- */
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(800);
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.login-tab')].find((b) =>
    b.textContent.includes('Đăng ký'),
  );
  tab?.click();
});
await sleep(300);
const fields2 = await page.$$('.login-input');
await fields2[0].type('photobooth');
await fields2[2].type(`cam${stamp}@example.com`);
await fields2[3].type('matkhau123');
await page.click('.login-submit');
await sleep(700);
const reserved = await page.evaluate(() => ({
  error: document.querySelector('.login-error')?.textContent ?? '',
  url: location.pathname,
}));
ok('tên cấm → báo lỗi bằng chữ, không chuyển trang', reserved.error.length > 5 && reserved.url === '/login', reserved.error);

/* --- Sai mật khẩu --- */
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.login-tab')].find((b) =>
    b.textContent.includes('Đăng nhập'),
  );
  tab?.click();
});
await sleep(300);
const fields3 = await page.$$('.login-input');
await fields3[0].type(email);
await fields3[1].type('saimatkhau');
await page.click('.login-submit');
await sleep(900);
const wrong = await page.evaluate(() => ({
  error: document.querySelector('.login-error')?.textContent ?? '',
  url: location.pathname,
}));
ok('sai mật khẩu → báo lỗi bằng chữ', wrong.error.length > 5 && wrong.url === '/login', wrong.error);

/* --- Đăng nhập đúng --- */
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(800);
const fields4 = await page.$$('.login-input');
await fields4[0].type(email);
await fields4[1].type('matkhau123');
await page.click('.login-submit');
await sleep(1800);
const afterLogin = await page.evaluate(() => ({
  url: location.pathname,
  headerName: document.querySelector('.header-user-name')?.textContent ?? '',
}));
ok('đăng nhập đúng → chuyển tới /me', afterLogin.url === '/me', `url ${afterLogin.url}`);
ok('đăng nhập đúng → thanh đầu hiện tên', afterLogin.headerName.length > 0, afterLogin.headerName);

/* --- Đăng xuất --- */
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await sleep(800);
const loggedOut = await page.evaluate(() => ({
  btn: document.querySelector('.header-login')?.textContent ?? '',
}));
ok('phiên còn hiệu lực → vẫn hiện tên', !loggedOut.btn.includes('đăng nhập'), loggedOut.btn);

await browser.close();
console.log(`\nKết quả: ${passed} pass, ${failed} fail`);
process.exit(failed === 0 ? 0 : 1);
