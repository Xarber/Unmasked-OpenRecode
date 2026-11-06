// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
import sharp from 'sharp';
const root = new URL('../', import.meta.url);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>Unmasked — open conversation</title><g id="background"><rect width="1024" height="1024" rx="230" fill="#6269F5"/></g><g id="symbol" fill="none" stroke="#fff" stroke-width="76" stroke-linecap="round" stroke-linejoin="round"><path id="open-u" d="M310 340v205c0 130 98 205 202 205s202-75 202-205V340"/><path id="conversation-tail" d="m602 728 87 87"/></g><g id="highlight"><circle cx="512" cy="280" r="34" fill="#D8DAFF"/></g></svg>`;
await fs.writeFile(new URL('assets/branding/icon-master.svg', root), svg);
const out = new URL('apps/mobile/public/', root);
for (const size of [192, 512, 1024])
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(new URL(`icon-${size}.png`, out).pathname);
await sharp(Buffer.from(svg))
  .resize(180, 180)
  .png()
  .toFile(new URL('apple-touch-icon.png', out).pathname);
const fg = svg.replace(/<g id="background">.*?<\/g>/, '');
await sharp(Buffer.from(fg)).png().toFile(new URL('adaptive-foreground.png', out).pathname);
await sharp(Buffer.from(fg.replaceAll('#D8DAFF', '#fff')))
  .png()
  .toFile(new URL('monochrome.png', out).pathname);
for (const [name, bg, stroke] of [
  ['dark', '#1D1E29', '#A7ABFF'],
  ['monochrome', '#FFFFFF', '#222337'],
  ['tinted', '#EFEFFD', '#6269F5'],
])
  await fs.writeFile(
    new URL(`assets/branding/icon-${name}.svg`, root),
    svg.replaceAll('#6269F5', bg).replaceAll('#fff', stroke),
  );
await fs.writeFile(
  new URL('assets/branding/banner.svg', root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="400"><rect width="1280" height="400" fill="#EEEEFD"/><text x="80" y="185" fill="#222337" font-family="system-ui,sans-serif" font-size="78" font-weight="700">unmasked<tspan fill="#6269F5">.</tspan></text><text x="84" y="252" fill="#727487" font-family="system-ui,sans-serif" font-size="28">Be real. No covers.</text><text x="84" y="342" fill="#6269F5" font-family="system-ui,sans-serif" font-size="16">AN OPENRECODE PROJECT</text></svg>`,
);
console.log('Generated reproducible branding assets');
