import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('settings invitation helpers resolve explicit company scope and include it in invitation payloads', async () => {
  const moduleUrl = pathToFileURL(path.join(projectRoot, 'src/app/pages/settingsInvitations.ts')).href;
  const module = await import(moduleUrl);

  assert.equal(module.resolveSettingsCompanyScope('C2', 'C1'), 'C2');
  assert.equal(module.resolveSettingsCompanyScope(null, 'C1'), 'C1');
  assert.equal(module.resolveSettingsCompanyScope('0000000000', null), null);

  assert.deepEqual(
    module.buildInvitationCreatePayload(
      {
        email: ' Invitee@Example.com ',
        role: 'admin',
      },
      'C9',
    ),
    {
      email: 'invitee@example.com',
      role: 'admin',
      companyId: 'C9',
    },
  );
});

test('settings services thread companyId through settings and invitations requests', async () => {
  const [settingsSource, invitationsSource, pageSource] = await Promise.all([
    readFile(path.join(projectRoot, 'src/services/settings.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/invitations.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/pages/Settings.tsx'), 'utf8'),
  ]);

  assert.match(settingsSource, /companyId\?: string/);
  assert.match(settingsSource, /query:\s*\{[\s\S]*companyId:\s*options\.companyId[\s\S]*\}/);
  assert.match(invitationsSource, /companyId\?: string/);
  assert.match(invitationsSource, /companyId:\s*payload\.companyId\s*\?\?\s*options\.companyId/);
  assert.match(invitationsSource, /query:\s*\{[\s\S]*companyId:\s*options\.companyId[\s\S]*\}/);
  assert.match(pageSource, /useSearchParams/);
  assert.match(pageSource, /resolveSettingsCompanyScope/);
  assert.match(pageSource, /companyId:\s*settingsCompanyId\s*\?\?\s*undefined/);
});
