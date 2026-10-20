import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { chromium } from '@playwright/test';

const ROOT = 'D:/projects/hanh-trinh';
const SERVER = path.join(ROOT, 'impl', 'server');
const PORT = 8977;
const BASE = `http://127.0.0.1:${PORT}`;

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ht-probe-'));
const env = {
  ...process.env,
  DB_PATH: path.join(tmp, 'db.sqlite'),
  MEDIA_DIR: path.join(tmp, 'media'),
  AI_PROVIDER: 'mock',
  PORT: String(PORT),
  HOST: '127.0.0.1',
};
const { execFileSync } = await import('node:child_process');
execFileSync(process.execPath, ['scripts/seed-family.js'], { cwd: SERVER, env, stdio: 'ignore' });
const server = spawn(process.execPath, ['src/index.js'], { cwd: SERVER, env, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.request.post(`${BASE}/api/auth/login`, {
  data: { email: 'bo@bin-su.vn', password: 'kyniem123' },
});
const page = await context.newPage();
page.on('console', (m) => console.log('  [console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(`${BASE}/dong-thoi-gian`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const chip = document.querySelector('.tlx-chip');
  const box = chip?.getBoundingClientRect();
  const style = chip ? getComputedStyle(chip) : null;
  return {
    chips: document.querySelectorAll('.tlx-chip').length,
    dayHead: document.querySelector('.tlx-day-head')?.textContent ?? null,
    heads: Array.from(document.querySelectorAll('.tlx-day-head')).slice(0, 3).map((n) => n.textContent),
    months: document.querySelectorAll('.tl-month').length,
    items: document.querySelectorAll('.tl-item').length,
    monthGrids: document.querySelectorAll('.tlx-mgrid').length,
    dayCells: document.querySelectorAll('.tlx-day').length,
    hotCells: document.querySelectorAll('.tlx-day.hot').length,
    chipBox: box ? { x: box.x, y: box.y, w: box.width, h: box.height } : null,
    chipStyle: style
      ? {
          display: style.display,
          color: style.color,
          background: style.backgroundColor,
          visibility: style.visibility,
          opacity: style.opacity,
          overflow: style.overflow,
          position: style.position,
          fontSize: style.fontSize,
        }
      : null,
    headStyle: (() => {
      const head = document.querySelector('.tlx-day-head');
      if (!head) return null;
      const s = getComputedStyle(head);
      return { display: s.display, overflow: s.overflow, height: s.height, flexWrap: s.flexWrap };
    })(),
  };
});
console.log('DOM:', JSON.stringify(info, null, 1));
const api = await context.request.get(`${BASE}/api/collections?year=2026`);
const list = await api.json();
console.log('API collections:', list.length, list.map((c) => `${c.id}:${c.title}`).join(' | '));
await browser.close();
server.kill();
await new Promise((r) => setTimeout(r, 1500));
await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
