import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('settings keeps installer members visible and restricts pending installer review to super admins', () => {
  const serviceSource = readProjectFile('src/services/settings.ts');
  const pageSource = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(serviceSource, /export type SettingsMemberRole = 'admin' \| 'member' \| 'installer' \| string/u);
  assert.match(pageSource, /role === 'installer'/u);
  assert.match(pageSource, /actorRole === 'super_admin'|user\?\.role === 'super_admin'/u);
  assert.match(pageSource, /member\.status === 'pending'/u);
  assert.match(pageSource, /canReviewPendingMember/u);
});
