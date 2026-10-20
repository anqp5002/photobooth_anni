import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Thư mục gốc của gói máy chủ (`impl/server`). */
export const SERVER_ROOT = path.resolve(here, '..');
/** Thư mục dữ liệu tham chiếu chỉ đọc (GeoNames). */
export const DATA_DIR = path.join(SERVER_ROOT, 'data');
/** Bản dựng của web (Vite) — máy chủ phục vụ luôn. */
export const DEFAULT_WEB_DIST = path.resolve(SERVER_ROOT, '..', 'web', 'dist');

export function loadConfig(env = process.env) {
  const dbPath = env.DB_PATH || path.join(SERVER_ROOT, '.data', 'hanh-trinh.db');
  return {
    port: Number(env.PORT || 8787),
    host: env.HOST || '0.0.0.0',
    dbPath,
    mediaDir: env.MEDIA_DIR || path.join(SERVER_ROOT, '.data', 'media'),
    dataDir: DATA_DIR,
    webDist: env.WEB_DIST || DEFAULT_WEB_DIST,
    aiProvider: env.AI_PROVIDER || 'none',
    // FreeLLMAPI (router local, chuẩn OpenAI). Key chỉ nằm trong biến môi trường.
    aiBaseUrl: env.FREELLM_BASE_URL || 'http://127.0.0.1:3001',
    aiApiKey: env.FREELLM_API_KEY || '',
    aiModel: env.FREELLM_MODEL || 'auto',
    aiTimeoutMs: Number(env.FREELLM_TIMEOUT_MS || 60000),
    aiRetries: Number(env.FREELLM_RETRIES ?? 2),
    aiConcurrency: Number(env.AI_CONCURRENCY || 2),
    sessionDays: Number(env.SESSION_DAYS || 30),
    cookieSecure: env.COOKIE_SECURE === '1',
    // Nguồn được phép gọi API khi chạy `vite dev` (cookie vẫn cần credentials).
    corsOrigins: (env.CORS_ORIGINS ||
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    // Ngưỡng chia chặng B-02 (giữ ở một chỗ để test đơn vị đọc lại).
    cluster: {
      maxGapMs: 3 * 60 * 60 * 1000, // ≤ 3 giờ
      maxDistanceKm: 5, // ≤ 5 km
      placeMaxKm: 200, // xa hơn thì coi như không có địa danh
    },
  };
}
