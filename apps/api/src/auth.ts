// SPDX-License-Identifier: AGPL-3.0-only
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { registration, login, password } from '@unmasked/contracts';
import type { Db } from './db.js';
import type { Config } from './config.js';
import { hash, token, passwordHash, verifyPassword, fail } from './security.js';
export interface Session {
  id: string;
  user_id: string;
  access_hash: string;
  refresh_hash: string;
}
export interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string;
  password_hash: string;
  verified: boolean;
  age_band: 'minor' | 'adult';
  bio: string;
  status: string;
  discoverable: boolean;
  read_receipts: boolean;
  typing_indicators: boolean;
}
export const profile = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  username: u.username,
  displayName: u.display_name,
  verified: u.verified,
  ageBand: u.age_band,
  bio: u.bio,
  status: u.status,
  discoverable: u.discoverable,
  readReceipts: u.read_receipts,
  typingIndicators: u.typing_indicators,
});
export function authService(db: Db, c: Config, revoke: (sid: string) => void) {
  const mailbox: { email: string; purpose: string; token: string }[] = [];
  async function requireSession(req: FastifyRequest) {
    const raw = req.headers.authorization?.replace(/^Bearer /, '');
    if (!raw) fail(401, 'Please sign in');
    return authenticate(raw!);
  }
  async function authenticate(raw: string) {
    const [s] = await db.query<Session>(
      'SELECT s.* FROM sessions s JOIN access_tokens a ON a.session_id=s.id WHERE a.token_hash=$1 AND a.expires_at>now() AND s.expires_at>now()',
      [hash(raw)],
    );
    if (!s) fail(401, 'Session expired');
    return s!;
  }
  async function mail(user: UserRow, purpose: string) {
    const raw = token();
    await db.query(
      "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
      [hash(raw), user.id, purpose],
    );
    if (c.SMTP_URL) {
      await nodemailer.createTransport(c.SMTP_URL).sendMail({
        from: c.MAIL_FROM,
        to: user.email,
        subject:
          purpose === 'verify' ? 'Verify your Unmasked account' : 'Reset your Unmasked password',
        text: `Your ${purpose} code is: ${raw}\nExpires in 30 minutes. Never share this code.`,
      });
    } else if (c.NODE_ENV !== 'production') {
      mailbox.push({ email: user.email, purpose, token: raw });
    }
  }
  async function issue(user: UserRow, device: string, reply: FastifyReply) {
    const access = token(),
      refresh = token(),
      id = randomUUID();
    await db.query(
      "INSERT INTO sessions(id,user_id,access_hash,refresh_hash,access_until,expires_at,device) VALUES($1,$2,$3,$4,now()+interval '15 minutes',now()+interval '30 days',$5)",
      [id, user.id, hash(access), hash(refresh), device],
    );
    await db.query(
      "INSERT INTO access_tokens(token_hash,session_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')",
      [hash(access), id],
    );
    reply.setCookie('refresh', refresh, {
      httpOnly: true,
      secure: c.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: 2592000,
    });
    return { accessToken: access, refreshToken: refresh, profile: profile(user), sessionId: id };
  }
  async function registerRoutes(app: FastifyInstance) {
    app.post(
      '/auth/register',
      { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const b = registration.parse(req.body);
        const user = await db.transaction(async (tx) => {
          const [u] = await tx.query<UserRow>(
            'INSERT INTO users(id,email,username,display_name,password_hash,age_band) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
            [
              randomUUID(),
              b.email,
              b.username,
              b.displayName,
              await passwordHash(b.password),
              b.ageBand,
            ],
          );
          return u!;
        });
        await mail(user, 'verify');
        reply.code(201);
        return { message: 'Check your email for a verification code.' };
      },
    );
    app.post('/auth/verify', async (req) => {
      const b = z.object({ token: z.string().min(20).max(100) }).parse(req.body);
      await db.transaction(async (tx) => {
        const [t] = await tx.query<{ user_id: string }>(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='verify' AND expires_at>now() RETURNING user_id",
          [hash(b.token)],
        );
        if (!t) fail(400, 'Invalid or expired code');
        await tx.query('UPDATE users SET verified=true WHERE id=$1', [t!.user_id]);
      });
      return { message: 'Email verified. You can sign in.' };
    });
    app.post(
      '/auth/login',
      { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const b = login.parse(req.body);
        const [u] = await db.query<UserRow>('SELECT * FROM users WHERE email=$1', [b.email]);
        if (!u || !(await verifyPassword(b.password, u.password_hash)))
          fail(401, 'Email or password is incorrect');
        if (!u!.verified) fail(403, 'Verify your email before signing in');
        return issue(u!, b.device, reply);
      },
    );
    app.post('/auth/refresh', async (req, reply) => {
      const b = z.object({ refreshToken: z.string().max(100).optional() }).parse(req.body ?? {});
      const raw = req.cookies.refresh ?? b.refreshToken;
      if (!raw) fail(401, 'Please sign in');
      const access = token(),
        refresh = token();
      const s = await db.transaction(async (tx) => {
        const [row] = await tx.query<Session>(
          "UPDATE sessions SET access_hash=$1,refresh_hash=$2,access_until=now()+interval '15 minutes' WHERE refresh_hash=$3 AND expires_at>now() RETURNING *",
          [hash(access), hash(refresh), hash(raw!)],
        );
        if (!row) fail(401, 'Refresh session expired or already used');
        await tx.query(
          "INSERT INTO access_tokens(token_hash,session_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')",
          [hash(access), row!.id],
        );
        return row!;
      });
      reply.setCookie('refresh', refresh, {
        httpOnly: true,
        secure: c.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth',
        maxAge: 2592000,
      });
      const [u] = await db.query<UserRow>('SELECT * FROM users WHERE id=$1', [s.user_id]);
      return { accessToken: access, refreshToken: refresh, profile: profile(u!), sessionId: s.id };
    });
    app.post('/auth/logout', async (req, reply) => {
      const s = await requireSession(req);
      await db.query('DELETE FROM sessions WHERE id=$1', [s.id]);
      revoke(s.id);
      reply.clearCookie('refresh', { path: '/auth' });
      return { ok: true };
    });
    app.post(
      '/auth/resend',
      { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
      async (req) => {
        const b = z.object({ email: z.email().transform((v) => v.toLowerCase()) }).parse(req.body);
        const [u] = await db.query<UserRow>('SELECT * FROM users WHERE email=$1', [b.email]);
        if (u && !u.verified) await mail(u, 'verify');
        return { message: 'If an unverified account exists, a fresh code has been sent.' };
      },
    );
    app.post(
      '/auth/forgot',
      { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
      async (req) => {
        const b = z.object({ email: z.email().transform((v) => v.toLowerCase()) }).parse(req.body);
        const [u] = await db.query<UserRow>('SELECT * FROM users WHERE email=$1', [b.email]);
        if (u) await mail(u, 'reset');
        return { message: 'If an account exists, a reset code has been sent.' };
      },
    );
    app.post('/auth/reset', async (req) => {
      const b = z.object({ token: z.string().min(20).max(100), password }).parse(req.body);
      const ids = await db.transaction(async (tx) => {
        const [t] = await tx.query<{ user_id: string }>(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='reset' AND expires_at>now() RETURNING user_id",
          [hash(b.token)],
        );
        if (!t) fail(400, 'Invalid or expired code');
        await tx.query('UPDATE users SET password_hash=$1 WHERE id=$2', [
          await passwordHash(b.password),
          t!.user_id,
        ]);
        await tx.query("DELETE FROM auth_tokens WHERE user_id=$1 AND purpose='reset'", [
          t!.user_id,
        ]);
        return tx.query<{ id: string }>('DELETE FROM sessions WHERE user_id=$1 RETURNING id', [
          t!.user_id,
        ]);
      });
      ids.forEach((s) => revoke(s.id));
      return { message: 'Password reset. Sign in again on your devices.' };
    });
    app.get('/sessions', async (req) => {
      const s = await requireSession(req);
      return db.query(
        'SELECT id,device,created_at,expires_at FROM sessions WHERE user_id=$1 ORDER BY created_at DESC',
        [s.user_id],
      );
    });
    app.delete<{ Params: { id: string } }>('/sessions/:id', async (req) => {
      const s = await requireSession(req);
      const id = z.uuid().parse(req.params.id);
      await db.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2', [id, s.user_id]);
      revoke(id);
      return { ok: true };
    });
  }
  return { requireSession, authenticate, registerRoutes, mailbox };
}
