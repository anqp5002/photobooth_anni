/**
 * Plugin Vite: phục vụ ảnh bản mẫu ở đường dẫn `/proto-photos/<tên>.jpg`.
 *
 * Dùng trong `impl/web/vite.config.ts` (việc nối Vite do cmd `w1:pP` làm):
 *
 *   import { defineConfig } from 'vite';
 *   import react from '@vitejs/plugin-react';
 *   import { protoPhotos } from './src/dev/mock/proto-photos-plugin';
 *
 *   export default defineConfig({
 *     plugins: [react(), protoPhotos()],
 *     ...
 *   });
 *
 * Ảnh lấy từ `design/proto/assets/photos/` (CC0 — xem `design/proto/CREDITS.md`).
 * Không copy ảnh vào repo, không sinh ảnh bằng SVG/CSS.
 *
 * Kiểu Node khai báo trong `node-shims.d.ts` (impl/web chưa cài `@types/node`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Tìm thư mục ảnh proto bằng cách đi lên từ thư mục file này. */
function findPhotosDir(): string {
  let dir = HERE;
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(dir, 'design', 'proto', 'assets', 'photos');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Không tìm thấy design/proto/assets/photos');
}

const PHOTOS_DIR = findPhotosDir();
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function servePhoto(req: { url?: string }, res: any, next: () => void): void {
  const raw = (req.url ?? '').split('?')[0];
  const name = decodeURIComponent(raw).replace(/^\/+/, '');
  if (!/^[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(name)) {
    next();
    return;
  }
  const file = path.join(PHOTOS_DIR, name);
  if (!file.startsWith(PHOTOS_DIR) || !fs.existsSync(file)) {
    next();
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(file).pipe(res);
}

export function protoPhotos(): Plugin {
  return {
    name: 'hanh-trinh:proto-photos',
    configureServer(server) {
      server.middlewares.use('/proto-photos', servePhoto);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/proto-photos', servePhoto);
    },
  };
}

export default protoPhotos;
