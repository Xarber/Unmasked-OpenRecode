// SPDX-License-Identifier: AGPL-3.0-only
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('apps/mobile/dist');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let file = target;
    try {
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
      await fs.access(file);
    } catch {
      if (path.extname(url.pathname)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      file = path.join(root, 'index.html');
    }
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(500);
    res.end('Unable to serve app');
  }
});
server.listen(8081, '127.0.0.1', () => console.log('Unmasked web: http://localhost:8081'));
