import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Assets deduplicates identical catalog requests before awaiting Promise.all', () => {
  const source = readProjectFile('src/app/pages/Assets.tsx');

  assert.match(source, /const catalogRequestCache = new Map<string, Promise<Asset\[\]>>\(\);/u);
  assert.match(source, /const getCatalog = \(options: \{ status\?: string; query\?: string \} = \{\}\) => \{/u);
  assert.match(source, /const cacheKey = JSON\.stringify\(\{\s*status: options\.status \?\? null,\s*query: options\.query \?\? null,\s*\}\);/u);
  assert.match(source, /const cachedRequest = catalogRequestCache\.get\(cacheKey\);/u);
  assert.match(source, /catalogRequestCache\.set\(cacheKey, nextRequest\);/u);
  assert.match(source, /const \[fullCatalog, fullStatusCountCatalog, fullTenantCatalog\] = await Promise\.all\(\[\s*getCatalog\(\{ status: statusQueryValue, query: keyword \|\| undefined \}\),\s*getCatalog\(\{ query: keyword \|\| undefined \}\),\s*getCatalog\(\),\s*\]\);/u);
});
