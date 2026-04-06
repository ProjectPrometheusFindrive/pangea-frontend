import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('settings viewer role taxonomy is available across FE services, labels, and invitation flows', async () => {
  const invitationsModule = await import(
    pathToFileURL(path.join(projectRoot, 'src/app/pages/settingsInvitations.ts')).href
  );

  const [
    settingsSource,
    invitationServiceSource,
    authServiceSource,
    settingsPageSource,
    signUpSource,
  ] = await Promise.all([
    readFile(path.join(projectRoot, 'src/services/settings.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/invitations.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/auth.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/pages/Settings.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/pages/SignUp.tsx'), 'utf8'),
  ]);

  assert.deepEqual(
    invitationsModule.getInvitationRoleOptions(false).map((item) => item.value),
    ['member', 'viewer', 'admin'],
  );
  assert.deepEqual(
    invitationsModule.validateInvitationDraft(
      {
        email: 'viewer@example.com',
        role: 'viewer',
      },
      {
        isSuperAdmin: false,
        companyId: 'C1',
      },
    ),
    {},
  );
  assert.equal(invitationsModule.toInvitationRoleLabel('viewer'), '조회자');

  assert.match(invitationServiceSource, /export type InvitationRole = 'admin' \| 'member' \| 'viewer' \| 'installer';/u);
  assert.match(settingsSource, /export type SettingsMemberRole = 'admin' \| 'member' \| 'viewer' \| 'installer' \| string;/u);
  assert.match(settingsSource, /role: 'admin' \| 'member' \| 'viewer';/u);
  assert.match(authServiceSource, /export type KnownAuthRole = 'super_admin' \| 'admin' \| 'member' \| 'viewer' \| 'installer';/u);
  assert.match(authServiceSource, /isSuperAdminRole\(role\) \|\| role === 'admin' \|\| role === 'member' \|\| role === 'viewer'/u);

  assert.match(settingsPageSource, /if \(role === 'viewer'\) \{\s*return '조회자';/u);
  assert.match(settingsPageSource, /case 'viewer':\s*return 'bg-slate-100 text-slate-700';/u);
  assert.match(settingsPageSource, /<option value="viewer">조회자<\/option>/u);
  assert.match(settingsPageSource, /draftRole === 'admin' \|\| draftRole === 'viewer' \? draftRole : 'member'/u);
  assert.match(settingsPageSource, /member\.role === 'admin' \|\| member\.role === 'member' \|\| member\.role === 'viewer'/u);
  assert.match(settingsPageSource, /if \(nextRoleValue !== 'admin' && nextRoleValue !== 'member' && nextRoleValue !== 'viewer'\)/u);
  assert.match(settingsPageSource, /조회자\(viewer\):<\/span>\s*데이터 조회 전용/u);

  assert.match(signUpSource, /value=\{toInvitationRoleLabel\(invitationRoleValue\)\}/u);
});
