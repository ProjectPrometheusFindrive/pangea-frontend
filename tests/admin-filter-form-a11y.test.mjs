import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('ActionRequired filter controls expose explicit accessible names', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /htmlFor="action-required-search-query"/u);
  assert.match(source, /id="action-required-search-query"/u);
  assert.match(source, /name="searchQuery"/u);
  assert.match(source, /aria-label="조치 필요 검색"/u);
  assert.match(source, /aria-label="상태 필터"/u);
  assert.match(source, /aria-label="우선순위 필터"/u);
  assert.match(source, /aria-label="담당자 필터"/u);
  assert.match(source, /aria-label="페이지 크기"/u);
});

test('Reservations vehicle filter controls bind visible labels to their fields', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /htmlFor="reservations-model-filter"/u);
  assert.match(source, /id="reservations-model-filter"/u);
  assert.match(source, /name="modelFilter"/u);
  assert.match(source, /htmlFor="reservations-vehicle-search-query"/u);
  assert.match(source, /id="reservations-vehicle-search-query"/u);
  assert.match(source, /name="vehicleSearchQuery"/u);
});

test('Assets keyword filter input has a dedicated label and stable form attributes', () => {
  const source = readProjectFile('src/app/pages/Assets.tsx');

  assert.match(source, /htmlFor="assets-search-query"/u);
  assert.match(source, /id="assets-search-query"/u);
  assert.match(source, /name="queryKeyword"/u);
  assert.match(source, /aria-label="자산 검색"/u);
  assert.match(source, /htmlFor="assets-model-filter"/u);
  assert.match(source, /id="assets-model-filter"/u);
  assert.match(source, /name="modelFilter"/u);
});
