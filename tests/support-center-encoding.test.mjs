import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('support center admin submit button and nearby labels stay in readable Korean copy', () => {
  const source = readProjectFile('src/app/pages/SupportCenter.tsx');

  assert.match(source, /data-testid="support-admin-open-submit"[\s\S]*문의 등록/u);
  assert.match(source, /고객센터 문의 관리/u);
  assert.match(source, /문의 목록/u);
  assert.match(source, /문의 상세/u);
  assert.doesNotMatch(source, /臾몄쓽 \?깅줉/u);
});
