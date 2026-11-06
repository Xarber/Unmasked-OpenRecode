// SPDX-License-Identifier: AGPL-3.0-only
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().optional(),
  DATA_DIR: z.string().default('.data/unmasked'),
  WEB_ORIGIN: z.url().default('http://localhost:8081'),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Unmasked <noreply@example.invalid>'),
});
export function config() {
  const c = schema.parse(process.env);
  if (
    c.NODE_ENV === 'production' &&
    (!c.DATABASE_URL || !c.SMTP_URL || !c.WEB_ORIGIN.startsWith('https://'))
  )
    throw new Error('Production requires PostgreSQL, SMTP and an HTTPS web origin');
  c.DATA_DIR = resolve(fileURLToPath(new URL('../../../', import.meta.url)), c.DATA_DIR);
  return c;
}
export type Config = ReturnType<typeof config>;
