// SPDX-License-Identifier: AGPL-3.0-only
// Development fixtures only: never run against a production database.
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { database, migrate } from './db.js';
import { createApp } from './app.js';
import { dirname, join } from 'node:path';
const c = config();
if (c.NODE_ENV !== 'development' || c.DATABASE_URL || c.SMTP_URL)
  throw Error('Seed requires the isolated embedded development database without SMTP');
const db = await database(undefined, c.DATA_DIR);
await migrate(db);
if ((await db.query('SELECT 1 FROM users LIMIT 1')).length)
  throw Error('Seed only runs on an empty development database; existing accounts were preserved');
const { app, auth } = await createApp(db, c);
const password = randomBytes(18).toString('base64url');
const call = async (path: string, body: unknown, access?: string) => {
  const r = await app.inject({
    method: 'POST',
    url: path,
    payload: body as object,
    headers: access ? { authorization: `Bearer ${access}` } : {},
  });
  if (r.statusCode >= 400) throw Error(r.body);
  return r.json();
};
try {
  const accounts = [];
  for (const [username, displayName] of [
    ['alice_dev', 'Alice · demo'],
    ['bob_dev', 'Bob · demo'],
  ]) {
    const email = `${username}@example.invalid`;
    await call('/auth/register', { username, displayName, email, password, ageBand: 'adult' });
    await call('/auth/verify', { token: auth.mailbox.find((m) => m.email === email)!.token });
    accounts.push({
      email,
      password,
      ...(await call('/auth/login', { email, password, device: 'Development seed' })),
    });
  }
  const [alice, bob] = accounts;
  const invitation = new URL(
    (await call('/connections/invitation', {}, bob.accessToken)).url,
  ).searchParams.get('invitation');
  await call('/connections/requests', { username: 'bob_dev', invitation }, alice.accessToken);
  const r = await app.inject({
    url: '/connections',
    headers: { authorization: `Bearer ${bob.accessToken}` },
  });
  await call(
    `/connections/requests/${r.json().requests[0].id}/respond`,
    { accept: true },
    bob.accessToken,
  );
  const conv = await call('/conversations', { participants: [bob.profile.id] }, alice.accessToken);
  const { randomUUID } = await import('node:crypto');
  for (const [who, text] of [
    [alice, 'This is a seeded development conversation, separate from production.'],
    [bob, 'A quiet little space to try Unmasked. No real messages or people are represented here.'],
  ])
    await call(`/conversations/${conv.id}/messages`, { id: randomUUID(), text }, who.accessToken);
  const path = join(dirname(c.DATA_DIR), 'development-accounts.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      {
        environment: 'development fixtures only',
        accounts: accounts.map((a) => ({ email: a.email, password: a.password })),
        conversationId: conv.id,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(`Development fixtures created. Local credentials: ${path}`);
} finally {
  await app.close();
  await db.close();
}
