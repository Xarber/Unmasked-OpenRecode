// SPDX-License-Identifier: AGPL-3.0-only
import { spawnSync, execFileSync } from 'node:child_process';
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
