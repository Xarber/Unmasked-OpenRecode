// SPDX-License-Identifier: AGPL-3.0-only
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prompts } from '@unmasked/contracts';
import { profile, type UserRow } from './auth.js';
import { fail } from './security.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from './db.js';
import type { Config } from './config.js';
import type { RouteContext } from './routes.js';
export function registerFeatures(app: FastifyInstance, db: Db, c: Config, ctx: RouteContext) {
  const { uid, id, notify, member, members, canSend } = ctx;
  app.get('/prompts', async (req) => {
    await uid(req);
    return prompts;
  });
  app.get<{ Params: { id: string } }>('/conversations/:id/unmasked', async (req) => {
    const user = await uid(req),
      cid = id(req.params.id);
    await canSend(user, cid);
    const [mode] = await db.query('SELECT * FROM unmasked WHERE conversation_id=$1', [cid]);
    const disclosures =
      mode?.state === 'active'
        ? await db.query(
            "SELECT d.user_id,d.field,CASE d.field WHEN 'bio' THEN u.bio ELSE u.status END AS value FROM disclosures d JOIN users u ON u.id=d.user_id WHERE d.conversation_id=$1",
            [cid],
          )
        : [];
    return { mode: mode ?? null, disclosures };
  });
  app.post<{ Params: { id: string } }>('/conversations/:id/unmasked', async (req) => {
    const user = await uid(req),
      cid = id(req.params.id),
      b = z
        .object({
          action: z.enum(['invite', 'accept', 'end', 'reveal', 'hide']),
          field: z.enum(['bio', 'status']).optional(),
        })
        .parse(req.body);
    await db.transaction(async (tx) => {
      const ms = await canSend(user, cid, tx);
      const [conv] = await tx.query<{ kind: string }>(
        'SELECT kind FROM conversations WHERE id=$1 FOR UPDATE',
        [cid],
      );
      if (conv!.kind !== 'direct' || ms.length !== 2)
        fail(400, 'Unmasked Mode requires two participants');
      const [mode] = await tx.query<{ state: string; inviter_id: string }>(
        'SELECT * FROM unmasked WHERE conversation_id=$1',
        [cid],
      );
      if (b.action === 'invite') {
        if (mode && mode.state !== 'ended') fail(409, 'An invitation is already open');
        await tx.query(
          "INSERT INTO unmasked(conversation_id,inviter_id,state) VALUES($1,$2,'pending') ON CONFLICT(conversation_id) DO UPDATE SET inviter_id=$2,state='pending'",
          [cid, user],
        );
      } else if (b.action === 'accept') {
        if (mode?.state !== 'pending' || mode.inviter_id === user)
          fail(403, 'Only the invited participant can accept');
        await tx.query("UPDATE unmasked SET state='active' WHERE conversation_id=$1", [cid]);
      } else if (b.action === 'end') {
        await tx.query("UPDATE unmasked SET state='ended' WHERE conversation_id=$1", [cid]);
        await tx.query('DELETE FROM disclosures WHERE conversation_id=$1', [cid]);
      } else {
        if (mode?.state !== 'active' || !b.field) fail(400, 'Accept the mode and choose a field');
        if (b.action === 'reveal')
          await tx.query(
            'INSERT INTO disclosures(conversation_id,user_id,field) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
            [cid, user, b.field],
          );
        else
          await tx.query(
            'DELETE FROM disclosures WHERE conversation_id=$1 AND user_id=$2 AND field=$3',
            [cid, user, b.field],
          );
      }
    });
    notify((await members(cid)).map((m) => m.user_id));
    return { ok: true };
  });
  app.get('/moments', async (req) =>
    db.query(
      'SELECT s.*,m.body,m.conversation_id FROM moments s JOIN messages m ON m.id=s.message_id JOIN participants p ON p.conversation_id=m.conversation_id AND p.user_id=s.user_id WHERE s.user_id=$1 AND m.deleted_at IS NULL ORDER BY s.created_at DESC',
      [await uid(req)],
    ),
  );
  app.post('/moments', async (req) => {
    const user = await uid(req),
      b = z.object({ messageId: z.uuid(), note: z.string().max(1000).default('') }).parse(req.body);
    const [m] = await db.query<{ conversation_id: string }>(
      'SELECT * FROM messages WHERE id=$1 AND deleted_at IS NULL',
      [b.messageId],
    );
    if (!m) fail(404, 'Message not found');
    await member(user, m!.conversation_id);
    await db.query(
      'INSERT INTO moments(id,user_id,message_id,note) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,message_id) DO UPDATE SET note=$4',
      [randomUUID(), user, b.messageId, b.note],
    );
    notify([user]);
    return { ok: true };
  });
  app.delete<{ Params: { id: string } }>('/moments/:id', async (req) => {
    const user = await uid(req);
    await db.query('DELETE FROM moments WHERE id=$1 AND user_id=$2', [id(req.params.id), user]);
    notify([user]);
    return { ok: true };
  });
  app.post('/reports', async (req) => {
    const user = await uid(req),
      b = z
        .object({
          userId: z.uuid(),
          messageId: z.uuid().optional(),
          reason: z.string().trim().min(5).max(2000),
          submittedContent: z.string().max(8000).default(''),
        })
        .parse(req.body);
    if (b.messageId) {
      const [m] = await db.query<{ conversation_id: string; sender_id: string }>(
        'SELECT * FROM messages WHERE id=$1',
        [b.messageId],
      );
      if (!m || m.sender_id !== b.userId) fail(400, 'Invalid message');
      await member(user, m!.conversation_id);
    }
    const reportId = randomUUID();
    await db.query(
      'INSERT INTO reports(id,reporter_id,subject_id,message_id,reason,submitted_content) VALUES($1,$2,$3,$4,$5,$6)',
      [reportId, user, b.userId, b.messageId ?? null, b.reason, b.submittedContent],
    );
    return {
      id: reportId,
      message: 'Report recorded for your self-hosting operator. No other messages were submitted.',
    };
  });
  app.get('/account/export', async (req) => {
    const user = await uid(req);
    const [u] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [user]);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: profile(u!),
      messages: await db.query(
        'SELECT m.* FROM messages m JOIN participants p ON p.conversation_id=m.conversation_id WHERE p.user_id=$1',
        [user],
      ),
      contacts: await db.query('SELECT other_id FROM contacts WHERE user_id=$1', [user]),
      moments: await db.query('SELECT * FROM moments WHERE user_id=$1', [user]),
    };
  });
  app.delete('/account', async (req, reply) => {
    const user = await uid(req),
      b = z.object({ confirmation: z.literal('DELETE') }).parse(req.body);
    void b;
    const affected = await db.query<{ user_id: string }>(
      'SELECT DISTINCT user_id FROM participants WHERE conversation_id IN (SELECT conversation_id FROM participants WHERE user_id=$1)',
      [user],
    );
    const sessions = await db.query<{ id: string }>('SELECT id FROM sessions WHERE user_id=$1', [
      user,
    ]);
    await db.transaction(async (tx) => {
      await tx.query("UPDATE messages SET body='',deleted_at=now() WHERE sender_id=$1", [user]);
      await tx.query('DELETE FROM users WHERE id=$1', [user]);
      await tx.query(
        'DELETE FROM conversations WHERE NOT EXISTS(SELECT 1 FROM participants WHERE conversation_id=conversations.id)',
      );
    });
    sessions.forEach((s) => ctx.revoke(s.id));
    notify(affected.filter((p) => p.user_id !== user).map((p) => p.user_id));
    reply.clearCookie('refresh', { path: '/auth' });
    return { ok: true };
  });
}
