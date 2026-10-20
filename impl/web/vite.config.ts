import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { protoPhotos } from './src/dev/mock/proto-photos-plugin';

/** Thư mục gốc dự án (để nạp ảnh bản mẫu trong `design/proto/assets/`). */
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  // `protoPhotos` phục vụ ảnh bản mẫu ở /proto-photos/<tên>.jpg (không copy ảnh vào repo).
  plugins: [react(), protoPhotos()],
  server: {
    port: 5173,
    // Cho phép đọc ảnh bản mẫu nằm ngoài `impl/web` (khối 3D Freepik).
    fs: { allow: [repoRoot] },
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
