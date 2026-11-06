// SPDX-License-Identifier: AGPL-3.0-only
import * as SecureStore from 'expo-secure-store';
export const credentials = {
  read: () => SecureStore.getItemAsync('unmasked.refresh'),
  write: (v: string) => SecureStore.setItemAsync('unmasked.refresh', v),
  clear: () => SecureStore.deleteItemAsync('unmasked.refresh'),
};
