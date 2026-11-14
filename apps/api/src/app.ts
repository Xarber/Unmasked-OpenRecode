// SPDX-License-Identifier: AGPL-3.0-only
import { registerGroups } from './groups.js';
import { registerIdentity } from './identity.js';
import { registerMessaging } from './messaging.js';
import { registerFeatures } from './features.js';
// SPDX-License-Identifier: AGPL-3.0-only
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { Server } from 'socket.io';
import { z, ZodError } from 'zod';
import type { Db } from './db.js';
import type { Config } from './config.js';
import { authService, type UserRow } from './auth.js';
import { fail } from './security.js';
export async function createApp(db: Db, c: Config) {
  const app = Fastify({
    logger:
      c.NODE_ENV === 'production'
        ? { redact: ['req.headers.authorization', 'req.headers.cookie', 'body'] }
        : false,
    bodyLimit: 32768,
    trustProxy: process.env.TRUST_XCENTER_PROXY === '1' ? (_address, hop) => hop === 0 : false,
  });
  await app.register(cors, { origin: c.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.addHook('onRequest', async (req) => {
    if (req.headers.origin && req.headers.origin !== c.WEB_ORIGIN) fail(403, 'Origin not allowed');
  });
  app.setErrorHandler((error, _req, reply) => {
    const e = error as Error & { code?: string; statusCode?: number };
    if (e instanceof ZodError)
      return reply.code(400).send({
        message: 'Please check your input',
        issues: e.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    if (e.code === '23505') return reply.code(409).send({ message: 'This record already exists' });
    if (e.code === '22P02' || e.code === '23503')
      return reply.code(400).send({ message: 'Invalid reference' });
    const status = e.statusCode ?? 500;
    if (status >= 500) app.log.error({ code: e.code }, 'Request failed');
    return reply
      .code(status)
      .send({ message: status >= 500 ? 'Something went wrong. Please retry.' : e.message });
  });
  const io = new Server(app.server, {
    cors: { origin: c.WEB_ORIGIN, credentials: true },
    maxHttpBufferSize: 32768,
  });
  const auth = authService(db, c, (sid) => io.in(`session:${sid}`).disconnectSockets(true));
  await auth.registerRoutes(app);
  io.use(async (socket, next) => {
    try {
      if (socket.handshake.headers.origin && socket.handshake.headers.origin !== c.WEB_ORIGIN)
        throw Error();
      const s = await auth.authenticate(z.string().max(100).parse(socket.handshake.auth.token));
      socket.data.session = s;
      socket.data.token = socket.handshake.auth.token;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const s = socket.data.session as { id: string; user_id: string };
    socket.join(`user:${s.user_id}`);
    socket.join(`session:${s.id}`);
    const timeout = setInterval(
      () =>
        void auth.authenticate(socket.data.token as string).catch(() => socket.disconnect(true)),
      15000,
    );
    socket.on('disconnect', () => clearInterval(timeout));
  });
  const notify = (ids: string[]) =>
    ids.forEach((id) => io.to(`user:${id}`).emit('sync', { at: new Date().toISOString() }));
  const uid = async (req: Parameters<typeof auth.requireSession>[0]) =>
    (await auth.requireSession(req)).user_id;
  const id = (v: unknown) => z.uuid().parse(v);
  async function members(conversationId: string, tx = db) {
    return tx.query<{ user_id: string; role: string }>(
      'SELECT user_id,role FROM participants WHERE conversation_id=$1',
      [conversationId],
    );
  }
  async function member(user: string, conversationId: string, tx = db) {
    const ms = await members(conversationId, tx);
    if (!ms.some((m) => m.user_id === user)) fail(404, 'Conversation not found');
    return ms;
  }
  async function unblocked(a: string, b: string, tx = db) {
    if (
      (
        await tx.query(
          'SELECT 1 FROM blocks WHERE (user_id=$1 AND other_id=$2) OR (user_id=$2 AND other_id=$1)',
          [a, b],
        )
      ).length
    )
      fail(403, 'Interaction unavailable');
  }
  async function compatible(a: string, b: string, tx = db) {
    await unblocked(a, b, tx);
    const restricted = await tx.query(
      "SELECT 1 FROM users WHERE id IN ($1,$2) AND age_band='minor'",
      [a, b],
    );
    if (
      restricted.length &&
      !(await tx.query('SELECT 1 FROM contacts WHERE user_id=$1 AND other_id=$2', [a, b])).length
    )
      fail(403, 'Under-18 group participants must be accepted contacts with every participant');
  }
  async function canSend(user: string, conversationId: string, tx = db) {
    const ms = await member(user, conversationId, tx);
    for (const m of ms) if (m.user_id !== user) await compatible(user, m.user_id, tx);
    return ms;
  }
  const person = (u: UserRow) => ({ id: u.id, username: u.username, displayName: u.display_name });
  app.get('/health', async () => {
    await db.query('SELECT 1');
    return {
      ok: true,
      version: '0.1.0',
      commit: process.env.BUILD_COMMIT ?? 'development',
      e2ee: false,
    };
  });
  const ctx = {
    revoke: (sid: string) => io.in(`session:${sid}`).disconnectSockets(true),
    uid,
    id,
    unblocked,
    compatible,
    notify,
    member,
    members,
    canSend,
    person,
  };
  registerIdentity(app, db, c, ctx);
  registerGroups(app, db, ctx);
  registerMessaging(app, db, c, ctx);
  registerFeatures(app, db, c, ctx);
  app.addHook('onClose', async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });
  return { app, io, auth };
}
