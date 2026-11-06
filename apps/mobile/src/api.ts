// SPDX-License-Identifier: AGPL-3.0-only
import { withRefreshLock } from './refreshLock';
import { Platform } from 'react-native';
import { credentials } from './credentials';
import type { Profile } from '@unmasked/contracts';
export const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
let access: string | null = null;
let refreshPromise: Promise<AuthResult> | null = null;
let onAuthLost = () => {};
export const authLost = (cb: () => void) => {
  onAuthLost = cb;
};
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  profile: Profile;
  sessionId: string;
}
export function accessToken() {
  return access;
}
export async function acceptAuth(result: AuthResult) {
  access = result.accessToken;
  if (Platform.OS !== 'web') await credentials.write(result.refreshToken);
  return result;
}
export async function clearAuth() {
  access = null;
  await credentials.clear();
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function refresh() {
  if (!refreshPromise)
    refreshPromise = withRefreshLock(async () => {
      const refreshToken = await credentials.read();
      const r = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
      if (!r.ok) throw new ApiError(r.status, 'Sign in to continue');
      return acceptAuth((await r.json()) as AuthResult);
    }).finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
export async function api<T = unknown>(
  path: string,
  method = 'GET',
  body?: unknown,
  retry = true,
): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refresh();
      return api<T>(path, method, body, false);
    } catch (e) {
      if (e instanceof ApiError) {
        await clearAuth();
        onAuthLost();
      }
      throw e;
    }
  }
  if (!r.ok) {
    const data = (await r.json().catch(() => ({ message: 'Request failed' }))) as {
      message: string;
    };
    throw new ApiError(r.status, data.message);
  }
  return r.json() as Promise<T>;
}
