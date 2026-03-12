import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('settings page keeps only the GT-visible tab strip', async () => {
  const pageSource = await readFile(path.join(projectRoot, 'src/app/pages/Settings.tsx'), 'utf8');

  assert.match(pageSource, /handleTabChange\('bulk'\)/u);
  assert.match(pageSource, /handleTabChange\('geofence'\)/u);
  assert.match(pageSource, /handleTabChange\('accounts'\)/u);
  assert.doesNotMatch(pageSource, /handleTabChange\('company'\)/u);
  assert.doesNotMatch(pageSource, /회사 정보/u);
});
