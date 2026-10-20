import { requireFamily } from '../http.js';
import { homeFor, mapFor, recapFor, timeline } from '../summary.js';
import { badRequest } from '../util.js';

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function yearParam(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const year = Number.parseInt(String(value), 10);
  if (!Number.isFinite(year) || year < MIN_YEAR || year > MAX_YEAR) throw badRequest('invalid_year');
  return year;
}

export default async function homeRoutes(app) {
  const { db } = app;

  app.get('/api/home', async (req, reply) => {
    const familyId = requireFamily(req);
    return reply.send(homeFor(db, familyId));
  });

  app.get('/api/recap/:year', async (req, reply) => {
    const familyId = requireFamily(req);
    const year = yearParam(req.params.year, new Date().getUTCFullYear());
    const payload = await recapFor(db, familyId, year, { provider: app.ai?.provider ?? null });
    return reply.send(payload);
  });

  app.get('/api/timeline', async (req, reply) => {
    const familyId = requireFamily(req);
    const year = yearParam(req.query.year, new Date().getUTCFullYear());
    const cursor = Number.parseInt(String(req.query.cursor ?? '0'), 10);
    if (!Number.isFinite(cursor) || cursor < 0) throw badRequest('invalid_cursor');
    return reply.send(timeline(db, familyId, { year, cursor }));
  });

  app.get('/api/map', async (req, reply) => {
    const familyId = requireFamily(req);
    let collectionId = null;
    if (req.query.collectionId !== undefined && req.query.collectionId !== '') {
      collectionId = Number.parseInt(String(req.query.collectionId), 10);
      if (!Number.isFinite(collectionId)) throw badRequest('invalid_collectionId');
      const owned = db
        .prepare('SELECT 1 AS n FROM collections WHERE id = ? AND family_id = ?')
        .get(collectionId, familyId);
      if (!owned) return reply.code(404).send({ error: 'not_found' });
    }
    const year = collectionId == null ? yearParam(req.query.year, new Date().getUTCFullYear()) : null;
    return reply.send(mapFor(db, familyId, { year, collectionId }));
  });
}
