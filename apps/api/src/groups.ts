// SPDX-License-Identifier: AGPL-3.0-only
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from './db.js';
import type { RouteContext } from './routes.js';
import { fail } from './security.js';
export function registerGroups(app: FastifyInstance, db: Db, ctx: RouteContext) {
  const { uid, id, member, compatible, notify } = ctx;
  app.post<{ Params: { id: string } }>('/conversations/:id/membership', async (req) => {
    const user = await uid(req),
      cid = id(req.params.id),
      b = z
        .object({
          action: z.enum(['add', 'remove', 'promote', 'leave', 'rename']),
          userId: z.uuid().optional(),
          title: z.string().trim().min(1).max(80).optional(),
        })
        .parse(req.body);
    const affected = await db.transaction(async (tx) => {
      const [conv] = await tx.query<{ kind: string }>(
        'SELECT kind FROM conversations WHERE id=$1 FOR UPDATE',
        [cid],
      );
      if (!conv || conv.kind !== 'group') fail(404, 'Group not found');
      const ms = await member(user, cid, tx);
      const me = ms.find((p) => p.user_id === user)!;
      const target = b.action === 'leave' ? user : b.userId;
      if (b.action !== 'leave' && me.role !== 'admin')
        fail(403, 'Only group administrators can manage this group');
      if (b.action === 'rename') {
        if (!b.title) fail(400, 'A group name is required');
        await tx.query('UPDATE conversations SET title=$1 WHERE id=$2', [b.title, cid]);
      } else if (b.action === 'add') {
        if (!target || ms.length >= 16) fail(400, 'Group limit is 16 participants');
        if (
          !(
            await tx.query('SELECT 1 FROM contacts WHERE user_id=$1 AND other_id=$2', [
              user,
              target,
            ])
          ).length
        )
          fail(403, 'Only accepted contacts can be invited');
        for (const m of ms) await compatible(m.user_id, target!, tx);
        await tx.query(
          'INSERT INTO participants(conversation_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [cid, target],
        );
      } else if (b.action === 'promote') {
        if (!target || !ms.some((m) => m.user_id === target)) fail(404, 'Participant not found');
        await tx.query(
          "UPDATE participants SET role='admin' WHERE conversation_id=$1 AND user_id=$2",
          [cid, target],
        );
      } else {
        if (!target || !ms.some((m) => m.user_id === target)) fail(404, 'Participant not found');
        const isLastAdmin =
          ms.find((m) => m.user_id === target)?.role === 'admin' &&
          ms.filter((m) => m.role === 'admin').length === 1;
        if (isLastAdmin && ms.length > 1) fail(409, 'Promote another administrator before leaving');
        await tx.query('DELETE FROM participants WHERE conversation_id=$1 AND user_id=$2', [
          cid,
          target,
        ]);
        if (ms.length === 1) await tx.query('DELETE FROM conversations WHERE id=$1', [cid]);
      }
      return [...ms.map((m) => m.user_id), ...(target ? [target] : [])];
    });
    notify(affected);
    return { ok: true };
  });
}
