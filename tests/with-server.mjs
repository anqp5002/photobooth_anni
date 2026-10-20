/**
 * Dựng môi trường y như `tests/shots-r2.mjs` (DB + MEDIA tạm → seed → máy chủ thật với
 * AI_PROVIDER=mock) rồi chạy MỘT lệnh bất kỳ với `BASE_URL` trỏ vào máy chủ đó.
 *
 * Dùng để chạy Playwright cho riêng vài trang mà không phải `bash test.sh` (test.sh có
 * `taskkill` giết mọi tiến trình node — nguy hiểm khi phiên opencode đang chạy).
 *
 *   node tests/with-server.mjs npx playwright test --config=playwright.config.ts \
 *        tests/web/r2-smoke.spec.ts -g "tìm kiếm" --project=web
 *
 * Biến môi trường: PORT (mặc định 8981, đặt khác nếu cổng bận), KEEP=1 (giữ DB tạm).
 */
import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SERVER_DIR = path.join(ROOT, 'impl', 'server');
const PORT = Number(process.env.PORT || 8981);
const BASE = `http://127.0.0.1:${PORT}`;

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

/**
 * Trên Windows `npx` là `npx.cmd` và Node 26 từ chối spawn thẳng `.cmd` (EINVAL), nên
 * `npx <x>` được đổi thành `node tests/node_modules/<x>/cli.js`.
 */
function resolveCommand(command) {
  const [name, ...rest] = command;
  if (name === 'npx' && rest[0] === 'playwright') {
    return [process.execPath, [path.join(HERE, 'node_modules', '@playwright', 'test', 'cli.js'), ...rest.slice(1)]];
  }
  return [name, rest];
}

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* chưa lên */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('máy chủ không lên');
}

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error('Thiếu lệnh. Ví dụ: node tests/with-server.mjs npx playwright test ...');
  process.exit(2);
}

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ht-withsrv-'));
const env = {
  ...process.env,
  DB_PATH: path.join(tmp, 'db.sqlite'),
  MEDIA_DIR: path.join(tmp, 'media'),
  AI_PROVIDER: 'mock',
  PORT: String(PORT),
  HOST: '127.0.0.1',
};

console.log(`[with-server] DB tạm: ${env.DB_PATH}`);
await run(process.execPath, ['scripts/seed-family.js'], { cwd: SERVER_DIR, env, stdio: 'pipe' });

console.log(`[with-server] dựng máy chủ ${BASE}…`);
const server = spawn(process.execPath, ['src/index.js'], { cwd: SERVER_DIR, env, stdio: 'pipe' });
const serverLog = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));

let code = 1;
try {
  await waitForServer();
  const [bin, args] = resolveCommand(command);
  code = await run(bin, args, {
    cwd: ROOT,
    env: { ...env, BASE_URL: BASE, TEST_PORT: String(PORT) },
  })
    .then(() => 0)
    .catch((error) => {
      console.error(`[with-server] lệnh lỗi: ${error.message}`);
      return 1;
    });
} catch (error) {
  console.error(`[with-server] ${error.message}`);
  console.error(serverLog.join(''));
} finally {
  server.kill();
  if (process.env.KEEP !== '1') {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  } else {
    console.log(`[with-server] giữ DB tạm: ${tmp}`);
  }
}

process.exit(code);
