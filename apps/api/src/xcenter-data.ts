// SPDX-License-Identifier: AGPL-3.0-only
import { createUserClient, issuer, XCenterError } from '@xcenter-id/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { authService } from './auth.js';
import type { Db } from './db.js';
import { fail } from './security.js';

const appearance = z.object({ theme: z.enum(['system', 'light', 'dark']) });
const collection = 'settings';
const recordId = 'appearance';
const requestTimeout = () => AbortSignal.timeout(8000);
type Grant = { token: string; expiresAt: number };

// Short grants stay in the API process and are never persisted or sent to a client.
export function registerXCenterData(
  app: FastifyInstance,
  db: Db,
  auth: ReturnType<typeof authService>,
  clientId: string,
) {
  const grants = new Map<string, Grant>();
  const purge = () => {
    for (const [id, grant] of grants) if (grant.expiresAt <= Date.now()) grants.delete(id);
  };
  const timer = setInterval(purge, 60_000).unref();
  app.addHook('onClose', async () => {
    clearInterval(timer);
    grants.clear();
  });

  const current = async (req: FastifyRequest) => {
    const session = await auth.requireSession(req);
    const grant = grants.get(session.id);
    if (!grant || grant.expiresAt <= Date.now())
      return fail(403, 'Sign in with X-Center ID to use this feature');
    return {
      session,
      user: createUserClient({ clientId, getAccessToken: () => grant.token }),
    };
  };
  const hosted = async <T>(operation: () => Promise<T>) => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof XCenterError) {
        if (error.status === 401 || error.status === 403)
          return fail(403, 'Grant this permission in X-Center ID and sign in again');
        if (error.status === 409 || error.status === 412)
          return fail(409, 'Settings changed elsewhere. Load them again before saving.');
        if (error.status === 429)
          return fail(429, 'X-Center ID is busy. Please try again shortly.');
      }
      return fail(502, 'X-Center ID is temporarily unavailable');
    }
  };

  app.get('/xcenter/account', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const session = await auth.requireSession(req);
    const linked = await db.query(
      'SELECT 1 FROM xcenter_identities WHERE user_id=$1 AND issuer=$2',
      [session.user_id, issuer],
    );
    const grant = grants.get(session.id);
    return {
      linked: linked.length > 0,
      signedInWithXCenter: !!grant && grant.expiresAt > Date.now(),
    };
  });

  app.get('/xcenter/settings/appearance', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { user } = await current(req);
    return hosted(async () => {
      try {
        const record = await user.records.get(collection, recordId, { signal: requestTimeout() });
        if (record.public || record.shared)
          throw new Error('Unexpected appearance record ownership');
        return { ...appearance.parse(record.data), revision: record.revision };
      } catch (error) {
        if (error instanceof XCenterError && error.status === 404)
          return { theme: null, revision: 0 };
        throw error;
      }
    });
  });
  app.put('/xcenter/settings/appearance', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { user } = await current(req);
    const { theme, revision } = appearance
      .extend({ revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
      .parse(req.body);
    const record = await hosted(() =>
      user.records.put(
        collection,
        recordId,
        { data: { theme }, public: false },
        { revision, signal: requestTimeout() },
      ),
    );
    return { theme, revision: record.revision };
  });
  app.delete('/xcenter/settings/appearance', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { user } = await current(req);
    const { revision } = z
      .object({ revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) })
      .parse(req.body);
    return hosted(() =>
      user.records.delete(collection, recordId, { revision, signal: requestTimeout() }),
    );
  });
  app.get('/xcenter/friends', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { session, user } = await current(req);
    const { friends } = await hosted(() => user.friends({ signal: requestTimeout() }));
    const subjects = friends.flatMap(({ sub }) => (sub ? [sub] : []));
    return db.query<{ id: string; username: string; displayName: string }>(
      `SELECT u.id,u.username,u.display_name AS "displayName"
       FROM xcenter_identities i JOIN users u ON u.id=i.user_id JOIN users me ON me.id=$3
       WHERE i.issuer=$1 AND i.subject=ANY($2::text[]) AND u.id<>me.id AND u.verified
       AND u.discoverable AND u.age_band='adult' AND me.age_band='adult'
       AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=me.id AND other_id=u.id) OR (user_id=u.id AND other_id=me.id))
       ORDER BY u.username`,
      [issuer, subjects, session.user_id],
    );
  });

  return (sessionId: string, token: string, lifetime: number) => {
    grants.set(sessionId, { token, expiresAt: Date.now() + lifetime * 1000 });
  };
}
