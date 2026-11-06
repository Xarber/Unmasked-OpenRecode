// SPDX-License-Identifier: AGPL-3.0-only
// Coordinate rotating HttpOnly refresh cookies across tabs without storing secrets in JS storage.
export const withRefreshLock = async <T>(action: () => Promise<T>): Promise<T> =>
  navigator.locks ? await navigator.locks.request('unmasked-refresh', action) : await action();
