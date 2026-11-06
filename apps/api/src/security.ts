// SPDX-License-Identifier: AGPL-3.0-only
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
export const token = () => randomBytes(32).toString('base64url');
export const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const derive = (v: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(v, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) =>
      e ? reject(e) : resolve(k),
    ),
  );
export async function passwordHash(v: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(v, salt)).toString('hex')}`;
}
export async function verifyPassword(v: string, stored: string) {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const actual = await derive(v, salt);
  const expected = Buffer.from(key, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (code: number, message: string): never => {
  throw new HttpError(code, message);
};
