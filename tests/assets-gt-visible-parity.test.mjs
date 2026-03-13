import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Assets matches the GT top filter contract without a visible search label or page-size selector', () => {
  const source = readProjectFile('src/app/pages/Assets.tsx');

  assert.match(source, /placeholder="차량번호 또는 차종으로 검색\.\.\."/u);
  assert.match(source, /aria-label="차량번호 또는 차종으로 검색\.\.\."/u);
  assert.match(source, /\(.*대 표시 중\)/u);
  assert.doesNotMatch(source, />자산 검색</u);
  assert.doesNotMatch(source, />페이지 크기:</u);
});

test('Vehicle detail modal matches the GT-facing insurance and inspection section', () => {
  const source = readProjectFile('src/app/components/VehicleDetailModal.tsx');

  assert.match(source, /예약 히스토리/u);
  assert.match(source, /보험 및 점검 정보 수정/u);
  assert.match(source, /보험가입증서 업로드/u);
  assert.match(source, /자동차종합검사 결과표 업로드/u);
  assert.match(source, /다음 정기점검일/u);
  assert.doesNotMatch(source, /asset-detail-color-input/u);
  assert.doesNotMatch(source, /asset-detail-category-input/u);
  assert.doesNotMatch(source, /asset-detail-vehicle-type-input/u);
  assert.doesNotMatch(source, /asset-detail-delete-button/u);
});
