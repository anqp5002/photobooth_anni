import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ensureMediaFts } from './fts.js';
import { migrate, SCHEMA_VERSION } from './migrations.js';

const SCHEMA = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export { SCHEMA_VERSION };

/**
 * Mở (và khởi tạo) cơ sở dữ liệu SQLite.
 * - DB mới: chạy `schema.sql` (r2).
 * - DB của r1: chạy migration thêm cột/gia đình, dựng lại bảng media không mất dữ liệu.
 * @param {string} dbPath đường dẫn tệp, hoặc ':memory:' cho test
 */
export function openDb(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  withTx(db, () => {
    migrate(db, SCHEMA);
    db.exec(SCHEMA);
  });
  ensureMediaFts(db);
  return db;
}

/** Chạy `fn` trong một giao dịch; lỗi thì cuộn lại. */
export function withTx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* giao dịch đã đóng */
    }
    throw err;
  }
}
