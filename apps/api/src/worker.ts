// SPDX-License-Identifier: AGPL-3.0-only
import { config } from './config.js';
import { database } from './db.js';
const c = config();
if (!c.DATABASE_URL)
  throw Error(
    'Standalone worker requires server PostgreSQL; embedded development database is owned by the API',
  );
const db = await database(c.DATABASE_URL);
async function clean() {
  await db.query('DELETE FROM access_tokens WHERE expires_at<now()');
  await db.query('DELETE FROM auth_tokens WHERE expires_at<now()');
  await db.query('DELETE FROM sessions WHERE expires_at<now()');
}
await clean();
const interval = setInterval(
  () => void clean().catch(() => console.error('Maintenance cleanup failed')),
  60000,
);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    clearInterval(interval);
    void db.close().then(() => process.exit(0));
  });
