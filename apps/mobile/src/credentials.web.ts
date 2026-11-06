// SPDX-License-Identifier: AGPL-3.0-only
// Web refresh credentials are sent only as HttpOnly SameSite cookies.
export const credentials = {
  read: async (): Promise<string | null> => null,
  write: async (_v: string) => {},
  clear: async () => {},
};
