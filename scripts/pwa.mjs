// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const dir = 'apps/mobile/dist';
const commit = process.env.EXPO_PUBLIC_BUILD_COMMIT;
if (commit) {
  const { version } = JSON.parse(await fs.readFile('apps/mobile/app.json', 'utf8')).expo;
  await fs.writeFile(
    path.join(dir, '__build.json'),
    JSON.stringify({
      version,
      commit,
      mode: process.env.EXPO_PUBLIC_WEB_PREVIEW === '1' ? 'preview' : 'app',
    }),
  );
}
async function walk(p) {
  return (
    await Promise.all(
      (await fs.readdir(p, { withFileTypes: true })).map((x) =>
        x.isDirectory() ? walk(path.join(p, x.name)) : [path.join(p, x.name)],
      ),
    )
  ).flat();
}
const files = (await walk(dir)).sort().filter((p) => !p.endsWith('sw.js') && !p.endsWith('.map'));
const urls = files.map((p) => '/' + path.relative(dir, p).split(path.sep).join('/'));
const revision = createHash('sha256');
for (const f of files) revision.update(await fs.readFile(f));
const cache = 'unmasked-shell-' + revision.digest('hex').slice(0, 16);
await fs.writeFile(
  path.join(dir, 'sw.js'),
  `const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('unmasked-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||(u.pathname==='/api'||u.pathname.startsWith('/api/'))||u.pathname.startsWith('/auth/')||u.pathname.startsWith('/socket.io/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(u.pathname.startsWith('/about/')&&u.pathname.endsWith('.html')?u.pathname:'/index.html')));return;}if(ASSETS.includes(u.pathname))event.respondWith(caches.open(CACHE).then(c=>c.match(event.request).then(r=>r||fetch(event.request))));});`,
);
console.log(
  `Generated ${cache}: ${urls.length} public shell assets. Private API responses excluded.`,
);
