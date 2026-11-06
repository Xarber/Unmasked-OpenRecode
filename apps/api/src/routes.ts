// SPDX-License-Identifier: AGPL-3.0-only
import type { FastifyRequest } from 'fastify';
import type { Db } from './db.js';
import type { UserRow } from './auth.js';
export interface Member {
  user_id: string;
  role: string;
}
export interface RouteContext {
  compatible: (a: string, b: string, db?: Db) => Promise<void>;
  revoke: (sessionId: string) => void;
  uid: (req: FastifyRequest) => Promise<string>;
  id: (value: unknown) => string;
  unblocked: (a: string, b: string, db?: Db) => Promise<void>;
  notify: (ids: string[]) => void;
  member: (user: string, cid: string, db?: Db) => Promise<Member[]>;
  members: (cid: string, db?: Db) => Promise<Member[]>;
  canSend: (user: string, cid: string, db?: Db) => Promise<Member[]>;
  person: (user: UserRow) => { id: string; username: string; displayName: string };
}
