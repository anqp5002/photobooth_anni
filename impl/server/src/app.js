import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { openDb } from './db.js';
import { loadGeoIndex } from './geo.js';
import { sessionUser } from './auth.js';
import { HttpError } from './util.js';
import { MEDIA_CACHE_HEADER } from './trips.js';
import { createAiService } from './ai/service.js';
import { createAiProvider } from './ai/freellm.js';
import { createCollectionService } from './collections-service.js';
import { takenAtFromFilename } from './exif.js';
import authRoutes from './routes/auth-routes.js';
import mediaRoutes from './routes/media-routes.js';
import collectionRoutes from './routes/collection-routes.js';
import homeRoutes from './routes/home-routes.js';
import searchRoutes from './routes/search-routes.js';
import memberRoutes from './routes/member-routes.js';

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

function contentTypeFor(file) {
  const ext = file.split('.').pop()?.toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Dựng ứng dụng Fastify (dùng cho cả `src/index.js` và test).
 * @param {{config: object, db?: object, geo?: object}} options
 */
export async function buildApp({ config, db, geo } = {}) {
  const cfg = config;
  const app = Fastify({ logger: cfg.logger ?? false, trustProxy: false, bodyLimit: 2 * 1024 * 1024 });
  const database = db ?? openDb(cfg.dbPath);
  const geoIndex = geo ?? (await loadGeoIndex(cfg.dataDir));
  await fsp.mkdir(cfg.mediaDir, { recursive: true });

  app.decorate('config', cfg);
  app.decorate('db', database);
  app.decorate('geo', geoIndex);
  const aiProvider = createAiProvider(cfg);
  app.decorate('ai', createAiService({ db: database, mediaDir: cfg.mediaDir, config: cfg, logger: app.log, provider: aiProvider }));
  app.decorate(
    'collections',
    createCollectionService({
      db: database,
      provider: aiProvider,
      logger: app.log,
      waitFor: () => app.ai.idle(),
    }),
  );
  // Ảnh đã tải lên mà thiếu ngày giờ (mất EXIF) nhưng tên tệp có ngày: điền ngày rồi gom lại mục.
  {
    const missing = database
      .prepare('SELECT id, family_id, orig_name FROM media WHERE taken_at IS NULL AND orig_name IS NOT NULL')
      .all();
    const update = database.prepare('UPDATE media SET taken_at = ? WHERE id = ?');
    const touched = new Set();
    for (const row of missing) {
      const takenAt = takenAtFromFilename(row.orig_name);
      if (!takenAt) continue;
      update.run(takenAt, row.id);
      touched.add(row.family_id);
    }
    if (touched.size > 0) {
      app.log.info({ families: touched.size }, 'điền ngày chụp từ tên tệp');
      for (const familyId of touched) app.collections.schedule(familyId);
    }
  }

  // AI thật vừa được bật lại: phân tích nốt ảnh tải lên lúc AI tắt hoặc bị ngắt giữa chừng,
  // rồi gom lại mục cho các gia đình có ảnh mới phân tích.
  if (aiProvider?.name === 'freellm' && typeof aiProvider.analyzePhoto === 'function') {
    const rows = database
      .prepare(`SELECT id, family_id FROM media WHERE type = 'photo' AND ai_status IN ('skipped', 'pending')`)
      .all();
    if (rows.length > 0) {
      app.log.info({ count: rows.length }, 'AI phân tích lại ảnh còn sót');
      for (const r of rows) app.ai.enqueue(r.id);
      for (const familyId of new Set(rows.map((r) => r.family_id))) app.collections.schedule(familyId);
    }
  }
  app.decorateRequest('user', null);

  await app.register(cookie);
  await app.register(compress, {
    global: true,
    threshold: 512,
    encodings: ['br', 'gzip'],
  });
  await app.register(multipart, {
    limits: { fileSize: 400 * 1024 * 1024, files: 200, parts: 220, fields: 20 },
  });
  app.addContentTypeParser(
    'image/png',
    { parseAs: 'buffer', bodyLimit: 40 * 1024 * 1024 },
    (_req, body, done) => done(null, body),
  );

  // Phiên đăng nhập bằng cookie httpOnly.
  app.addHook('onRequest', async (req, reply) => {
    const token = req.cookies?.sid;
    req.user = token ? sessionUser(database, token) : null;

    // Cho `vite dev` gọi API (cookie httpOnly cần credentials + origin cụ thể).
    const origin = req.headers.origin;
    if (origin && (cfg.corsOrigins ?? []).includes(origin)) {
      reply.header('access-control-allow-origin', origin);
      reply.header('access-control-allow-credentials', 'true');
      reply.header('vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      reply.header('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      reply.header(
        'access-control-allow-headers',
        req.headers['access-control-request-headers'] ?? 'content-type',
      );
      reply.header('access-control-max-age', '600');
      return reply.code(204).send();
    }
  });

  // Dữ liệu API không cache (R-042).
  app.addHook('onSend', async (req, reply, payload) => {
    if (req.url.startsWith('/api/')) reply.header('cache-control', 'no-store');
    return payload;
  });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: error.code });
    }
    const code = error.statusCode ?? 500;
    if (code === 413) return reply.code(413).send({ error: 'too_large' });
    if (code >= 400 && code < 500) {
      return reply.code(code).send({ error: 'bad_request' });
    }
    req.log.error({ err: error }, 'lỗi máy chủ');
    return reply.code(500).send({ error: 'server_error' });
  });

  // Ảnh: tên ngẫu nhiên, cache vĩnh viễn + ETag (R-041).
  app.get('/media/:code/:file', async (req, reply) => {
    const { code, file } = req.params;
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) return reply.code(404).send({ error: 'not_found' });
    if (!/^(?:orig\.[a-z0-9]{2,5}|lg\.jpg|sm\.jpg)$/.test(file)) {
      return reply.code(404).send({ error: 'not_found' });
    }
    const filePath = path.join(cfg.mediaDir, code, file);
    let stat;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return reply.code(404).send({ error: 'not_found' });
    }
    if (!stat.isFile()) return reply.code(404).send({ error: 'not_found' });

    const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    reply.header('cache-control', MEDIA_CACHE_HEADER);
    reply.header('etag', etag);
    reply.header('last-modified', stat.mtime.toUTCString());
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((value) => value.trim() === etag)) {
      return reply.code(304).send();
    }
    reply.header('content-length', stat.size);
    reply.type(contentTypeFor(file));
    return reply.send(fs.createReadStream(filePath));
  });

  await app.register(authRoutes);
  // r1 (`/api/trips`, `/api/steps`, `/api/users/:username`) không còn trong hợp đồng r2:
  // đã bỏ đăng ký, code dùng chung (trips.js, cluster.js, ai.js) vẫn giữ.
  await app.register(mediaRoutes);
  await app.register(collectionRoutes);
  await app.register(homeRoutes);
  await app.register(searchRoutes);
  await app.register(memberRoutes);

  // Web đã dựng (impl/web/dist) + SPA fallback.
  const hasWeb = fs.existsSync(path.join(cfg.webDist, 'index.html'));
  if (hasWeb) {
    await app.register(fastifyStatic, {
      root: cfg.webDist,
      prefix: '/',
      index: ['index.html'],
      maxAge: '1y',
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('cache-control', 'no-cache');
        }
      },
    });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/media/')) {
      return reply.code(404).send({ error: 'not_found' });
    }
    if (hasWeb && (req.method === 'GET' || req.method === 'HEAD')) {
      return reply.sendFile('index.html', { maxAge: 0, immutable: false });
    }
    return reply.code(404).send({ error: 'not_found' });
  });

  app.addHook('onClose', async () => {
    try {
      app.ai.stop();
      app.collections.stop();
    } catch {
      /* hàng đợi đã dừng */
    }
    try {
      database.close();
    } catch {
      /* đã đóng */
    }
  });

  return app;
}
