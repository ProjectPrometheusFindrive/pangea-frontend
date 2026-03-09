import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('settings exposes pending-member approval actions through the v2 status patch API', () => {
  const serviceSource = readProjectFile('src/services/settings.ts');
  const pageSource = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(serviceSource, /export function patchSettingsMemberStatus\(/u);
  assert.match(serviceSource, /\/api\/v2\/settings\/members\/\$\{encodeURIComponent\(userId\)\}\/status/u);
  assert.match(pageSource, /patchSettingsMemberStatus/u);
  assert.match(pageSource, /member\.status === 'pending'/u);
  assert.match(pageSource, /runMemberStatusSave/u);
  assert.match(pageSource, /status: 'approved'/u);
  assert.match(pageSource, /status: 'rejected'/u);
});
