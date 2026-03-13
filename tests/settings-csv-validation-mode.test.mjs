import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('settings CSV flow remains validation-only across the bulk upload surface', () => {
  const source = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(source, /const CSV_VALIDATION_ONLY_NOTICE = /u);
  assert.match(source, /toast\.info\(CSV_VALIDATION_ONLY_NOTICE\)/u);
  assert.match(source, /const handleUploadClick = \(\) => \{/u);
  assert.match(source, /onClick=\{handleUploadClick\}/u);
  assert.match(source, /if \(!canEditSettings\) \{\s*toast\.error/u);
  assert.match(source, /fileInputRef\.current\?\.click\(\)/u);
});
