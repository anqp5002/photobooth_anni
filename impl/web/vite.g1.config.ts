import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build riêng trang mục (G1) để chứng minh trang + `api-extra.ts` đóng gói được,
 * trong khi `App.tsx` của cmd còn lỗi import ở trang chủ (vùng cmd).
 * Chạy: npx vite build --config vite.g1.config.ts
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist-g1',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: { muc: 'muc-dev.html' },
      output: { entryFileNames: 'g1-[name].js', chunkFileNames: 'g1-[name].js', assetFileNames: 'g1-[name][extname]' },
    },
  },
});
