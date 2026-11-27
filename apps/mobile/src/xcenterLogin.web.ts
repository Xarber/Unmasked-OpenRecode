// SPDX-License-Identifier: AGPL-3.0-only
import { api } from './api';

const pendingKey = 'unmasked:xcenter:pending';
export const xcenterWebAvailable = true;

export async function startXCenterLogin(
  intent: { mode: 'signin' } | { mode: 'link'; password: string },
) {
  const response = await api<{ authorizationUrl: string }>('/auth/xcenter/start', 'POST', intent);
  const authorization = new URL(response.authorizationUrl);
  if (
    authorization.origin !== 'https://id.xcenter.it' ||
    authorization.username ||
    authorization.password
  ) {
    throw new Error('Unexpected X-Center ID sign-in destination');
  }
  sessionStorage.setItem(pendingKey, intent.mode);
  window.location.assign(authorization.href);
}

export function xcenterLoginResult(): string | null {
  try {
    const url = new URL(window.location.href);
    const result = url.searchParams.get('xcenter');
    if (!result) return null;
    const pending = sessionStorage.getItem(pendingKey);
    if (!pending) return null;
    sessionStorage.removeItem(pendingKey);
    url.searchParams.delete('xcenter');
    window.history.replaceState(window.history.state, '', url.href);
    return result === 'signed-in' && pending !== 'signin' ? null : result;
  } catch {
    return null;
  }
}
