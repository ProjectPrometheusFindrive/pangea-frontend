import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('support center keeps explicit submit access, super-admin company scope, and attachment rendering', () => {
  const source = readProjectFile('src/app/pages/SupportCenter.tsx');

  assert.match(source, /const requestedMode = searchParams\.get\('mode'\)/u);
  assert.match(source, /requestedMode === 'submit'/u);
  assert.match(source, /onClick=\{\(\) => navigate\('\?mode=submit'\)\}/u);
  assert.match(source, /companyId: normalizedCompanyId \|\| undefined/u);
  assert.match(source, /const lookupCompanyId = isSuperAdmin/u);
  assert.match(source, /getSupportTicketDetail\(targetTicketId,\s*\{\s*companyId: lookupCompanyId/u);
  assert.match(source, /selectedTicket\.attachments\.length > 0/u);
  assert.match(source, /lookupTicket\.attachments\.length > 0/u);
  assert.match(source, /if \(!canUpdateStatus\)/u);
});
