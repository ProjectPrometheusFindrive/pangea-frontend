import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Assets restores a model filter and renders counts and rows from filtered assets', () => {
  const source = readProjectFile('src/app/pages/Assets.tsx');

  assert.match(source, /const modelFilter = \(searchParams\.get\('model'\) \?\? ''\)\.trim\(\);/u);
  assert.match(source, /const availableModelOptions = useMemo\(\(\) => \{/u);
  assert.match(source, /const filteredAssets = useMemo\(\(\) => \{/u);
  assert.match(source, /asset\.model\.trim\(\) === modelFilter/u);
  assert.match(source, /const statusCountMap = useMemo\(\(\) => \(\{\s*rental: filteredAssets\.filter/u);
  assert.match(source, /filteredAssets\.map\(\(asset\) => \(/u);
  assert.match(source, /modelFilter \? `필터 결과 \$\{filteredAssets\.length\}대 표시 중`/u);
});
