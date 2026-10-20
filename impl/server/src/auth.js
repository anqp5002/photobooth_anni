import crypto from 'node:crypto';
import { addMember, createFamily, ensureUserFamily, familyOf, pickAvatarColor, publicFamily } from './family.js';
import { badRequest, nowIso } from './util.js';

/** Tên người dùng bị cấm vì trùng đường dẫn trang (hợp đồng API). */
export const RESERVED_USERNAMES = new Set(['me', 'photobooth', 'login', 'api', 'media']);

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function validateRegistration({ username, email, password }) {
  const name = String(username ?? '').trim().toLowerCase();
  const mail = String(email ?? '').trim().toLowerCase();
  if (RESERVED_USERNAMES.has(name)) throw badRequest('username_reserved');
  if (!USERNAME_RE.test(name)) throw badRequest('invalid_username');
  if (!EMAIL_RE.test(mail)) throw badRequest('invalid_email');
  if (String(password ?? '').length < MIN_PASSWORD) throw badRequest('weak_password');
  return { username: name, email: mail, password: String(password) };
}

export function createUser(db, { username, email, password, displayName, familyName }) {
  const clean = validateRegistration({ username, email, password });
  const existsName = db.prepare('SELECT id FROM users WHERE username = ?').get(clean.username);
  if (existsName) throw badRequest('username_taken');
  const existsMail = db.prepare('SELECT id FROM users WHERE email = ?').get(clean.email);
  if (existsMail) throw badRequest('email_taken');
  const name = String(displayName ?? '').trim().slice(0, 60) || clean.username;
  const color = pickAvatarColor(clean.username);
  const family = createFamily(db, String(familyName ?? '').trim() || `Nhà ${name}`);
  const info = db
    .prepare(
      `INSERT INTO users (username, email, display_name, password_hash, avatar, avatar_color,
         family_id, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
    )
    .run(clean.username, clean.email, name, hashPassword(clean.password), color, family.id, nowIso());
  // Người đăng ký cũng là một thành viên trong nhà (gắn được vào ảnh/mục).
  addMember(db, family.id, name, color);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
  return { user: publicUser(row), family: publicFamily(family) };
}

export function authenticate(db, email, password) {
  const mail = String(email ?? '').trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(mail, mail);
  if (!row) return null;
  if (!verifyPassword(String(password ?? ''), row.password_hash)) return null;
  return row;
}

export function createSession(db, userId, days = 30) {
  const token = crypto.randomBytes(32).toString('base64url');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(sha256(token), userId, createdAt, expiresAt);
  return { token, expiresAt };
}

export function sessionUser(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256(token));
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    return null;
  }
  return row;
}

export function destroySession(db, token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color ?? null,
  };
}

/** Gia đình của một người dùng; dữ liệu cũ chưa có thì tạo luôn. */
export function userFamily(db, user) {
  if (!user) return null;
  const existing = user.family_id ? familyOf(db, user.family_id) : null;
  const family = existing ?? ensureUserFamily(db, user);
  return publicFamily(family);
}

/** Hợp đồng `GET /api/me`: `{user, family}`. */
export function sessionPayload(db, user) {
  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarColor: user.avatar_color ?? null,
    },
    family: userFamily(db, user),
  };
}
