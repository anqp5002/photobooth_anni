import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();
const app = await buildApp({ config });

// Bản demo (Vercel): DB nằm ở /tmp nên mỗi lần máy chủ khởi động lại là trống —
// tạo sẵn gia đình mẫu "Nhà Bin & Su" để trang luôn có nội dung.
if (config.autoSeed) {
  const empty = !app.db.prepare('SELECT 1 FROM families LIMIT 1').get();
  if (empty) {
    const { seedFamily } = await import('../scripts/seed-family.js');
    await seedFamily(app.db, { mediaDir: config.mediaDir });
    app.log.info('đã tạo dữ liệu mẫu Nhà Bin & Su');
  }
}

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { port: config.port, db: config.dbPath, media: config.mediaDir },
    'Hành Trình — máy chủ đang chạy',
  );
  console.log(`Hành Trình: http://localhost:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
