import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

let viteServer;

before(async () => {
  viteServer = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'error',
    server: {
      middlewareMode: true,
    },
  });
});

after(async () => {
  await viteServer?.close();
});

function issueToken(payload) {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedHeader}.${encodedPayload}.signature`;
}

test('invitation signup helper preserves token search, decodes claims, relaxes locked-field validation, and builds accept payload', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/signupInvitationMode.ts');

  const token = issueToken({
    typ: 'team_invitation',
    act: 'accept_invitation',
    email: 'invitee@example.com',
    role: 'member',
    companyId: 'C1',
  });
  const search = `?invitationToken=${encodeURIComponent(token)}`;

  assert.equal(module.extractInvitationToken(search), token);
  assert.equal(module.buildSignupRouteWithSearch(search), `/signup${search}`);

  const claims = module.decodeInvitationToken(token);
  assert.equal(claims.email, 'invitee@example.com');
  assert.equal(claims.role, 'member');
  assert.equal(claims.companyId, 'C1');

  const errors = module.validateInvitationAwareSignUpForm({
    userId: '',
    password: 'Password123',
    confirmPassword: 'Password123',
    name: 'Invitee',
    phone: '010-1234-5678',
    email: '',
    position: '직원',
    company: '',
    bizRegNo: '',
  }, {
    invitationEmail: 'invitee@example.com',
  });

  assert.equal(errors.userId, undefined);
  assert.equal(errors.email, undefined);
  assert.equal(errors.company, undefined);
  assert.equal(errors.bizRegNo, undefined);

  assert.deepEqual(
    module.buildInvitationAcceptPayload({
      userId: '',
      password: 'Password123',
      confirmPassword: 'Password123',
      name: 'Invitee',
      phone: '010-1234-5678',
      email: '',
      position: '직원',
      company: '',
      bizRegNo: '',
    }),
    {
      password: 'Password123',
      name: 'Invitee',
      phone: '010-1234-5678',
      position: '직원',
    },
  );
});
