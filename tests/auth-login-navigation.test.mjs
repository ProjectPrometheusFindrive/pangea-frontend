import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('logout redirect uses in-app history navigation instead of forcing a document reload', () => {
  const source = readProjectFile('src/app/context/AuthContext.tsx');

  assert.match(source, /window\.history\.(pushState|replaceState)/u);
  assert.match(source, /PopStateEvent\('popstate'\)/u);
  assert.doesNotMatch(source, /window\.location\.assign/u);
});
