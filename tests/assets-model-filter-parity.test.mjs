import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Assets restores a model filter with catalog-backed options, counts, and pagination', () => {
  const source = readProjectFile('src/app/pages/Assets.tsx');
  const serviceSource = readProjectFile('src/services/assets.ts');

  assert.match(source, /const modelFilter = \(searchParams\.get\('model'\) \?\? ''\)\.trim\(\);/u);
  assert.match(serviceSource, /export interface GetAssetsListParams[\s\S]*model\?: string;/u);
  assert.match(serviceSource, /query:\s*\{[\s\S]*model,/u);
  assert.match(source, /const \[availableModelOptions, setAvailableModelOptions\] = useState<string\[\]>\(\[\]\);/u);
  assert.match(source, /const loadModelCatalog = useCallback\(async \(signal: AbortSignal\) => \{/u);
  assert.match(source, /while \(catalogAssets.length < catalogTotal\)/u);
  assert.match(source, /const filteredCatalog = filterAssetsByModel\(fullCatalog, modelFilter\);/u);
  assert.match(source, /if \(modelFilter\) \{\s*return \{[\s\S]*items:\s*filteredCatalog,[\s\S]*total:\s*filteredCatalog\.length,/u);
  assert.match(source, /return \{[\s\S]*items:\s*pageAssets,[\s\S]*total:\s*getTotalCountFromObject\(payload\) \?\? pageAssets\.length,/u);
  assert.match(source, /modelOptions:\s*toModelOptions\(fullCatalog\),/u);
  assert.match(source, /const visibleAssets = useMemo\(\(\) => \(/u);
  assert.match(source, /modelFilter \? paginateAssets\(assets, page, pageSize\) : assets/u);
  assert.match(source, /setAvailableModelOptions\(payload\.modelOptions\);/u);
  assert.match(source, /const statusCountMap = useMemo\(\(\) => \(\{\s*rental: assets\.filter/u);
  assert.match(source, /visibleAssets\.map\(\(asset\) => \(/u);
  assert.match(source, /modelFilter \? `필터 결과 \$\{totalCount \?\? assets\.length\}대 표시 중`/u);
  assert.doesNotMatch(source, /const filteredAssets = useMemo\(\(\) => \{/u);
  assert.doesNotMatch(source, /const availableModelOptions = useMemo\(\(\) => \{/u);
});
