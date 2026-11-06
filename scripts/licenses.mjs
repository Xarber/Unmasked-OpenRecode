// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
const rows = [];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.includes('node_modules/') || entry.link) continue;
  let license = entry.license;
  if (!license) {
    try {
      const metadata = JSON.parse(await fs.readFile(path + '/package.json', 'utf8'));
      license = metadata.license ?? metadata.licenses?.map((l) => l.type).join(' OR ');
    } catch {}
  }
  rows.push({
    name: path.split('node_modules/').at(-1),
    version: entry.version,
    license: license ?? 'UNDECLARED',
    path,
  });
}
await fs.writeFile(
  'docs/reports/dependency-licenses.json',
  JSON.stringify(
    {
      generatedAt: '2026-11-06',
      source: 'package-lock.json and installed package metadata',
      packages: rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Recorded ${rows.length} dependency license declarations`);
