// SPDX-License-Identifier: AGPL-3.0-only
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
try {
  const values = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'));
  for (const [key, value] of Object.entries(values))
    if (key.startsWith('EXPO_PUBLIC_') && process.env[key] === undefined) process.env[key] = value;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

let commit = process.env.EXPO_PUBLIC_BUILD_COMMIT;
if (!commit) {
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
      commit += '-dirty';
  } catch {
    commit = 'unversioned';
  }
}
const result = spawnSync('npm', ['run', 'build', '-w', '@unmasked/mobile'], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_BUILD_COMMIT: commit },
});
if (result.status !== 0) process.exit(result.status ?? 1);
const pwa = spawnSync(process.execPath, ['scripts/pwa.mjs'], { stdio: 'inherit' });
process.exit(pwa.status ?? 1);
