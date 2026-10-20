import { addMember } from '../family.js';
import { bodyObject, requireFamily } from '../http.js';
import { badRequest, nowIso } from '../util.js';

export function publicMember(row) {
  return { id: row.id, name: row.name, color: row.color ?? null };
}

/** Người trong nhà: đọc danh sách + thêm tay (màn mục/ảnh gắn người). */
export default async function memberRoutes(app) {
  const { db } = app;

  app.get('/api/members', async (req, reply) => {
    const familyId = requireFamily(req);
    const rows = db
      .prepare('SELECT id, name, color FROM members WHERE family_id = ? ORDER BY id')
      .all(familyId);
    return reply.send(rows.map(publicMember));
  });

  app.post('/api/members', async (req, reply) => {
    const familyId = requireFamily(req);
    const body = bodyObject(req);
    const name = String(body.name ?? '').trim();
    if (name.length < 1 || name.length > 60) throw badRequest('invalid_name');
    const color = body.color == null ? null : String(body.color).trim().slice(0, 20);
    if (color !== null && !/^#[0-9a-fA-F]{3,8}$/.test(color)) throw badRequest('invalid_color');
    const duplicate = db
      .prepare('SELECT 1 AS n FROM members WHERE family_id = ? AND name = ?')
      .get(familyId, name);
    if (duplicate) throw badRequest('duplicate_member');
    const created = addMember(db, familyId, name, color, { stamp: nowIso() });
    if (!created) throw badRequest('invalid_name');
    return reply.code(201).send(publicMember(created));
  });
}
