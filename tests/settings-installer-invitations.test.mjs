import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('settings invitation helpers support installer role only for scoped super_admin invitations', async () => {
  const moduleUrl = pathToFileURL(path.join(projectRoot, 'src/app/pages/settingsInvitations.ts')).href;
  const module = await import(moduleUrl);

  const nonSuperAdminErrors = module.validateInvitationDraft(
    {
      email: 'installer@example.com',
      role: 'installer',
    },
    {
      isSuperAdmin: false,
      companyId: 'C1',
    },
  );
  assert.equal(typeof nonSuperAdminErrors.role, 'string');

  const missingCompanyErrors = module.validateInvitationDraft(
    {
      email: 'installer@example.com',
      role: 'installer',
    },
    {
      isSuperAdmin: true,
      companyId: null,
    },
  );
  assert.equal(typeof missingCompanyErrors.companyId, 'string');

  assert.deepEqual(
    module.validateInvitationDraft(
      {
        email: 'installer@example.com',
        role: 'installer',
      },
      {
        isSuperAdmin: true,
        companyId: 'C7',
      },
    ),
    {},
  );

  assert.deepEqual(
    module.getInvitationRoleOptions(false).map((item) => item.value),
    ['member', 'viewer', 'admin'],
  );

  assert.deepEqual(
    module.getInvitationRoleOptions(true).map((item) => item.value),
    ['member', 'viewer', 'admin', 'installer'],
  );

  assert.notEqual(module.toInvitationRoleLabel('installer'), 'installer');
});

test('settings page keeps installer invitation UI scoped to super_admin company context', async () => {
  const [settingsSource, invitationServiceSource] = await Promise.all([
    readFile(path.join(projectRoot, 'src/app/pages/Settings.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/invitations.ts'), 'utf8'),
  ]);

  assert.match(invitationServiceSource, /export type InvitationRole = 'admin' \| 'member' \| 'viewer' \| 'installer';/u);
  assert.match(settingsSource, /const isSuperAdmin = \(user\?\.role \?\? ''\)\.trim\(\)\.toLowerCase\(\) === 'super_admin';/u);
  assert.match(settingsSource, /isSuperAdmin && \(/u);
  assert.match(settingsSource, /<option value="installer">/u);
  assert.match(settingsSource, /validateInvitationDraft\(invitationForm,\s*\{[\s\S]*isSuperAdmin,[\s\S]*companyId:\s*settingsCompanyId[\s\S]*\}\)/u);
  assert.match(settingsSource, /invitationFieldErrors\.companyId/u);
});
