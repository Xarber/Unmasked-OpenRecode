// SPDX-License-Identifier: AGPL-3.0-only
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { privacy, profilePatch } from '@unmasked/contracts';
import { profile, type UserRow } from './auth.js';
import { fail } from './security.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from './db.js';
import type { Config } from './config.js';
import type { RouteContext } from './routes.js';
export function registerIdentity(app: FastifyInstance, db: Db, c: Config, ctx: RouteContext) {
  const { uid, id, unblocked, notify, person } = ctx;
  app.get('/users/me', async (req) => {
    const [u] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [await uid(req)]);
    return profile(u!);
  });
  app.patch('/users/me', async (req) => {
    const user = await uid(req),
      b = profilePatch.parse(req.body);
    await db.query(
      'UPDATE users SET display_name=COALESCE($1,display_name),username=COALESCE($2,username),bio=COALESCE($3,bio),status=COALESCE($4,status) WHERE id=$5',
      [b.displayName ?? null, b.username ?? null, b.bio ?? null, b.status ?? null, user],
    );
    notify([user]);
    return { ok: true };
  });
  app.patch('/settings/privacy', async (req) => {
    const user = await uid(req),
      b = privacy.parse(req.body);
    const [u] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [user]);
    if (u!.age_band === 'minor' && b.discoverable)
      fail(403, 'Discovery is restricted for under-18 accounts');
    await db.query(
      'UPDATE users SET discoverable=$1,read_receipts=$2,typing_indicators=$3 WHERE id=$4',
      [b.discoverable, b.readReceipts, b.typingIndicators, user],
    );
    notify([user]);
    return { ok: true };
  });
  app.get<{ Querystring: { q?: string } }>('/users', async (req) => {
    const user = await uid(req);
    const q = z.string().min(3).max(24).parse(req.query.q);
    const [me] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [user]);
    if (me!.age_band === 'minor') return [];
    const users = await db.query<UserRow>(
      "SELECT * FROM users u WHERE discoverable=true AND verified=true AND age_band='adult' AND username LIKE $1 AND id<>$2 AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=$2 AND other_id=u.id) OR (user_id=u.id AND other_id=$2)) LIMIT 20",
      [`${q.toLowerCase().replace(/[%_]/g, '')}%`, user],
    );
    return users.map(person);
  });
  app.get('/connections', async (req) => {
    const user = await uid(req);
    const contacts = (
      await db.query<UserRow>(
        'SELECT u.* FROM users u JOIN contacts c ON c.other_id=u.id WHERE c.user_id=$1',
        [user],
      )
    ).map(person);
    const requests = await db.query<{
      id: string;
      sender_id: string;
      recipient_id: string;
      state: string;
    }>(
      "SELECT * FROM requests WHERE (sender_id=$1 OR recipient_id=$1) AND state='pending' ORDER BY created_at DESC",
      [user],
    );
    const resolved = await Promise.all(
      requests.map(async (r) => {
        const us = await db.query<UserRow>('SELECT * FROM users WHERE id=$1 OR id=$2', [
          r.sender_id,
          r.recipient_id,
        ]);
        return {
          ...r,
          sender: person(us.find((u) => u.id === r.sender_id)!),
          recipient: person(us.find((u) => u.id === r.recipient_id)!),
        };
      }),
    );
    const blocked = (
      await db.query<UserRow>(
        'SELECT u.* FROM users u JOIN blocks b ON b.other_id=u.id WHERE b.user_id=$1',
        [user],
      )
    ).map(person);
    return { contacts, requests: resolved, blocked };
  });
  app.post(
    '/connections/requests',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const user = await uid(req),
        b = z
          .object({
            username: z.string().min(3).max(24),
            invitation: z.string().max(100).optional(),
          })
          .parse(req.body);
      const [other] = await db.query<UserRow>(
        'SELECT * FROM users WHERE username=$1 AND verified=true',
        [b.username.toLowerCase()],
      );
      if (!other || other.id === user) fail(404, 'This connection is unavailable');
      await unblocked(user, other!.id);
      const [me] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [user]);
      const invite = b.invitation
        ? await db.query(
            "SELECT 1 FROM auth_tokens WHERE token_hash=$1 AND user_id=$2 AND purpose='invite' AND expires_at>now()",
            [(await import('./security.js')).hash(b.invitation), other!.id],
          )
        : [];
      if (
        (!other!.discoverable || other!.age_band === 'minor' || me!.age_band === 'minor') &&
        !invite.length
      )
        fail(403, 'A personal invitation is required');
      if (
        (
          await db.query('SELECT 1 FROM contacts WHERE user_id=$1 AND other_id=$2', [
            user,
            other!.id,
          ])
        ).length
      )
        fail(409, 'Already connected');
      await db.query('INSERT INTO requests(id,sender_id,recipient_id) VALUES($1,$2,$3)', [
        randomUUID(),
        user,
        other!.id,
      ]);
      notify([user, other!.id]);
      reply.code(201);
      return { ok: true };
    },
  );
  app.post('/connections/invitation', async (req) => {
    const user = await uid(req);
    const { token, hash } = await import('./security.js');
    const raw = token();
    await db.query(
      "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'invite',now()+interval '1 day')",
      [hash(raw), user],
    );
    const [u] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [user]);
    return {
      url: `${c.WEB_ORIGIN}/connections?username=${encodeURIComponent(u!.username)}&invitation=${raw}`,
      expiresIn: 86400,
    };
  });
  app.post<{ Params: { id: string } }>('/connections/requests/:id/respond', async (req) => {
    const user = await uid(req),
      b = z.object({ accept: z.boolean() }).parse(req.body);
    const ids = await db.transaction(async (tx) => {
      const [r] = await tx.query<{ sender_id: string; recipient_id: string }>(
        "SELECT * FROM requests WHERE id=$1 AND recipient_id=$2 AND state='pending' FOR UPDATE",
        [id(req.params.id), user],
      );
      if (!r) fail(404, 'Request not found');
      await unblocked(user, r!.sender_id, tx);
      await tx.query('UPDATE requests SET state=$1 WHERE id=$2', [
        b.accept ? 'accepted' : 'rejected',
        req.params.id,
      ]);
      if (b.accept)
        await tx.query(
          'INSERT INTO contacts(user_id,other_id) VALUES($1,$2),($2,$1) ON CONFLICT DO NOTHING',
          [user, r!.sender_id],
        );
      return [user, r!.sender_id];
    });
    notify(ids);
    return { ok: true };
  });
  app.post('/blocks', async (req) => {
    const user = await uid(req),
      b = z.object({ userId: z.uuid() }).parse(req.body);
    if (user === b.userId) fail(400, 'Cannot block yourself');
    await db.transaction(async (tx) => {
      await tx.query('INSERT INTO blocks(user_id,other_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [
        user,
        b.userId,
      ]);
      await tx.query(
        "UPDATE requests SET state='rejected' WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)",
        [user, b.userId],
      );
      await tx.query(
        "UPDATE unmasked SET state='ended' WHERE conversation_id IN (SELECT a.conversation_id FROM participants a JOIN participants b ON a.conversation_id=b.conversation_id WHERE a.user_id=$1 AND b.user_id=$2)",
        [user, b.userId],
      );
      await tx.query(
        'DELETE FROM disclosures WHERE conversation_id IN (SELECT a.conversation_id FROM participants a JOIN participants b ON a.conversation_id=b.conversation_id WHERE a.user_id=$1 AND b.user_id=$2)',
        [user, b.userId],
      );
    });
    notify([user, b.userId]);
    return { ok: true };
  });
  app.delete<{ Params: { id: string } }>('/blocks/:id', async (req) => {
    const user = await uid(req);
    await db.query('DELETE FROM blocks WHERE user_id=$1 AND other_id=$2', [
      user,
      id(req.params.id),
    ]);
    notify([user]);
    return { ok: true };
  });
}
