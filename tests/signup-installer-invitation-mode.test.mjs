import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('installer invitation helpers preserve companyName and relax position validation', () => {
  const helperSource = readProjectFile('src/app/pages/signupInvitationMode.ts');
  const invitationsServiceSource = readProjectFile('src/services/invitations.ts');

  assert.match(helperSource, /companyName\?: string;/u);
  assert.match(helperSource, /invitationRole\?: string \| null;/u);
  assert.match(helperSource, /const isInstallerInvitation = invitationRole === 'installer';/u);
  assert.match(helperSource, /if \(!values\.position && !isInstallerInvitation\)/u);
  assert.match(helperSource, /position:\s*values\.position\.trim\(\)\s*\|\|\s*undefined/u);
  assert.match(invitationsServiceSource, /position\?: string;/u);
});

test('signup page renders installer invitation mode with read-only company and role fields', () => {
  const signUpSource = readProjectFile('src/app/pages/SignUp.tsx');

  assert.match(signUpSource, /const isInstallerInvitation = isInvitationMode && invitationClaims\.role === 'installer';/u);
  assert.match(signUpSource, /invitationClaims\.companyName \|\| invitationClaims\.companyId \|\| ''/u);
  assert.match(signUpSource, /id="signup-invitation-company"/u);
  assert.match(signUpSource, /id="signup-invitation-role"/u);
  assert.match(signUpSource, /value=\{invitationCompanyName\}/u);
  assert.match(signUpSource, /value=\{invitationRoleValue\}/u);
  assert.match(signUpSource, /isInstallerInvitation \? '직책 \(선택\)' : '직위'/u);
  assert.match(signUpSource, /isInstallerInvitation \? \(/u);
  assert.match(signUpSource, /id="signup-position"/u);
});
