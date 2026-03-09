import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('settings CSV flow is explicitly validation-only across the bulk upload surface', () => {
  const source = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(source, /CSV 검증/u);
  assert.match(source, /검증 완료 \(저장되지 않음\)/u);
  assert.match(source, /CSV 파일을 드래그하거나 클릭하여 검증/u);
  assert.match(source, /onClick=\{handleUploadClick\}/u);
  assert.match(source, /if \(!canEditSettings\) \{\s*toast\.error/u);
  assert.match(source, /disabled=\{!canEditSettings\}/u);
  assert.doesNotMatch(source, /데이터 업로드/u);
});
