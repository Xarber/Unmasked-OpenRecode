// SPDX-License-Identifier: AGPL-3.0-only
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
try {
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const commands = {
  dev: ['run', 'dev:services'],
  web: ['run', 'web', '-w', '@unmasked/mobile'],
  mobile: ['run', 'start', '-w', '@unmasked/mobile'],
};
const args = commands[process.argv[2]];
if (!args) throw Error('Use dev, web or mobile');
if (!process.env.npm_execpath) throw Error('Run this command through the root npm scripts');
if (process.argv[2] !== 'mobile') await import('./landing.mjs');
const child = spawn(process.execPath, [process.env.npm_execpath, ...args], {
  stdio: 'inherit',
  env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
