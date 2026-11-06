// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io as client, type Socket } from 'socket.io-client';
import { database, migrate } from '../src/db.js';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
const config: Config = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 0,
  WEB_ORIGIN: 'http://localhost:8081',
  DATA_DIR: '',
  MAIL_FROM: 'test@example.invalid',
};
interface Auth {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  profile: { id: string; readReceipts: boolean; discoverable: boolean };
}
const pass = 'A very long test password 2026!';
test('two-account persistent messaging, security and privacy journeys', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'unmasked-test-'));
  let db = await database(undefined, dir);
  await migrate(db);
  let server = await createApp(db, config);
  await server.app.listen({ host: '127.0.0.1', port: 0 });
  const sockets: Socket[] = [];
  const req = async (
    path: string,
    method = 'GET',
    body?: unknown,
    access?: string,
    status = 200,
  ) => {
    const r = await server.app.inject({
      url: path,
      method: method as 'GET',
      headers: { ...(access ? { authorization: `Bearer ${access}` } : {}) },
      ...(body !== undefined ? { payload: body as Record<string, unknown> } : {}),
    });
    assert.equal(r.statusCode, status, `${method} ${path}: ${r.body}`);
    return r.json();
  };
  const account = async (username: string, ageBand = 'adult'): Promise<Auth> => {
    await req(
      '/auth/register',
      'POST',
      {
        username,
        email: `${username}@example.com`,
        displayName: username,
        password: pass,
        ageBand,
      },
      undefined,
      201,
    );
    const token = server.auth.mailbox.find(
      (m) => m.email === `${username}@example.com` && m.purpose === 'verify',
    )!.token;
    await req('/auth/verify', 'POST', { token });
    return req('/auth/login', 'POST', { email: `${username}@example.com`, password: pass });
  };
  try {
    const alice = await account('alice'),
      bob = await account('bobby'),
      eve = await account('evelyn');
    let cid = '',
      mid = '';
    await t.test(
      'verification, secure credential storage, username uniqueness and validation',
      async () => {
        await req(
          '/auth/register',
          'POST',
          { email: 'bad', username: 'a', password: 'short', displayName: '', ageBand: 'adult' },
          undefined,
          400,
        );
        await req(
          '/auth/register',
          'POST',
          {
            username: 'alice',
            email: 'other@example.com',
            displayName: 'duplicate',
            password: pass,
            ageBand: 'adult',
          },
          undefined,
          409,
        );
        await req(
          '/auth/login',
          'POST',
          { email: 'alice@example.com', password: 'incorrect' },
          undefined,
          401,
        );
        await req('/users/me', 'GET', undefined, undefined, 401);
        const rows = await db.query<{ password_hash: string }>('SELECT password_hash FROM users');
        assert.ok(rows.every((u) => !u.password_hash.includes(pass)));
        const sessions = await db.query<{ access_hash: string; refresh_hash: string }>(
          'SELECT access_hash,refresh_hash FROM sessions',
        );
        assert.ok(
          sessions.every(
            (s) => s.access_hash !== alice.accessToken && s.refresh_hash !== alice.refreshToken,
          ),
        );
      },
    );
    await t.test('private-by-default discovery and invitation acceptance', async () => {
      assert.equal(alice.profile.discoverable, false);
      await req('/connections/requests', 'POST', { username: 'bobby' }, alice.accessToken, 403);
      const invite = await req('/connections/invitation', 'POST', {}, bob.accessToken);
      const invitation = new URL(invite.url).searchParams.get('invitation');
      await req(
        '/connections/requests',
        'POST',
        { username: 'bobby', invitation },
        alice.accessToken,
        201,
      );
      const connections = await req('/connections', 'GET', undefined, bob.accessToken);
      const requestId = connections.requests[0].id;
      await req(
        `/connections/requests/${requestId}/respond`,
        'POST',
        { accept: true },
        eve.accessToken,
        404,
      );
      await req(
        `/connections/requests/${requestId}/respond`,
        'POST',
        { accept: true },
        bob.accessToken,
      );
      cid = (
        await req(
          '/conversations',
          'POST',
          { participants: [bob.profile.id] },
          alice.accessToken,
          201,
        )
      ).id;
      const duplicate = (
        await req(
          '/conversations',
          'POST',
          { participants: [alice.profile.id] },
          bob.accessToken,
          201,
        )
      ).id;
      assert.equal(cid, duplicate);
      await req(`/conversations/${cid}/messages`, 'GET', undefined, eve.accessToken, 404);
    });
    await t.test(
      'authenticated live synchronization and persistent idempotent messages',
      async () => {
        const address = server.app.server.address();
        assert.ok(address && typeof address !== 'string');
        const socket = client(`http://127.0.0.1:${address.port}`, {
          auth: { token: bob.accessToken },
          transports: ['websocket'],
          reconnection: false,
        });
        sockets.push(socket);
        await new Promise<void>((resolve, reject) => {
          socket.once('connect', resolve);
          socket.once('connect_error', reject);
        });
        const sync = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(Error('No live synchronization event')), 2000);
          socket.once('sync', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        mid = randomUUID();
        await req(
          `/conversations/${cid}/messages`,
          'POST',
          { id: mid, text: 'Hello, this is a real persisted message.' },
          alice.accessToken,
          201,
        );
        await sync;
        await Promise.all(
          Array.from({ length: 5 }, () =>
            req(
              `/conversations/${cid}/messages`,
              'POST',
              { id: mid, text: 'Hello, this is a real persisted message.' },
              alice.accessToken,
              201,
            ),
          ),
        );
        let page = await req(`/conversations/${cid}/messages`, 'GET', undefined, bob.accessToken);
        assert.equal(page.messages.length, 1);
        assert.equal(page.messages[0].body, 'Hello, this is a real persisted message.');
        await req(
          `/conversations/${cid}/messages`,
          'POST',
          { id: mid, text: 'Changed collision' },
          alice.accessToken,
          409,
        );
        await req(
          `/conversations/${cid}/messages`,
          'POST',
          { id: randomUUID(), text: 'A reply', replyTo: mid },
          bob.accessToken,
          201,
        );
        await req(`/messages/${mid}/reactions`, 'POST', { emoji: '❤️' }, bob.accessToken);
        page = await req(`/conversations/${cid}/messages`, 'GET', undefined, alice.accessToken);
        assert.equal(page.messages[0].reactions[0].emoji, '❤️');
        await req(`/messages/${mid}`, 'PATCH', { text: 'Unauthorized edit' }, bob.accessToken, 404);
      },
    );
    await t.test(
      'read receipt choices, profiles, consent and revocable independent disclosure',
      async () => {
        await req(`/conversations/${cid}/read`, 'POST', {}, bob.accessToken);
        let convs = await req('/conversations', 'GET', undefined, alice.accessToken);
        assert.equal(
          convs[0].members.find((p: { id: string }) => p.id === bob.profile.id).last_read,
          null,
        );
        await req(
          '/settings/privacy',
          'PATCH',
          { discoverable: false, readReceipts: true, typingIndicators: false },
          bob.accessToken,
        );
        convs = await req('/conversations', 'GET', undefined, alice.accessToken);
        assert.ok(convs[0].members.find((p: { id: string }) => p.id === bob.profile.id).last_read);
        await req(
          '/users/me',
          'PATCH',
          { bio: 'Private profile detail', username: 'alice_new' },
          alice.accessToken,
        );
        await req(
          `/conversations/${cid}/unmasked`,
          'POST',
          { action: 'reveal', field: 'bio' },
          alice.accessToken,
          400,
        );
        await req(
          `/conversations/${cid}/unmasked`,
          'POST',
          { action: 'invite' },
          alice.accessToken,
        );
        await req(
          `/conversations/${cid}/unmasked`,
          'POST',
          { action: 'accept' },
          alice.accessToken,
          403,
        );
        await req(`/conversations/${cid}/unmasked`, 'POST', { action: 'accept' }, bob.accessToken);
        await req(
          `/conversations/${cid}/unmasked`,
          'POST',
          { action: 'reveal', field: 'bio' },
          alice.accessToken,
        );
        let state = await req(`/conversations/${cid}/unmasked`, 'GET', undefined, bob.accessToken);
        assert.equal(state.disclosures.length, 1);
        assert.equal(state.disclosures[0].value, 'Private profile detail');
        await req(
          `/conversations/${cid}/unmasked`,
          'POST',
          { action: 'hide', field: 'bio' },
          alice.accessToken,
        );
        state = await req(`/conversations/${cid}/unmasked`, 'GET', undefined, bob.accessToken);
        assert.equal(state.disclosures.length, 0);
      },
    );
    await t.test(
      'session refresh rotation, replay rejection and multi-device revocation',
      async () => {
        const device = await req('/auth/login', 'POST', {
          email: 'alice@example.com',
          password: pass,
          device: 'Another device',
        });
        const rotated = await req('/auth/refresh', 'POST', { refreshToken: device.refreshToken });
        await req('/auth/refresh', 'POST', { refreshToken: device.refreshToken }, undefined, 401);
        await req('/users/me', 'GET', undefined, device.accessToken);
        const { hash } = await import('../src/security.js');
        await db.query(
          "UPDATE access_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
          [hash(device.accessToken)],
        );
        await req('/users/me', 'GET', undefined, device.accessToken, 401);
        await req('/users/me', 'GET', undefined, rotated.accessToken);
        const address = server.app.server.address();
        assert.ok(address && typeof address !== 'string');
        const deviceSocket = client(`http://127.0.0.1:${address.port}`, {
          auth: { token: rotated.accessToken },
          transports: ['websocket'],
          reconnection: false,
        });
        sockets.push(deviceSocket);
        await new Promise<void>((resolve, reject) => {
          deviceSocket.once('connect', resolve);
          deviceSocket.once('connect_error', reject);
        });
        const disconnected = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(Error('Revoked socket remained connected')), 2000);
          deviceSocket.once('disconnect', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        await req(`/sessions/${rotated.sessionId}`, 'DELETE', undefined, alice.accessToken);
        await disconnected;

        await req('/users/me', 'GET', undefined, rotated.accessToken, 401);
      },
    );
    await t.test(
      'private moments, explicit reporting, cross-conversation reply rejection',
      async () => {
        await req('/moments', 'POST', { messageId: mid, note: 'Personal note' }, alice.accessToken);
        assert.equal((await req('/moments', 'GET', undefined, bob.accessToken)).length, 0);
        await req('/moments', 'POST', { messageId: mid }, eve.accessToken, 404);
        const report = await req(
          '/reports',
          'POST',
          {
            userId: alice.profile.id,
            messageId: mid,
            reason: 'Test report',
            submittedContent: 'Only explicitly submitted content',
          },
          bob.accessToken,
        );
        assert.ok(report.id);
        const stored = await db.query<{ submitted_content: string }>(
          'SELECT submitted_content FROM reports',
        );
        assert.equal(stored[0]!.submitted_content, 'Only explicitly submitted content');
      },
    );
    await t.test('password reset consumes codes and invalidates prior sessions', async () => {
      await req('/auth/forgot', 'POST', { email: 'evelyn@example.com' });
      const code = server.auth.mailbox.find(
        (m) => m.email === 'evelyn@example.com' && m.purpose === 'reset',
      )!.token;
      const replacement = 'A fresh and long replacement password!';
      await req('/auth/reset', 'POST', { token: code, password: replacement });
      await req('/users/me', 'GET', undefined, eve.accessToken, 401);
      await req(
        '/auth/login',
        'POST',
        { email: 'evelyn@example.com', password: pass },
        undefined,
        401,
      );
      await req('/auth/login', 'POST', { email: 'evelyn@example.com', password: replacement });
      await req('/auth/reset', 'POST', { token: code, password: replacement }, undefined, 400);
    });
    await t.test('server restart preserves users, sessions and messages', async () => {
      sockets.forEach((s) => s.disconnect());
      await server.app.close();
      await db.close();
      db = await database(undefined, dir);
      await migrate(db);
      server = await createApp(db, config);
      await server.app.listen({ host: '127.0.0.1', port: 0 });
      const messages = await req(
        `/conversations/${cid}/messages`,
        'GET',
        undefined,
        bob.accessToken,
      );
      assert.equal(messages.messages.length, 2);
      assert.equal(
        (await req('/users/me', 'GET', undefined, alice.accessToken)).username,
        'alice_new',
      );
    });
    await t.test('blocking prevents sends, reactions, mode and future invitations', async () => {
      await req('/blocks', 'POST', { userId: alice.profile.id }, bob.accessToken);
      await req(
        `/conversations/${cid}/messages`,
        'POST',
        { id: randomUUID(), text: 'Must not send' },
        alice.accessToken,
        403,
      );
      await req(`/messages/${mid}/reactions`, 'POST', { emoji: '👍' }, alice.accessToken, 403);
      await req(
        `/conversations/${cid}/unmasked`,
        'POST',
        { action: 'invite' },
        alice.accessToken,
        403,
      );
      const state = await db.query<{ state: string }>(
        'SELECT state FROM unmasked WHERE conversation_id=$1',
        [cid],
      );
      assert.equal(state[0]!.state, 'ended');
      await req(`/blocks/${alice.profile.id}`, 'DELETE', undefined, bob.accessToken);
    });
    await t.test('minor discovery restrictions and account export/deletion', async () => {
      const child = await account('minor_user', 'minor');
      await req(
        '/settings/privacy',
        'PATCH',
        { discoverable: true, readReceipts: false, typingIndicators: false },
        child.accessToken,
        403,
      );
      assert.deepEqual(await req('/users?q=alice', 'GET', undefined, child.accessToken), []);
      const exp = await req('/account/export', 'GET', undefined, alice.accessToken);
      assert.equal(exp.messages.length, 2);
      assert.ok(!JSON.stringify(exp).includes('password_hash'));
      await req('/account', 'DELETE', { confirmation: 'WRONG' }, alice.accessToken, 400);
      await req('/account', 'DELETE', { confirmation: 'DELETE' }, alice.accessToken);
      await req('/users/me', 'GET', undefined, alice.accessToken, 401);
      const page = await req(`/conversations/${cid}/messages`, 'GET', undefined, bob.accessToken);
      assert.equal(page.messages.find((m: { id: string }) => m.id === mid).body, '');
    });
    await t.test('origin validation prevents cross-origin cookie actions', async () => {
      const r = await server.app.inject({
        url: '/auth/refresh',
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        payload: {},
      });
      assert.equal(r.statusCode, 403);
    });
  } finally {
    sockets.forEach((s) => s.disconnect());
    await server.app.close();
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('group roles, pagination boundaries, cross-conversation isolation and deletion', async () => {
  const db = await database();
  await migrate(db);
  const { app } = await createApp(db, config);
  const call = async (
    path: string,
    method = 'GET',
    body?: unknown,
    access?: string,
    status = 200,
  ) => {
    const r = await app.inject({
      url: path,
      method: method as 'GET',
      payload: body as object,
      headers: access ? { authorization: `Bearer ${access}` } : {},
    });
    assert.equal(r.statusCode, status, `${method} ${path}: ${r.body}`);
    return r.json();
  };
  try {
    const { passwordHash } = await import('../src/security.js');
    const hashed = await passwordHash(pass);
    const users = [];
    for (const username of ['owner', 'member', 'outside']) {
      const id = randomUUID();
      await db.query(
        "INSERT INTO users(id,email,username,display_name,password_hash,age_band,verified) VALUES($1,$2,$3,$3,$4,'adult',true)",
        [id, `${username}@example.com`, username, hashed],
      );
      users.push({
        id,
        ...(await call('/auth/login', 'POST', {
          email: `${username}@example.com`,
          password: pass,
        })),
      });
    }
    const [owner, member, outside] = users;
    await db.query('INSERT INTO contacts(user_id,other_id) VALUES($1,$2),($1,$3),($2,$1),($3,$1)', [
      owner.id,
      member.id,
      outside.id,
    ]);
    const group = await call(
      '/conversations',
      'POST',
      { participants: [member.id, outside.id], title: 'Our group' },
      owner.accessToken,
      201,
    );
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'remove', userId: owner.id },
      member.accessToken,
      403,
    );
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'leave' },
      owner.accessToken,
      409,
    );
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'promote', userId: member.id },
      owner.accessToken,
    );
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'remove', userId: outside.id },
      owner.accessToken,
    );
    await call(`/conversations/${group.id}/messages`, 'GET', undefined, outside.accessToken, 404);
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'rename', title: 'Renamed group' },
      member.accessToken,
    );
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'add', userId: outside.id },
      owner.accessToken,
    );
    const ids = [];
    for (let i = 0; i < 55; i++) {
      const mid = randomUUID();
      ids.push(mid);
      await call(
        `/conversations/${group.id}/messages`,
        'POST',
        { id: mid, text: `Pagination message ${i}` },
        owner.accessToken,
        201,
      );
    }
    // Force distinct PostgreSQL microsecond timestamps within one JavaScript millisecond.
    for (let i = 0; i < ids.length; i++)
      await db.query(
        "UPDATE messages SET created_at='2026-11-06T10:00:00.123000Z'::timestamptz + $1::double precision*interval '1 microsecond' WHERE id=$2",
        [i, ids[i]],
      );
    await call(
      `/conversations/${group.id}/messages?before=not-json`,
      'GET',
      undefined,
      owner.accessToken,
      400,
    );
    const latest = await call(
      `/conversations/${group.id}/messages`,
      'GET',
      undefined,
      member.accessToken,
    );
    assert.equal(latest.messages.length, 50);
    assert.ok(latest.nextCursor);
    const earlier = await call(
      `/conversations/${group.id}/messages?before=${latest.nextCursor}`,
      'GET',
      undefined,
      member.accessToken,
    );
    assert.equal(earlier.messages.length, 5);
    const combined = [...earlier.messages, ...latest.messages];
    assert.equal(new Set(combined.map((m) => m.id)).size, 55);
    assert.equal(combined[0].id, ids[0]);
    const found = await call(
      `/conversations/${group.id}/messages?q=message%2054`,
      'GET',
      undefined,
      member.accessToken,
    );
    assert.equal(found.messages.length, 1);
    assert.equal(
      (await call(`/conversations/${group.id}/export`, 'GET', undefined, owner.accessToken))
        .messages.length,
      55,
    );
    const direct = await call(
      '/conversations',
      'POST',
      { participants: [member.id] },
      owner.accessToken,
      201,
    );
    await call(
      `/conversations/${direct.id}/messages`,
      'POST',
      { id: randomUUID(), text: 'Wrong reply reference', replyTo: ids[0] },
      owner.accessToken,
      400,
    );
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'remove', userId: outside.id },
      owner.accessToken,
    );
    await db.query("UPDATE users SET age_band='minor' WHERE id=$1", [outside.id]);
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'add', userId: outside.id },
      owner.accessToken,
      403,
    );
    await db.query('INSERT INTO contacts(user_id,other_id) VALUES($1,$2),($2,$1)', [
      member.id,
      outside.id,
    ]);
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'add', userId: outside.id },
      owner.accessToken,
    );
    await db.query('INSERT INTO blocks(user_id,other_id) VALUES($1,$2)', [member.id, outside.id]);
    await call(
      '/conversations',
      'POST',
      { participants: [member.id, outside.id], title: 'Blocked pair bypass' },
      owner.accessToken,
      403,
    );
    await call(`/messages/${ids[0]}`, 'DELETE', undefined, owner.accessToken);
    const tombstone = await db.query<{ body: string; deleted_at: string }>(
      'SELECT body,deleted_at FROM messages WHERE id=$1',
      [ids[0]],
    );
    assert.equal(tombstone[0]!.body, '');
    assert.ok(tombstone[0]!.deleted_at);
    await call(
      `/conversations/${group.id}/membership`,
      'POST',
      { action: 'leave' },
      owner.accessToken,
    );
    await call(`/conversations/${group.id}/messages`, 'GET', undefined, owner.accessToken, 404);
  } finally {
    await app.close();
    await db.close();
  }
});
