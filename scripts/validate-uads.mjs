// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { readFileSync, statSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import Ajv from 'ajv';

const root = realpathSync(new URL('../', import.meta.url));
function file(path) {
  const target = realpathSync(resolve(root, path));
  assert(
    target.startsWith(root + sep) && statSync(target).isFile(),
    `Expected a repository file: ${path}`,
  );
  return target;
}
const read = (path) => JSON.parse(readFileSync(file(path), 'utf8'));
const manifest = read('uads.json');
const validate = new Ajv({ allErrors: true }).compile(read('config/uads-schema.json'));
assert(validate(manifest), JSON.stringify(validate.errors));
const registry = read('config/uads-requirements.json').requirements;
const index = new Map(registry.map((entry) => [entry.id, entry]));
assert.equal(index.size, registry.length, 'Duplicate registry ID');
const entries = new Map(manifest.requirements.map((entry) => [entry.id, entry]));
assert.equal(entries.size, manifest.requirements.length, 'Duplicate manifest ID');
assert.deepEqual(
  [...entries.keys()].sort(),
  [...index.keys()].sort(),
  'Registry and manifest differ',
);
const exceptions = new Map(manifest.exceptions.map((entry) => [entry.id, entry]));
assert.equal(exceptions.size, manifest.exceptions.length, 'Duplicate exception');
function date(value) {
  assert.equal(new Date(value).toISOString().slice(0, 10), value, 'Invalid evidence date');
  return value;
}
const today = new Date().toISOString().slice(0, 10);
for (const [id, exception] of exceptions) {
  assert(
    entries.has(id) && date(exception.approvedOn) <= today && date(exception.reviewOn) >= today,
    `Invalid or expired exception: ${id}`,
  );
}
for (const [id, entry] of entries) {
  const rule = index.get(id);
  assert(
    entry.applicability === rule.applicability ||
      (entry.applicability === 'Approved Exception' && exceptions.has(id)),
    `Applicability mismatch: ${id}`,
  );
  assert.equal(entry.status === 'Waived', exceptions.has(id), `Waiver mismatch: ${id}`);
  if (entry.status === 'Passed') assert(entry.evidence.length, `Missing evidence: ${id}`);
  if (['Blocked', 'Failed', 'Not Applicable'].includes(entry.status))
    assert(entry.reason, `Missing rationale: ${id}`);
  for (const evidence of entry.evidence) {
    file(evidence.path);
    assert(date(evidence.checkedOn) <= today, `Future evidence: ${id}`);
  }
  file(rule.evidenceReference);
}
for (const path of Object.values(manifest.quality)) file(path);
if (process.argv.includes('--web')) {
  const dist = 'apps/mobile/dist';
  const pwa = read(`${dist}/manifest.webmanifest`);
  assert.equal(pwa.display, 'standalone');
  for (const icon of pwa.icons) file(`${dist}${icon.src}`);
  file(`${dist}/sw.js`);
  const bundles = resolve(root, dist, '_expo/static/js/web');
  const bytes = readdirSync(bundles)
    .filter((name) => name.endsWith('.js'))
    .reduce((sum, name) => sum + statSync(resolve(bundles, name)).size, 0);
  const budget = read(manifest.quality.performanceBudgets).web.initialJavaScriptBytes;
  assert(bytes <= budget, `Web JS: ${bytes} > ${budget} bytes`);
  console.log(`Web JS: ${bytes}/${budget} bytes (all emitted bundles)`);
}
console.log(
  `UADS structure valid for ${entries.size} requirement groups. Functional status is tracked separately.`,
);
