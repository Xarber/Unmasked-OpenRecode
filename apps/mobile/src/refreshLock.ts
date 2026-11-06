// SPDX-License-Identifier: AGPL-3.0-only
export const withRefreshLock = <T>(action: () => Promise<T>): Promise<T> => action();
