// SPDX-License-Identifier: AGPL-3.0-only
import { api } from './api';
import { read, write } from './storage';
// Only network failures may use stale cache; authorization errors must never fall back.
export async function cachedApi<T>(userId: string, path: string, key: string): Promise<T> {
  const storageKey = `account:${userId}:cache:${key}`;
  try {
    const result = await api<T>(path);
    await write(storageKey, result);
    return result;
  } catch (e) {
    if (e instanceof TypeError) {
      const cached = await read<T | null>(storageKey, null);
      if (cached !== null) return cached;
    }
    throw e;
  }
}
