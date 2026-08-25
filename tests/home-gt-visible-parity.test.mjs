import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('home uses GT-visible section labels and removes the separate issue section heading', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /오늘 할 일/u);
  assert.match(source, /자산 현황/u);
  assert.match(source, /계약 현황/u);
  assert.match(source, /계약 유형/u);
  assert.match(source, /contractRentalTypeData/u);
  assert.match(source, /handleContractRentalTypeClick/u);
  assert.match(source, /단기렌트/u);
  assert.match(source, /장기렌트/u);
  assert.match(source, /사고대차/u);
  assert.match(source, /운영 점수/u);
  assert.doesNotMatch(source, />상태<\/p>/u);
  assert.doesNotMatch(source, />유형<\/p>/u);
  assert.doesNotMatch(source, /innerRadius=\{26\}/u);
  assert.doesNotMatch(source, /outerRadius=\{48\}/u);
  assert.doesNotMatch(source, /관리해야 할 이슈/u);
  assert.doesNotMatch(source, /자산 운영 분포/u);
  assert.doesNotMatch(source, /계약 상태 분포/u);
});

test('home keeps the GT top rail free of company-scope controls', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.doesNotMatch(source, /회사 범위/u);
  assert.doesNotMatch(source, /다시 조회/u);
  assert.doesNotMatch(source, /listSettingsCompanies/u);
  assert.doesNotMatch(source, /normalizeDashboardCompanyOptions/u);
  assert.match(source, /shouldShowDashboardCompanySelector/u);
});
