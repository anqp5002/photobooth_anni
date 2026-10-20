import {
  authenticate,
  createSession,
  createUser,
  destroySession,
  sessionPayload,
} from '../auth.js';
import { badRequest } from '../util.js';
import { bodyObject, optionalString, requireUser, requiredString } from '../http.js';

export default async function authRoutes(app) {
  const { db, config } = app;
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: Boolean(config.cookieSecure),
  };

  const startSession = (reply, user) => {
    const session = createSession(db, user.id, config.sessionDays);
    reply.setCookie('sid', session.token, {
      ...cookieOptions,
      maxAge: config.sessionDays * 86400,
    });
    return session;
  };

  const readPassword = (body) => {
    if (typeof body.password !== 'string' || body.password.length < 1) {
      throw badRequest('invalid_password');
    }
    return body.password.slice(0, 200);
  };

  app.post('/api/auth/register', async (req, reply) => {
    const body = bodyObject(req);
    const username = requiredString(body.username, 'username', 30);
    const email = requiredString(body.email, 'email', 200);
    const password = readPassword(body);
    const displayName = optionalString(body.displayName, 'displayName', 60);
    const familyName = optionalString(body.familyName, 'familyName', 80);
    const { user, family } = createUser(db, { username, email, password, displayName, familyName });
    startSession(reply, user);
    return reply.code(201).send({ user, family });
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = bodyObject(req);
    const email = requiredString(body.email, 'email', 200);
    const password = readPassword(body);
    const row = authenticate(db, email, password);
    if (!row) return reply.code(401).send({ error: 'invalid_credentials' });
    startSession(reply, row);
    return reply.send(sessionPayload(db, row));
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.cookies?.sid) destroySession(db, req.cookies.sid);
    reply.clearCookie('sid', { path: '/' });
    return reply.send({ ok: true });
  });

  /** Hợp đồng r2: `{user:{id,username,displayName,avatarColor}, family:{id,name,slug}}`. */
  app.get('/api/me', async (req, reply) => {
    const user = requireUser(req);
    return reply.send(sessionPayload(db, user));
  });

  app.get('/api/health', async (_req, reply) => reply.send({ ok: true }));
}
