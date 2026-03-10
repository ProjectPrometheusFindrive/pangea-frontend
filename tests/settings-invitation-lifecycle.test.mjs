import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('settings invitation section supports lifecycle status filtering and history fields', async () => {
  const pageSource = await readFile(path.join(projectRoot, 'src/app/pages/Settings.tsx'), 'utf8');

  assert.match(pageSource, /const \[invitationStatusFilter,\s*setInvitationStatusFilter\] = useState/u);
  assert.match(pageSource, /listInvitations\(invitationStatusFilter/u);
  assert.match(pageSource, /value=\{invitationStatusFilter\}/u);
  assert.match(pageSource, /setInvitationStatusFilter\(event\.target\.value/u);
  assert.match(pageSource, /acceptedAt/u);
  assert.match(pageSource, /acceptedUserId/u);
  assert.match(pageSource, /invitation\.status === 'pending'/u);
});
