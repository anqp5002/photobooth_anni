/**
 * Smoke r2: 9 trang của web kỷ niệm gia đình (MEGAPLAN_r2.md → "Trang (SPA)").
 *
 * Mỗi trang phải: mở được (đã đăng nhập bo@bin-su.vn), không lỗi console, không tràn ngang
 * ở cả 1440x900 và 390x844. Thêm: 4 câu tìm kiếm mẫu phải ra kết quả.
 *
 * Chạy: npx playwright test --config=playwright.config.ts
 * (máy chủ phải chạy sẵn với dữ liệu seed; xem test.sh)
 */
import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'bo@bin-su.vn';
const PASSWORD = 'kyniem123';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];

const SAMPLE_QUERIES = [
  'ảnh sinh nhật Su năm nay',
  'đi biển tháng 8',
  'Tết ở quê',
  'ảnh có bánh kem',
];

async function login(page: Page): Promise<void> {
  const res = await page.request.post('/api/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), `đăng nhập ${EMAIL} phải thành công`).toBeTruthy();
}

/** Id của một mục kỷ niệm (mục đầu tiên của gia đình) để dựng URL /muc/<id>. */
async function firstCollectionId(page: Page): Promise<number> {
  const res = await page.request.get('/api/collections?year=2026');
  expect(res.ok(), 'GET /api/collections phải thành công').toBeTruthy();
  const list = await res.json();
  expect(Array.isArray(list) && list.length > 0, 'gia đình phải có ít nhất 1 mục').toBeTruthy();
  return list[0].id;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    // "Failed to load resource" bị bỏ: URL cụ thể đã được ghi ở collector 'response' bên dưới.
    if (message.type() === 'error' && !/Failed to load resource/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  // Ghi lại URL nào trả 4xx/5xx để REPORT nói rõ thiếu route hay thiếu tài nguyên.
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  return errors;
}

test.describe('r2 smoke — 9 trang', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('có dữ liệu seed: 7 mục, 4 câu tìm kiếm mẫu có kết quả', async ({ page }) => {
    const collections = await page.request.get('/api/collections?year=2026');
    expect(collections.ok()).toBeTruthy();
    const list = await collections.json();
    expect(list.length, 'phải có 7 mục kỷ niệm').toBe(7);

    for (const query of SAMPLE_QUERIES) {
      const res = await page.request.get(`/api/search?q=${encodeURIComponent(query)}`);
      expect(res.ok(), `tìm kiếm "${query}" phải trả 200`).toBeTruthy();
      const payload = await res.json();
      expect(
        Array.isArray(payload.results) && payload.results.length >= 1,
        `tìm kiếm "${query}" phải ra ít nhất 1 kết quả`,
      ).toBeTruthy();
    }
  });

  test('trang chủ / mở được, không lỗi console, không tràn ngang', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      expect(errors, `lỗi console ở / (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở / (${viewport.name})`).toBeLessThanOrEqual(1);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('tổng kết /tong-ket/2026 mở được, không lỗi console, không tràn ngang', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto('/tong-ket/2026', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      expect(errors, `lỗi console ở /tong-ket/2026 (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở /tong-ket/2026 (${viewport.name})`).toBeLessThanOrEqual(1);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('mục /muc/<id> mở được, không lỗi console, không tràn ngang', async ({ page }) => {
    const id = await firstCollectionId(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto(`/muc/${id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      expect(errors, `lỗi console ở /muc/${id} (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở /muc/${id} (${viewport.name})`).toBeLessThanOrEqual(1);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('bản đồ /ban-do mở được, không lỗi console, không tràn ngang', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto('/ban-do', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      expect(errors, `lỗi console ở /ban-do (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở /ban-do (${viewport.name})`).toBeLessThanOrEqual(1);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('dòng thời gian /dong-thoi-gian mở được, không lỗi console, không tràn ngang', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto('/dong-thoi-gian', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      expect(errors, `lỗi console ở /dong-thoi-gian (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở /dong-thoi-gian (${viewport.name})`).toBeLessThanOrEqual(1);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('tìm kiếm /tim-kiem mở được và ra kết quả cho 4 câu mẫu', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      for (const query of SAMPLE_QUERIES) {
        await page.goto(`/tim-kiem?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(700);
        const images = await page.locator('img[src*="/media/"]').count();
        expect(images, `"${query}" (${viewport.name}) phải ra ít nhất 1 ảnh kết quả`).toBeGreaterThan(0);
      }
      expect(errors, `lỗi console ở /tim-kiem (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở /tim-kiem (${viewport.name})`).toBeLessThanOrEqual(1);
    }
  });

  test('tải ảnh /tai-anh mở được, không lỗi console, không tràn ngang', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto('/tai-anh', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      expect(errors, `lỗi console ở /tai-anh (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở /tai-anh (${viewport.name})`).toBeLessThanOrEqual(1);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('photobooth /photobooth?muc=<id> mở được, không lỗi console, không tràn ngang', async ({ page }) => {
    const id = await firstCollectionId(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto(`/photobooth?muc=${id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      expect(errors, `lỗi console ở /photobooth (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở /photobooth (${viewport.name})`).toBeLessThanOrEqual(1);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('đăng nhập /dang-nhap mở được, không lỗi console, không tràn ngang', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = collectErrors(page);
      await page.goto('/dang-nhap', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      expect(errors, `lỗi console ở /dang-nhap (${viewport.name})`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `tràn ngang ở /dang-nhap (${viewport.name})`).toBeLessThanOrEqual(1);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });
});
