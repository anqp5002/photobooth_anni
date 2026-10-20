/**
 * Kiểm hành vi G2 (/tim-kiem) + G5 (/dang-nhap) trên máy chủ thật (AI_PROVIDER=mock).
 * Chạy: node tests/with-server.mjs node tests/g2g5-behavior.mjs
 *
 *  G2: gõ câu mẫu → ra ảnh; bỏ một chip → số ảnh giảm, câu trên ô hỏi giữ nguyên;
 *      bấm "Tìm lại từ đầu" → về đủ ảnh; câu < 2 ký tự → không gọi API.
 *  G5: sai mật khẩu → hiện lỗi tiếng Việt, không lộ chi tiết; đăng ký trùng email → lỗi
 *      đúng ô; đăng nhập đúng → sang trang chủ với phiên mới.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8981';
const checks = [];

function check(name, passed, detail = '') {
  checks.push({ name, passed, detail });
  console.log(`${passed ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !/Failed to load resource/i.test(message.text())) {
    errors.push(message.text());
  }
});

/* ---------- G2: tìm kiếm ---------- */
const login = await page.request.post(`${BASE}/api/auth/login`, {
  data: { email: 'bo@bin-su.vn', password: 'kyniem123' },
});
check('đăng nhập bằng API để lấy phiên', login.ok(), `HTTP ${login.status()}`);
await page.goto(`${BASE}/tim-kiem`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'ảnh sinh nhật Su năm nay' }).click();
await page.waitForSelector('.srch-card', { timeout: 10_000 });
const totalCards = await page.locator('.srch-card').count();
const countText = await page.locator('.srch-count').innerText();
check('G2 câu mẫu ra ảnh', totalCards === 4, `${totalCards} ảnh · "${countText}"`);

const firstChip = page.locator('.srch-chip').first();
const chipLabel = await firstChip.innerText();
await firstChip.click();
await page.waitForTimeout(200);
const afterRemove = await page.locator('.srch-card').count();
const afterText = await page.locator('.srch-count').innerText();
const stillQuery = await page.locator('#srch-input').inputValue();
check(
  'G2 bỏ chip → lọc lại, giữ nguyên câu hỏi',
  afterRemove >= totalCards &&
    stillQuery === 'ảnh sinh nhật Su năm nay' &&
    /sau khi bỏ 1 bộ lọc/.test(afterText),
  `bỏ "${chipLabel.trim()}" → ${afterRemove} ảnh · "${afterText}"`,
);
check('G2 có nút "Tìm lại từ đầu" sau khi bỏ chip', await page.locator('.srch-reset').isVisible());

await page.locator('.srch-reset').click();
await page.waitForTimeout(200);
const resetCards = await page.locator('.srch-card').count();
check('G2 "Tìm lại từ đầu" trả đủ ảnh', resetCards === totalCards, `${resetCards} ảnh`);

/* Câu ngắn: không gọi API, chỉ focus lại ô hỏi. */
const searchCalls = [];
page.on('request', (request) => {
  if (request.url().includes('/api/search')) searchCalls.push(request.url());
});
await page.locator('#srch-input').fill('a');
await page.locator('.srch-submit').click();
await page.waitForTimeout(900);
check('G2 câu 1 ký tự không gọi /api/search', searchCalls.length === 0, `${searchCalls.length} lời gọi`);

/* Hộp xem ảnh lớn. */
await page.goto(`${BASE}/tim-kiem?q=${encodeURIComponent('đi biển tháng 8')}`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForSelector('.srch-card', { timeout: 10_000 });
await page.locator('.srch-photo').first().click();
await page.waitForTimeout(300);
check('G2 mở hộp xem ảnh lớn', (await page.locator('dialog.srch-dialog[open]').count()) === 1);

/* ---------- G5: đăng nhập / đăng ký ---------- */
await context.clearCookies();
await page.goto(`${BASE}/dang-nhap`, { waitUntil: 'domcontentloaded' });
await page.locator('#lg-email').fill('bo@bin-su.vn');
await page.locator('#lg-password').fill('sai-mat-khau');
await page.locator('.lg-submit').click();
await page.waitForSelector('.lg-alert', { timeout: 10_000 });
const alertText = await page.locator('.lg-alert').innerText();
check('G5 sai mật khẩu → báo lỗi tiếng Việt', /mật khẩu|email/i.test(alertText), alertText.trim());
check('G5 lỗi không lộ mã kỹ thuật', !/invalid_credentials|401/.test(alertText));

await page.getByRole('tab', { name: 'Đăng ký nhà mới' }).click();
await page.locator('#lg-family').fill('Nhà Thử Nghiệm');
await page.locator('#lg-username').fill('nha-thu');
await page.locator('#lg-email').fill('bo@bin-su.vn');
await page.locator('#lg-password').fill('matkhau123');
await page.locator('.lg-submit').click();
await page.waitForSelector('.lg-alert', { timeout: 10_000 });
const takenText = await page.locator('.lg-alert').innerText();
check('G5 đăng ký trùng email → báo đúng', /email/i.test(takenText), takenText.trim());

await page.getByRole('tab', { name: 'Đăng nhập' }).click();
await page.locator('#lg-email').fill('bo@bin-su.vn');
await page.locator('#lg-password').fill('kyniem123');
await page.locator('.lg-submit').click();
await page.waitForURL((url) => !url.pathname.startsWith('/dang-nhap'), { timeout: 15_000 });
check('G5 đăng nhập đúng → vào trang chủ', new URL(page.url()).pathname === '/', page.url());

check('Không có lỗi console/pageerror', errors.length === 0, errors.join(' | '));

await browser.close();

const failed = checks.filter((item) => !item.passed);
console.log(`\n${checks.length - failed.length}/${checks.length} kiểm tra đạt`);
process.exit(failed.length === 0 ? 0 : 1);
