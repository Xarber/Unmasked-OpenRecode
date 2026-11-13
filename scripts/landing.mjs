// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
const root = new URL('../', import.meta.url),
  out = new URL('apps/mobile/public/about/', root);
await fs.mkdir(out, { recursive: true });
for (const [source, target] of [
  ['assets/branding/icon-master.svg', 'icon.svg'],
  ['docs/reports/unmasked-chat-desktop.png', 'conversation.png'],
  ['LICENSE', 'LICENSE.txt'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.txt'],
  ['LICENSES/expo-starter-MIT.txt', 'expo-starter-MIT.txt'],
])
  await fs.copyFile(new URL(source, root), new URL(target, out));
console.log('Prepared landing page assets from original branding, real QA screenshot and licenses');
await fs.copyFile(
  new URL('apps/mobile/landing.html', root),
  new URL('apps/mobile/public/index.html', root),
);
