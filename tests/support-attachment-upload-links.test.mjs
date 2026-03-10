import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('support center uploads attachments before ticket creation and renders attachment links when urls exist', () => {
  const pageSource = readProjectFile('src/app/pages/SupportCenter.tsx');
  const serviceSource = readProjectFile('src/services/support.ts');

  assert.match(serviceSource, /url\?: string;/u);
  assert.match(serviceSource, /export async function uploadSupportTicketAttachment\(/u);
  assert.match(serviceSource, /path:\s*'\/api\/v2\/uploads\/sign'/u);
  assert.match(serviceSource, /folder:\s*`company\/\$\{normalizedCompanyId\}\/docs`/u);
  assert.match(serviceSource, /await uploadFileToSignedUrl\(/u);

  assert.match(pageSource, /const uploadedAttachments = await Promise\.all\(/u);
  assert.match(pageSource, /attachments\.map\(\(file\)\s*=>\s*uploadSupportTicketAttachment\(/u);
  assert.match(pageSource, /attachments:\s*uploadedAttachments/u);
  assert.match(pageSource, /attachment\.url \? \(/u);
  assert.match(pageSource, /href=\{attachment\.url\}/u);
  assert.match(pageSource, /target="_blank"/u);
  assert.match(pageSource, /download=\{attachment\.fileName\}/u);
});
