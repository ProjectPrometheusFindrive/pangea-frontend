import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('index.html declares an explicit favicon asset', () => {
  const source = readProjectFile('index.html');
  assert.match(source, /rel="icon"/u);
  assert.match(source, /href="\/favicon\.svg"/u);
});

test('public favicon asset exists', () => {
  assert.equal(fs.existsSync(path.join(projectRoot, 'public', 'favicon.svg')), true);
});
