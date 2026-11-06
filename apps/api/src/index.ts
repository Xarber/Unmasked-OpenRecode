// SPDX-License-Identifier: AGPL-3.0-only
import { config } from './config.js';
import { database, migrate } from './db.js';
import { createApp } from './app.js';
const c = config();
if (
  c.NODE_ENV !== 'production' &&
  !['127.0.0.1', 'localhost', '::1'].includes(c.HOST) &&
  !c.SMTP_URL
)
  throw Error('Development mailbox requires a loopback host. Configure SMTP before LAN access.');
const db = await database(c.DATABASE_URL || undefined, c.DATA_DIR);
await migrate(db);
const { app, auth } = await createApp(db, c);
if (c.NODE_ENV === 'development' && !c.SMTP_URL)
  app.get('/dev/mailbox', async (req) => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip)) return [];
    return {
      warning: 'LOCAL DEVELOPMENT ONLY — email delivery is disabled',
      messages: auth.mailbox,
    };
  });
await app.listen({ host: c.HOST, port: c.PORT });
console.log(
  `Unmasked API: http://${c.HOST}:${c.PORT} (${c.NODE_ENV}, ${c.DATABASE_URL ? 'PostgreSQL' : 'embedded PostgreSQL'})`,
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(
    signal,
    () =>
      void app
        .close()
        .then(() => db.close())
        .then(() => process.exit(0)),
  );
