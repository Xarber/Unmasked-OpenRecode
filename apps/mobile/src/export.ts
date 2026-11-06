// SPDX-License-Identifier: AGPL-3.0-only
import { Share } from 'react-native';
export async function exportText(name: string, text: string) {
  await Share.share({ title: name, message: text });
}
