import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();
const app = await buildApp({ config });

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
