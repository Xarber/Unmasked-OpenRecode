// SPDX-License-Identifier: AGPL-3.0-only
import { config } from './config.js';
import { database, migrate } from './db.js';
const c = config();
const db = await database(c.DATABASE_URL || undefined, c.DATA_DIR);
await migrate(db);
await db.close();
console.log('Migrations applied');
