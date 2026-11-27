// SPDX-License-Identifier: AGPL-3.0-only
import {
  createXCenterOIDC,
  issuer,
  type LoginTransaction,
  type ServerConfigOptions,
} from '@xcenter-id/server';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { authService, UserRow } from './auth.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { registerXCenterData } from './xcenter-data.js';
import { fail, hash, token, verifyPassword } from './security.js';

const callbackPath = '/account/callback';
const browserCookie = 'xcenter_login';
const attemptLifetime = 600;
export type XCenterOAuth = Pick<
  Awaited<ReturnType<typeof createXCenterOIDC>>,
  'begin' | 'complete'
>;

export function xcenterRegistration(config: Config) {
  const {
    XCENTER_CLIENT_ID: clientId,
    XCENTER_CLIENT_SECRET: clientSecret,
    XCENTER_REDIRECT_URI: redirectUri,
  } = config;
  if (!clientId && !clientSecret && !redirectUri) return;
  if (!clientId || !clientSecret || !redirectUri)
    throw new Error('Incomplete X-Center ID registration settings');
  const callback = new URL(redirectUri);
  if (
    callback.protocol !== 'https:' ||
    callback.origin !== new URL(config.WEB_ORIGIN).origin ||
    callback.pathname !== '/api' + callbackPath ||
    callback.search ||
    callback.hash ||
    callback.username ||
    callback.password
  ) {
    throw new Error(
      'X-Center ID callback must be an exact HTTPS endpoint on the Unmasked web origin',
    );
  }
  return { clientId, clientSecret, redirectUri: callback.href };
}

export async function registerXCenter(
  app: FastifyInstance,
  db: Db,
  config: Config,
  auth: ReturnType<typeof authService>,
  createOAuth: (options: ServerConfigOptions) => Promise<XCenterOAuth> = createXCenterOIDC,
) {
  const registration = xcenterRegistration(config);
  if (!registration) return;
  const oauth = await createOAuth({
    ...registration,
    file: false,
    scopes: ['openid', 'profile', 'app_data', 'friends'],
  });
  const storeGrant = registerXCenterData(app, db, auth, registration.clientId);
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: new URL(registration.redirectUri).pathname,
  };
  const result = (mode: 'link' | 'signin', status: string) => {
    const page = new URL(mode === 'link' ? '/settings' : '/', config.WEB_ORIGIN);
    page.searchParams.set('xcenter', status);
    return page.href;
  };

  app.get('/auth/xcenter/status', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { available: true };
  });

  app.post(
    '/auth/xcenter/start',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const intent = z
        .discriminatedUnion('mode', [
          z.object({ mode: z.literal('signin') }),
          z.object({ mode: z.literal('link'), password: z.string().min(1).max(128) }),
        ])
        .parse(req.body);
      let sessionId: string | null = null;
      if (intent.mode === 'link') {
        const session = await auth.requireSession(req);
        const [user] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [
          session.user_id,
        ]);
        if (!user?.verified || !(await verifyPassword(intent.password, user.password_hash))) {
          fail(403, 'Confirm your current Unmasked password to link your account');
        }
        sessionId = session.id;
      }
      const { url, transaction } = await oauth.begin();
      const browser = token();
      await db.transaction(async (tx) => {
        await tx.query('DELETE FROM xcenter_login_attempts WHERE expires_at<=now()');
        await tx.query(
          'INSERT INTO xcenter_login_attempts(state_hash,browser_hash,transaction,link_session,expires_at) VALUES($1,$2,$3,$4,to_timestamp($5))',
          [
            hash(transaction.state),
            hash(browser),
            JSON.stringify(transaction),
            sessionId,
            transaction.expiresAt / 1000,
          ],
        );
      });
      reply.setCookie(browserCookie, browser, { ...cookieOptions, maxAge: attemptLifetime });
      reply.header('Cache-Control', 'no-store');
      return { authorizationUrl: url.href };
    },
  );

  app.get(callbackPath, async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
    const browser = req.cookies[browserCookie];
    const query = z.object({ state: z.string().min(1).max(200) }).safeParse(req.query);
    if (!browser || !query.success) return reply.redirect(result('signin', 'expired'));
    const [attempt] = await db.query<{
      transaction: LoginTransaction;
      link_session: string | null;
    }>(
      'DELETE FROM xcenter_login_attempts WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING transaction,link_session',
      [hash(query.data.state), hash(browser)],
    );
    if (!attempt) return reply.redirect(result('signin', 'expired'));
    reply.clearCookie(browserCookie, cookieOptions);
    const mode = attempt.link_session ? 'link' : 'signin';
    const callback = new URL(registration.redirectUri);
    callback.search = req.url.slice(req.url.indexOf('?'));
    if (callback.searchParams.get('error') === 'access_denied')
      return reply.redirect(result(mode, 'cancelled'));
    let completed: Awaited<ReturnType<XCenterOAuth['complete']>>;
    try {
      completed = await oauth.complete(callback, attempt.transaction);
    } catch {
      return reply.redirect(result(mode, 'failed'));
    }
    const { identity, tokens } = completed;
    if (!identity.sub || identity.sub.length > 255) return reply.redirect(result(mode, 'failed'));
    if (attempt.link_session) {
      const [link] = await db.query(
        'INSERT INTO xcenter_identities(issuer,subject,user_id) SELECT $1,$2,user_id FROM sessions WHERE id=$3 AND expires_at>now() ON CONFLICT DO NOTHING RETURNING user_id',
        [issuer, identity.sub, attempt.link_session],
      );
      return reply.redirect(result('link', link ? 'linked' : 'unavailable'));
    }
    const [user] = await db.query<UserRow>(
      'SELECT u.* FROM users u JOIN xcenter_identities i ON i.user_id=u.id WHERE i.issuer=$1 AND i.subject=$2 AND u.verified',
      [issuer, identity.sub],
    );
    if (!user) return reply.redirect(result('signin', 'unlinked'));
    // The delegated grant is held in API memory only. Bound the product session to its expiry.
    const lifetime = Math.min(600, Math.floor(tokens.expires_in ?? 0));
    if (!Number.isFinite(lifetime) || lifetime < 1) return reply.redirect(result(mode, 'failed'));
    const session = await auth.issue(user, 'X-Center ID · Web', reply, lifetime);
    storeGrant(session.sessionId, tokens.access_token, lifetime);
    return reply.redirect(result('signin', 'signed-in'));
  });
}
