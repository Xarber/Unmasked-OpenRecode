// SPDX-License-Identifier: AGPL-3.0-only
export const openWelcome: (() => void) | undefined = () => {
  window.dispatchEvent(new Event('unmasked:welcome'));
};
