// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { database, migrate } from '../src/db.js';
import { passwordHash } from '../src/security.js';
import type { Config } from '../src/config.js';

const origin = 'https://unmasked.example';
const callback = `${origin}/api/account/callback`;
const password = 'Unmasked linking test password';
const config: Config = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 0,
  WEB_ORIGIN: origin,
  DATA_DIR: '',
  MAIL_FROM: 'test@example.invalid',
  XCENTER_CLIENT_ID: 'xid-fixture',
  XCENTER_CLIENT_SECRET: 'synthetic-fixture',
  XCENTER_REDIRECT_URI: callback,
};

test('registered callback binds the browser, links an existing account, and consumes the attempt once', async (t) => {
  const db = await database();
  await migrate(db);
  const original = randomUUID();
  await db.query(
    'INSERT INTO users(id,email,username,display_name,password_hash,age_band,verified) VALUES($1,$2,$3,$3,$4,$5,true)',
    [original, 'fixture@example.invalid', 'fixture', await passwordHash(password), 'adult'],
  );
  let exchanges = 0;
  const { app } = await createApp(db, config, async (options) => {
    assert.equal(options.redirectUri, callback);
    assert.ok(options.scopes?.includes('app_data') && options.scopes.includes('friends'));
    return {
      async begin() {
        const state = randomUUID();
        const url = new URL('https://id.xcenter.it/auth');
        url.searchParams.set('state', state);
        return {
          url,
          transaction: {
            state,
            nonce: 'test-nonce',
            verifier: 'test-verifier',
            expiresAt: Date.now() + 60_000,
          },
        };
      },
      async complete(url, transaction) {
        const parsed = new URL(url);
        assert.equal(parsed.origin + parsed.pathname, callback);
        assert.equal(parsed.searchParams.get('state'), transaction.state);
        exchanges++;
        return {
          tokens: { access_token: 'mock', expires_in: 60, token_type: 'Bearer' },
          identity: { sub: 'same-registration-subject', email: 'different@example.invalid' },
        };
      },
    };
  });
  try {
    const signedIn = await app.inject({
      url: '/auth/login',
      method: 'POST',
      payload: { email: 'fixture@example.invalid', password, device: 'test' },
    });
    assert.equal(signedIn.statusCode, 200);
    const authorization = `Bearer ${signedIn.json().accessToken}`;
    const denied = await app.inject({
      url: '/auth/xcenter/start',
      method: 'POST',
      headers: { authorization },
      payload: { mode: 'link', password: 'wrong' },
    });
    assert.equal(denied.statusCode, 403);
    async function start(payload: object) {
      const response = await app.inject({
        url: '/auth/xcenter/start',
        method: 'POST',
        headers: { authorization },
        payload,
      });
      assert.equal(response.statusCode, 200, response.body);
      const state = new URL(response.json().authorizationUrl).searchParams.get('state');
      const cookie = response.cookies.find((value) => value.name === 'xcenter_login');
      assert.equal(cookie?.path, '/api/account/callback');
      assert.ok(cookie?.secure && cookie.httpOnly);
      return {
        url: `/account/callback?code=fixture&state=${state}`,
        cookies: { xcenter_login: cookie.value },
      };
    }
    const link = await start({ mode: 'link', password });
    assert.match(
      String(
        (await app.inject({ url: link.url, cookies: { xcenter_login: 'wrong' } })).headers.location,
      ),
      /expired$/,
    );
    assert.equal(exchanges, 0);
    const linked = await app.inject(link);
    assert.match(String(linked.headers.location), /settings\?xcenter=linked$/);
    assert.match(String((await app.inject(link)).headers.location), /expired$/);
    assert.equal(exchanges, 1);
    const signIn = await start({ mode: 'signin' });
    const session = await app.inject(signIn);
    assert.match(String(session.headers.location), /\?xcenter=signed-in$/);
    const refresh = session.cookies.find((cookie) => cookie.name === 'refresh');
    assert.equal(refresh?.maxAge, 60);
    assert.ok(refresh?.httpOnly);
    const resumed = await app.inject({
      url: '/auth/refresh',
      method: 'POST',
      cookies: { refresh: refresh.value },
    });
    assert.equal(resumed.json().profile.id, original);
    const managed = await app.inject({
      url: '/xcenter/account',
      headers: { authorization: `Bearer ${resumed.json().accessToken}` },
    });
    assert.deepEqual(managed.json(), { linked: true, signedInWithXCenter: true });
    const headers = { authorization: `Bearer ${resumed.json().accessToken}` };
    const appearancePath = '/xcenter/settings/appearance';
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
      assert.equal(new URL(url).origin, 'https://id.xcenter.it');
      const sent = new Headers(init.headers);
      assert.equal(sent.get('Authorization'), 'Bearer mock');
      if (new URL(url).pathname === '/v1/profile/friends') {
        return Response.json({
          friends: [
            { username: 'fixture', sub: 'same-registration-subject' },
            { username: 'unlinked' },
          ],
        });
      }
      assert.equal(new URL(url).pathname, '/v1/apps/xid-fixture/data/settings/appearance');
      if (init.method === 'GET') return Response.json({}, { status: 404 });
      if (sent.get('If-Match') !== '"0"') return Response.json({}, { status: 412 });
      assert.deepEqual(JSON.parse(String(init.body)), { data: { theme: 'dark' }, public: false });
      return Response.json({ revision: 1 });
    });
    const loaded = await app.inject({ url: appearancePath, headers });
    assert.deepEqual(loaded.json(), { theme: null, revision: 0 });
    const save = await app.inject({
      url: appearancePath,
      method: 'PUT',
      headers,
      payload: { theme: 'dark', revision: 0 },
    });
    assert.deepEqual(save.json(), { theme: 'dark', revision: 1 });
    const stale = await app.inject({
      url: appearancePath,
      method: 'PUT',
      headers,
      payload: { theme: 'light', revision: 5 },
    });
    assert.equal(stale.statusCode, 409);
    const friends = await app.inject({ url: '/xcenter/friends', headers });
    assert.deepEqual(friends.json(), []);
    const passwordSession = await app.inject({ url: appearancePath, headers: { authorization } });
    assert.equal(passwordSession.statusCode, 403);
  } finally {
    await app.close();
    await db.close();
  }
});
