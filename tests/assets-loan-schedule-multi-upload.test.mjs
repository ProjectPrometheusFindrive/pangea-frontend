import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('asset create modal keeps loan schedule uploads as a multi-file collection', () => {
  const source = readProjectFile('src/app/pages/Assets.tsx');

  assert.match(source, /loanSchedule:\s*File\[\];/u);
  assert.match(source, /loanSchedule:\s*\[\],/u);
  assert.match(source, /multiple/u);
  assert.match(source, /Array\.from\(event\.target\.files\s*\?\?\s*\[\]\)/u);
  assert.match(source, /previous\.loanSchedule/u);
  assert.match(source, /uploadedFiles\.loanSchedule\.length > 0/u);
  assert.match(source, /uploadedFiles\.loanSchedule\.map\(/u);
});
