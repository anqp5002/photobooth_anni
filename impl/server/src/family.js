import { nowIso, slugify } from './util.js';

/** Màu đại diện cho người trong nhà (lấy theo vòng cho dễ nhìn). */
export const AVATAR_COLORS = [
  '#E8734A',
  '#3F7D6E',
  '#C9A227',
  '#7A6BC4',
  '#D45B7A',
  '#4A7BB8',
  '#8A6A4B',
  '#2F8F9D',
];

/** Màu cố định theo tên (đăng ký lại cùng tên vẫn ra cùng màu). */
export function pickAvatarColor(seed = '') {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.codePointAt(0)) % 100000;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Slug gia đình không trùng; trùng thì thêm -2, -3… */
export function uniqueFamilySlug(db, base) {
  const root = slugify(base, { maxLength: 48 });
  const exists = db.prepare('SELECT 1 AS n FROM families WHERE slug = ?');
  if (!exists.get(root)) return root;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root.slice(0, 44)}-${i}`;
    if (!exists.get(candidate)) return candidate;
  }
  return `${root.slice(0, 40)}-${Date.now().toString(36)}`;
}

/** Tạo gia đình mới, trả bản ghi vừa tạo. */
export function createFamily(db, name, { stamp = nowIso() } = {}) {
  const clean = String(name ?? '').trim().slice(0, 80) || 'Nhà của tôi';
  const info = db
    .prepare('INSERT INTO families (name, slug, created_at) VALUES (?, ?, ?)')
    .run(clean, uniqueFamilySlug(db, clean), stamp);
  return db.prepare('SELECT * FROM families WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function familyOf(db, familyId) {
  const id = Number(familyId);
  if (!Number.isFinite(id)) return null;
  return db.prepare('SELECT * FROM families WHERE id = ?').get(id) ?? null;
}

export function publicFamily(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug };
}

/** Người trong nhà (gắn tay vào ảnh/mục). */
export function addMember(db, familyId, name, color = null, { stamp = nowIso() } = {}) {
  const clean = String(name ?? '').trim().slice(0, 60);
  if (!clean) return null;
  const info = db
    .prepare('INSERT INTO members (family_id, name, color, created_at) VALUES (?, ?, ?, ?)')
    .run(Number(familyId), clean, color, stamp);
  return db.prepare('SELECT * FROM members WHERE id = ?').get(Number(info.lastInsertRowid));
}

/**
 * Người dùng chưa có gia đình (dữ liệu r1) → tạo "Nhà <tên hiển thị>",
 * thêm một member cùng tên. Trả bản ghi gia đình.
 */
export function ensureUserFamily(db, user, { stamp = nowIso() } = {}) {
  if (user.family_id) {
    const existing = familyOf(db, user.family_id);
    if (existing) return existing;
  }
  const displayName = String(user.display_name ?? '').trim() || String(user.username ?? '').trim() || 'tôi';
  const family = createFamily(db, `Nhà ${displayName}`, { stamp });
  const color = user.avatar_color || pickAvatarColor(user.username ?? displayName);
  db.prepare('UPDATE users SET family_id = ?, avatar_color = COALESCE(avatar_color, ?) WHERE id = ?').run(
    family.id,
    color,
    user.id,
  );
  const hasMember = db
    .prepare('SELECT 1 AS n FROM members WHERE family_id = ? AND name = ?')
    .get(family.id, displayName);
  if (!hasMember) addMember(db, family.id, displayName, color, { stamp });
  return family;
}
