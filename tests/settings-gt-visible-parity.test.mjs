import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Settings matches the GT-visible tab contract for the landing screen', () => {
  const source = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(source, /const effectiveSettingsCompanyId = useMemo\(/u);
  assert.match(source, /handleTabChange\('bulk'\)/u);
  assert.match(source, /handleTabChange\('geofence'\)/u);
  assert.match(source, /handleTabChange\('accounts'\)/u);

  assert.doesNotMatch(source, /handleTabChange\('company'\)/u);
  assert.doesNotMatch(source, /회사 범위/u);
  assert.doesNotMatch(source, /회사 정보/u);
});
