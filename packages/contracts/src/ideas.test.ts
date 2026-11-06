// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ideaExport, mergeIdeas, type Idea, registration, sendMessage } from './index.js';
const idea: Idea = {
  id: randomUUID(),
  title: 'Add media',
  description: 'User idea',
  category: 'Feature',
  priority: 'normal',
  status: 'Pending',
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
  history: [],
};
test('idea export round trip preserves IDs and deduplicates imports', () => {
  const exp = {
    schemaVersion: 1,
    project: 'org.openrecode.unmasked',
    exportedAt: idea.createdAt,
    ideas: [idea],
  };
  const parsed = ideaExport.parse(JSON.parse(JSON.stringify(exp)));
  assert.deepEqual(parsed.ideas, [idea]);
  assert.equal(mergeIdeas([idea], parsed.ideas).length, 1);
});
test('idea conflict merge preserves existing data unless explicitly approved', () => {
  const updated = { ...idea, title: 'Changed', updatedAt: '2026-11-07T10:00:00.000Z' };
  assert.equal(mergeIdeas([idea], [updated])[0]!.title, idea.title);
  assert.equal(mergeIdeas([idea], [updated], true)[0]!.title, 'Changed');
  assert.equal(mergeIdeas([updated], [idea], true)[0]!.title, 'Changed');
});
test('invalid ideas, cross-project exports and invalid statuses are rejected', () => {
  assert.equal(
    ideaExport.safeParse({ schemaVersion: 2, project: 'other', ideas: [idea] }).success,
    false,
  );
  assert.equal(
    ideaExport.safeParse({
      schemaVersion: 1,
      project: 'org.openrecode.unmasked',
      exportedAt: idea.createdAt,
      ideas: [{ ...idea, status: 'fake-complete' }],
    }).success,
    false,
  );
});
test('account and message contract boundaries', () => {
  assert.equal(
    registration.safeParse({
      email: 'a@example.com',
      username: 'valid_user',
      displayName: 'a',
      password: 'short',
      ageBand: 'adult',
    }).success,
    false,
  );
  assert.equal(sendMessage.safeParse({ id: randomUUID(), text: '   ' }).success, false);
  assert.equal(sendMessage.safeParse({ id: randomUUID(), text: 'a'.repeat(8001) }).success, false);
});
