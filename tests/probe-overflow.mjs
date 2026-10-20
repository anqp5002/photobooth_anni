import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = 'D:/projects/hanh-trinh';
const SERVER = path.join(ROOT, 'impl', 'server');
const PORT = 8978;
const BASE = `http://127.0.0.1:${PORT}`;
const TARGET = process.argv[2] || '/dong-thoi-gian';

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ht-overflow-'));
const env = {
  ...process.env,
  DB_PATH: path.join(tmp, 'db.sqlite'),
  MEDIA_DIR: path.join(tmp, 'media'),
  AI_PROVIDER: 'mock',
  PORT: String(PORT),
  HOST: '127.0.0.1',
};
execFileSync(process.execPath, ['scripts/seed-family.js'], { cwd: SERVER, env, stdio: 'ignore' });
const server = spawn(process.execPath, ['src/index.js'], { cwd: SERVER, env, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.request.post(`${BASE}/api/auth/login`, {
  data: { email: 'bo@bin-su.vn', password: 'kyniem123' },
});
const page = await context.newPage();
await page.goto(`${BASE}${TARGET}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.right > vw + 1 || rect.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 60)) || '',
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      });
    }
  }
  const imgs = Array.from(document.querySelectorAll('img')).map((n) => n.getAttribute('src') ?? '');
  return {
    vw,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    images: imgs.length,
    imageSrcs: imgs.slice(0, 6),
    text: (document.body.innerText || '').slice(0, 260),
    offenders: offenders.slice(0, 12),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
server.kill();
await new Promise((r) => setTimeout(r, 1200));
await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
