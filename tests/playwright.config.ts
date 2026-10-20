// Config Playwright r2: chạy cùng server triển khai — máy chủ phục vụ API (hợp đồng API r2,
// MEGAPLAN_r2.md) lẫn SPA web (9 trang: /, /tong-ket/:year, /muc/:id, /ban-do, /dong-thoi-gian,
// /tim-kiem, /tai-anh, /photobooth, /dang-nhap).
// Camera giả theo yêu cầu photobooth: --use-fake-device-for-media-stream --use-fake-ui-for-media-stream.
// Test r1 (sản phẩm cũ) đã chuyển sang tests/r1-old/ và KHÔNG chạy nữa.
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.TEST_PORT || '8931';
const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalTimeout: 25 * 60_000,
  use: {
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
    trace: 'off',
    locale: 'vi-VN',
  },
  projects: [
    {
      name: 'api',
      testMatch: '**/api/*.spec.ts',
      testIgnore: '**/r1-old/**',
    },
    {
      name: 'web',
      testMatch: '**/web/*.spec.ts',
      testIgnore: ['**/web/*.mobile.spec.ts', '**/r1-old/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testMatch: '**/web/*.mobile.spec.ts',
      testIgnore: '**/r1-old/**',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
});
