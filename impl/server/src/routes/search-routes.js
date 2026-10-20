import { requireFamily } from '../http.js';
import { SEARCH_LIMIT_DEFAULT, searchPhotos } from '../search.js';
import { badRequest } from '../util.js';

export default async function searchRoutes(app) {
  const { db } = app;

  app.get('/api/search', async (req, reply) => {
    const familyId = requireFamily(req);
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) throw badRequest('invalid_q');
    if (q.length > 200) throw badRequest('invalid_q');
    const limit = req.query.limit === undefined ? SEARCH_LIMIT_DEFAULT : Number.parseInt(String(req.query.limit), 10);
    if (!Number.isFinite(limit) || limit < 1) throw badRequest('invalid_limit');
    const payload = await searchPhotos(db, familyId, {
      q,
      limit,
      provider: app.ai?.provider ?? null,
    });
    return reply.send(payload);
  });
}
