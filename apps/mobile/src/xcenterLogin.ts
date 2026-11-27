// SPDX-License-Identifier: AGPL-3.0-only
export const xcenterWebAvailable = false as boolean;
export async function startXCenterLogin(
  _intent: { mode: 'signin' } | { mode: 'link'; password: string },
) {}
export function xcenterLoginResult(): string | null {
  return null;
}
