// SPDX-License-Identifier: AGPL-3.0-only
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { readFile, mkdir } from 'node:fs/promises';
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function database(url?: string, dir?: string): Promise<Db> {
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 10 });
    const wrap = (client: pg.Pool | pg.PoolClient): Db => ({
      query: async <T>(s: string, p: unknown[] = []) => (await client.query(s, p)).rows as T[],
      transaction: async <T>(fn: (db: Db) => Promise<T>) => {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const result = await fn(wrap(c));
          await c.query('COMMIT');
          return result;
        } catch (e) {
          await c.query('ROLLBACK');
          throw e;
        } finally {
          c.release();
        }
      },
      close: () => pool.end(),
    });
    return wrap(pool);
  }
  if (dir) await mkdir(dir, { recursive: true });
  const p = new PGlite(dir);
  await p.waitReady;
  const wrap = (q: { query: PGlite['query'] }): Db => ({
    query: async <T>(s: string, params: unknown[] = []) => (await q.query(s, params)).rows as T[],
    transaction: (fn) =>
      p.transaction((tx) => fn(wrap(tx as unknown as { query: PGlite['query'] }))),
    close: () => p.close(),
  });
  return wrap(p);
}
export async function migrate(db: Db) {
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const [version, file] of [
    [1, '001_initial.sql'],
    [2, '002_access_tokens.sql'],
    [3, '003_xcenter_identity.sql'],
  ] as const) {
    const sql = await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8');
    await db.transaction(async (tx) => {
      const done = await tx.query('SELECT id FROM schema_migrations WHERE id=$1', [version]);
      if (done.length) return;
      for (const statement of sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.query(statement);
      await tx.query('INSERT INTO schema_migrations(id) VALUES($1)', [version]);
    });
  }
}
