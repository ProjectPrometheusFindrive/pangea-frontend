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

test('settings invitations helper validates drafts, normalizes create payloads, and upserts pending rows', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/settingsInvitations.ts');

  assert.deepEqual(
    module.validateInvitationDraft({
      email: '',
      role: 'member',
    }),
    {
      email: '초대 이메일을 입력해 주세요.',
    },
  );

  assert.deepEqual(
    module.validateInvitationDraft({
      email: 'not-an-email',
      role: 'member',
    }),
    {
      email: '올바른 이메일 형식이 아닙니다.',
    },
  );

  assert.deepEqual(
    module.buildInvitationCreatePayload({
      email: ' Invitee@Example.com ',
      role: 'admin',
    }),
    {
      email: 'invitee@example.com',
      role: 'admin',
    },
  );

  const existing = [
    {
      id: 'INV-001',
      email: 'older@example.com',
      role: 'member',
      status: 'pending',
      invitedAt: '2026-03-07T09:00:00Z',
      resendCount: 0,
    },
  ];

  const created = {
    id: 'INV-002',
    email: 'newer@example.com',
    role: 'admin',
    status: 'pending',
    invitedAt: '2026-03-07T10:00:00Z',
    resendCount: 0,
  };

  assert.deepEqual(
    module.upsertPendingInvitation(existing, created).map((item) => item.id),
    ['INV-002', 'INV-001'],
  );

  const resent = {
    ...created,
    resendCount: 1,
    updatedAt: '2026-03-07T11:00:00Z',
  };

  assert.deepEqual(
    module.upsertPendingInvitation(existing, resent),
    [resent, ...existing],
  );
});
