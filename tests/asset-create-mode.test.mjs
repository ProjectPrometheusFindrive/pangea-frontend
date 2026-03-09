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

test('asset create mode helper treats loan schedule uploads as an optional file collection', () => {
  const source = readProjectFile('src/app/pages/assetCreateMode.ts');

  assert.match(source, /loanSchedule:\s*File\[\];/u);
  assert.match(source, /loanSchedule\.length > 0/u);
});
