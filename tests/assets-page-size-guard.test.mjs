import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Assets clamps oversized size query params to the backend asset page-size limit', () => {
  const source = readProjectFile('src/app/pages/Assets.tsx');

  assert.match(source, /const MAX_ASSET_PAGE_SIZE = 200;/u);
  assert.match(source, /const pageSize = toBoundedPositiveInteger\(searchParams\.get\('size'\), DEFAULT_PAGE_SIZE, MAX_ASSET_PAGE_SIZE\);/u);
  assert.match(source, /const normalizedPageSize = String\(toBoundedPositiveInteger\(rawPageSize, DEFAULT_PAGE_SIZE, MAX_ASSET_PAGE_SIZE\)\);/u);
  assert.match(source, /params\.set\('size', normalizedPageSize\);/u);
  assert.match(source, /const catalogPageSize = Math\.max\(pageSize, MAX_ASSET_PAGE_SIZE\);/u);
});
