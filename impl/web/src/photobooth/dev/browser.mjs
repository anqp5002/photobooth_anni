/** Tìm Chromium của Playwright trên máy (bản cài có thể đổi số hiệu giữa các lần cài). */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const root =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    path.join(process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? '', 'AppData', 'Local'), 'ms-playwright');
  if (existsSync(root)) {
    // Ưu tiên bản chromium đầy đủ (có camera giả), mới nhất trước.
    const candidates = readdirSync(root)
      .filter((name) => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const dir of candidates) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {
        const exe = path.join(root, dir, rel);
        if (existsSync(exe)) return exe;
      }
    }
    const shells = readdirSync(root)
      .filter((name) => name.startsWith('chromium_headless_shell-'))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const dir of shells) {
      for (const rel of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-win32/chrome-headless-shell.exe']) {
        const exe = path.join(root, dir, rel);
        if (existsSync(exe)) return exe;
      }
    }
  }
  const probes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  return probes.find((p) => existsSync(p)) ?? null;
}
