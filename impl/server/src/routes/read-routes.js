import { applyAutoSegments } from '../cluster.js';
import { applyHeuristics } from '../ai.js';
import { ingestFile, insertMedia } from '../ingest.js';
import { buildTripPayload, buildUserPayload, canViewTrip } from '../trips.js';
import { tripOr404 } from '../http.js';
import { intParam } from '../util.js';

export default async function readRoutes(app) {
  const { db } = app;

  app.get('/api/users/:username', async (req, reply) => {
    const username = String(req.params.username ?? '').toLowerCase();
    const payload = buildUserPayload(db, username, { viewerId: req.user?.id ?? null });
    reply.header('cache-control', 'no-store');
    if (!payload) return reply.code(404).send({ error: 'not_found' });
    return reply.send(payload);
  });

  app.get('/api/trips/:id', async (req, reply) => {
    const trip = tripOr404(db, req.params.id, { familyId: req.user?.family_id ?? null });
    const viewerId = req.user?.id ?? null;
    reply.header('cache-control', 'no-store');
    if (!canViewTrip(trip, viewerId)) {
      if (trip.visibility === 'private') return reply.code(403).send({ error: 'private' });
      return reply.code(404).send({ error: 'not_found' });
    }
    const limit = intParam(req.query.limit, 20, 1, 100);
    const offset = intParam(req.query.offset, 0, 0, 1_000_000);
    db.prepare('UPDATE trips SET views = views + 1 WHERE id = ?').run(trip.id);
    trip.views += 1;
    return reply.send(buildTripPayload(db, trip, { viewerId, limit, offset }));
  });

  app.get('/api/trips/:id/steps', async (req, reply) => {
    const trip = tripOr404(db, req.params.id, { familyId: req.user?.family_id ?? null });
    const viewerId = req.user?.id ?? null;
    reply.header('cache-control', 'no-store');
    if (!canViewTrip(trip, viewerId)) {
      if (trip.visibility === 'private') return reply.code(403).send({ error: 'private' });
      return reply.code(404).send({ error: 'not_found' });
    }
    const limit = intParam(req.query.limit, 20, 1, 100);
    const offset = intParam(req.query.offset, 0, 0, 1_000_000);
    const payload = buildTripPayload(db, trip, { viewerId, limit, offset });
    return reply.send({ steps: payload.steps, nextOffset: payload.nextOffset });
  });
}
