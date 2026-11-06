// SPDX-License-Identifier: AGPL-3.0-only
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sendMessage } from '@unmasked/contracts';
import { type UserRow } from './auth.js';
import { fail } from './security.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from './db.js';
import type { Config } from './config.js';
import type { RouteContext } from './routes.js';
export function registerMessaging(app: FastifyInstance, db: Db, c: Config, ctx: RouteContext) {
  const { uid, id, unblocked, compatible, notify, member, canSend } = ctx;
  app.get('/conversations', async (req) => {
    const user = await uid(req);
    const rows = await db.query<{ id: string }>(
      'SELECT c.*,p.pinned,p.muted FROM conversations c JOIN participants p ON p.conversation_id=c.id WHERE p.user_id=$1 ORDER BY p.pinned DESC,COALESCE((SELECT max(created_at) FROM messages WHERE conversation_id=c.id),c.created_at) DESC',
      [user],
    );
    return Promise.all(
      rows.map(async (row) => {
        const ms = await db.query(
          'SELECT u.id,u.username,u.display_name AS "displayName",p.role,CASE WHEN u.read_receipts THEN p.last_read ELSE NULL END AS last_read FROM participants p JOIN users u ON u.id=p.user_id WHERE p.conversation_id=$1',
          [row.id],
        );
        const [last] = await db.query<{ body: string }>(
          'SELECT body FROM messages WHERE conversation_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 1',
          [row.id],
        );
        const [count] = await db.query<{ count: string }>(
          'SELECT count(*) FROM messages m JOIN participants p ON p.conversation_id=m.conversation_id AND p.user_id=$2 WHERE m.conversation_id=$1 AND m.sender_id<>$2 AND m.deleted_at IS NULL AND (p.last_read IS NULL OR m.created_at>p.last_read)',
          [row.id, user],
        );
        return { ...row, members: ms, latest: last?.body ?? null, unread: Number(count!.count) };
      }),
    );
  });
  app.post('/conversations', async (req, reply) => {
    const user = await uid(req),
      b = z
        .object({
          participants: z.array(z.uuid()).min(1).max(15),
          title: z.string().trim().min(1).max(80).optional(),
        })
        .parse(req.body);
    const others = [...new Set(b.participants)].filter((v) => v !== user);
    if (!others.length) fail(400, 'Choose a contact');
    if (others.length > 1 && !b.title) fail(400, 'Give your group a name');
    const result = await db.transaction(async (tx) => {
      for (const other of others) {
        await unblocked(user, other, tx);
        if (
          !(
            await tx.query('SELECT 1 FROM contacts WHERE user_id=$1 AND other_id=$2', [user, other])
          ).length
        )
          fail(403, 'Connect before starting a conversation');
      }
      const all = [user, ...others];
      for (let a = 0; a < all.length; a++)
        for (let b = a + 1; b < all.length; b++) await compatible(all[a]!, all[b]!, tx);
      const direct = others.length === 1;
      const key = direct ? [user, ...others].sort().join(':') : null;
      const [row] = await tx.query<{ id: string }>(
        'INSERT INTO conversations(id,kind,title,direct_key) VALUES($1,$2,$3,$4) ON CONFLICT(direct_key) DO UPDATE SET direct_key=EXCLUDED.direct_key RETURNING id',
        [randomUUID(), direct ? 'direct' : 'group', direct ? null : b.title, key],
      );
      for (const who of [user, ...others])
        await tx.query(
          'INSERT INTO participants(conversation_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [row!.id, who, who === user ? 'admin' : 'member'],
        );
      return row!;
    });
    notify([user, ...others]);
    reply.code(201);
    return result;
  });
  app.patch<{ Params: { id: string } }>('/conversations/:id', async (req) => {
    const user = await uid(req),
      cid = id(req.params.id);
    await member(user, cid);
    const b = z
      .object({ pinned: z.boolean().optional(), muted: z.boolean().optional() })
      .parse(req.body);
    await db.query(
      'UPDATE participants SET pinned=COALESCE($1,pinned),muted=COALESCE($2,muted) WHERE conversation_id=$3 AND user_id=$4',
      [b.pinned ?? null, b.muted ?? null, cid, user],
    );
    notify([user]);
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/conversations/:id/export', async (req) => {
    const user = await uid(req),
      cid = id(req.params.id);
    await member(user, cid);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      messages: await db.query(
        'SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at,id',
        [cid],
      ),
    };
  });
  app.get<{ Params: { id: string }; Querystring: { before?: string; q?: string } }>(
    '/conversations/:id/messages',
    async (req) => {
      const user = await uid(req),
        cid = id(req.params.id);
      await member(user, cid);
      let beforeDate: string | null = null,
        beforeId: string | null = null;
      if (req.query.before) {
        let decoded: unknown;
        try {
          decoded = JSON.parse(Buffer.from(req.query.before, 'base64url').toString());
        } catch {
          fail(400, 'Invalid message cursor');
        }
        const cursor = z.object({ at: z.iso.datetime(), id: z.uuid() }).parse(decoded);
        beforeDate = cursor.at;
        beforeId = cursor.id;
      }
      const search = z.string().max(100).optional().parse(req.query.q);
      const rows = await db.query<{ id: string; created_at: Date | string; cursor_at: string }>(
        "SELECT m.*,to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor_at,COALESCE((SELECT json_agg(json_build_object('userId',r.user_id,'emoji',r.emoji)) FROM reactions r WHERE r.message_id=m.id),'[]') AS reactions FROM messages m WHERE m.conversation_id=$1 AND ($2::timestamptz IS NULL OR (m.created_at,m.id)<($2::timestamptz,$3::uuid)) AND ($4::text IS NULL OR (m.deleted_at IS NULL AND position(lower($4) in lower(m.body))>0)) ORDER BY m.created_at DESC,m.id DESC LIMIT 50",
        [cid, beforeDate, beforeId, search ?? null],
      );
      const last = rows.at(-1);
      return {
        messages: rows.reverse().map(({ cursor_at: _cursor, ...message }) => message),
        nextCursor:
          rows.length === 50 && last
            ? Buffer.from(JSON.stringify({ at: last.cursor_at, id: last.id })).toString('base64url')
            : null,
      };
    },
  );
  app.post<{ Params: { id: string } }>('/conversations/:id/messages', async (req, reply) => {
    const user = await uid(req),
      cid = id(req.params.id),
      b = sendMessage.parse(req.body);
    const result = await db.transaction(async (tx) => {
      const ms = await canSend(user, cid, tx);
      if (
        b.replyTo &&
        !(
          await tx.query(
            'SELECT 1 FROM messages WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL',
            [b.replyTo, cid],
          )
        ).length
      )
        fail(400, 'Reply target unavailable');
      const [m] = await tx.query<{
        id: string;
        sender_id: string;
        conversation_id: string;
        body: string;
        reply_to: string | null;
      }>(
        'INSERT INTO messages(id,conversation_id,sender_id,body,reply_to) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING *',
        [b.id, cid, user, b.text, b.replyTo ?? null],
      );
      const existing =
        m ?? (await tx.query<typeof m>('SELECT * FROM messages WHERE id=$1', [b.id]))[0];
      if (
        !existing ||
        existing.sender_id !== user ||
        existing.conversation_id !== cid ||
        existing.body !== b.text ||
        existing.reply_to !== (b.replyTo ?? null)
      )
        fail(409, 'Message ID conflict');
      return { message: existing, members: ms };
    });
    notify(result.members.map((m) => m.user_id));
    reply.code(201);
    return result.message;
  });
  app.patch<{ Params: { id: string } }>('/messages/:id', async (req) => {
    const user = await uid(req),
      mid = id(req.params.id),
      b = z.object({ text: z.string().trim().min(1).max(8000) }).parse(req.body);
    const [m] = await db.query<{ conversation_id: string }>(
      'SELECT * FROM messages WHERE id=$1 AND sender_id=$2 AND deleted_at IS NULL',
      [mid, user],
    );
    if (!m) fail(404, 'Message not found');
    const ms = await canSend(user, m!.conversation_id);
    await db.query('UPDATE messages SET body=$1,edited_at=now() WHERE id=$2', [b.text, mid]);
    notify(ms.map((m) => m.user_id));
    return { ok: true };
  });
  app.delete<{ Params: { id: string } }>('/messages/:id', async (req) => {
    const user = await uid(req),
      mid = id(req.params.id);
    const [m] = await db.query<{ conversation_id: string }>(
      'SELECT * FROM messages WHERE id=$1 AND sender_id=$2',
      [mid, user],
    );
    if (!m) fail(404, 'Message not found');
    const ms = await member(user, m!.conversation_id);
    await db.transaction(async (tx) => {
      await tx.query("UPDATE messages SET body='',deleted_at=now() WHERE id=$1", [mid]);
      await tx.query('DELETE FROM reactions WHERE message_id=$1', [mid]);
      await tx.query('DELETE FROM moments WHERE message_id=$1', [mid]);
    });
    notify(ms.map((m) => m.user_id));
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/messages/:id/reactions', async (req) => {
    const user = await uid(req),
      mid = id(req.params.id),
      b = z.object({ emoji: z.enum(['❤️', '👍', '😂', '✨', '🙏']) }).parse(req.body);
    const [m] = await db.query<{ conversation_id: string }>(
      'SELECT * FROM messages WHERE id=$1 AND deleted_at IS NULL',
      [mid],
    );
    if (!m) fail(404, 'Message not found');
    const ms = await canSend(user, m!.conversation_id);
    await db.transaction(async (tx) => {
      const removed = await tx.query(
        'DELETE FROM reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3 RETURNING *',
        [mid, user, b.emoji],
      );
      if (!removed.length)
        await tx.query(
          'INSERT INTO reactions(message_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [mid, user, b.emoji],
        );
    });
    notify(ms.map((m) => m.user_id));
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/conversations/:id/read', async (req) => {
    const user = await uid(req),
      cid = id(req.params.id);
    const ms = await member(user, cid);
    await db.query(
      'UPDATE participants SET last_read=now() WHERE conversation_id=$1 AND user_id=$2',
      [cid, user],
    );
    const [u] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [user]);
    notify(u!.read_receipts ? ms.map((m) => m.user_id) : [user]);
    return { ok: true };
  });
}
