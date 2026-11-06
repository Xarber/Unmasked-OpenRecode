// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const dir = 'apps/mobile/dist';
const htmlPath = path.join(dir, 'index.html');
let html = await fs.readFile(htmlPath, 'utf8');
html = html
  .replace(
    'width=device-width, initial-scale=1, shrink-to-fit=no',
    'width=device-width, initial-scale=1, viewport-fit=cover',
  )
  .replace(
    '</head>',
    `<link rel="manifest" href="/manifest.webmanifest"/><link rel="apple-touch-icon" href="/apple-touch-icon.png"/><meta name="theme-color" content="#6269F5"/><meta name="description" content="Unmasked — a quieter space for genuine conversations."/><style>html,body,#root{height:100dvh;overscroll-behavior:none}html{-webkit-tap-highlight-color:transparent}button,a,[role=button]{touch-action:manipulation}*:focus-visible{outline:2px solid #6269F5;outline-offset:3px}input,textarea{font-size:16px}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}}</style></head>`,
  );
await fs.writeFile(htmlPath, html);
async function walk(p) {
  return (
    await Promise.all(
      (await fs.readdir(p, { withFileTypes: true })).map((x) =>
        x.isDirectory() ? walk(path.join(p, x.name)) : [path.join(p, x.name)],
      ),
    )
  ).flat();
}
const files = (await walk(dir)).filter((p) => !p.endsWith('sw.js') && !p.endsWith('.map'));
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
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/auth/')||u.pathname.startsWith('/socket.io/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return;}if(ASSETS.includes(u.pathname))event.respondWith(caches.open(CACHE).then(c=>c.match(event.request).then(r=>r||fetch(event.request))));});`,
);
console.log(
  `Generated ${cache}: ${urls.length} public shell assets. Private API responses excluded.`,
);
