import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('SCRUM-289 normalizes Home asset dashboard buckets into canonical labels before rendering', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /function toCanonicalAssetBucketName\(stageLabel: string\): string/u);
  assert.match(source, /return '정비중';/u);
  assert.match(source, /return '예약';/u);
  assert.match(source, /return '대여중';/u);
  assert.match(source, /return '가용';/u);
  assert.match(source, /const normalizedManagementStageCounts = useMemo\(/u);
  assert.match(source, /normalizeAssetBucketCounts\(managementStageCounts\)/u);
  assert.match(source, /toCanonicalAssetBucketName\(name\)/u);
  assert.match(source, /const bucketOrder = \['대여중', '예약', '가용', '정비중'\] as const/u);
  assert.match(source, /normalizedManagementStageCounts\[name\] \?\? fallbackCounts\[name\]/u);
});

test('SCRUM-289 keeps Home asset fallback buckets aligned with Figma taxonomy', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /const bucketOrder = \['대여중', '예약', '가용', '정비중'\] as const/u);
  assert.match(source, /대여중: kpis\.activeContracts/u);
  assert.match(source, /예약: 0/u);
  assert.match(source, /가용: Math\.max\(0, kpis\.totalAssets - kpis\.activeContracts\)/u);
  assert.match(source, /정비중: 0/u);
  assert.doesNotMatch(source, /name: '운영중'/u);
  assert.doesNotMatch(source, /name: '점검대기'/u);
});

test('Home contract dashboard renders separate status and rental type cards', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');
  const serviceSource = readProjectFile('src/services/home.ts');

  assert.match(serviceSource, /rentalType:\s*Record<string, number>/u);
  assert.match(serviceSource, /function normalizeRentalTypeMap\(value: unknown\): Record<string, number>/u);
  assert.match(serviceSource, /shortTerm:\s*'short_term'/u);
  assert.match(serviceSource, /rentalType:\s*normalizeRentalTypeMap\(value\.rentalType\)/u);
  assert.match(source, /function getRentalTypeDashboardLabel\(typeKey: string\): string/u);
  assert.match(source, /return '단기렌트';/u);
  assert.match(source, /return '장기렌트';/u);
  assert.match(source, /return '사고대차';/u);
  assert.match(source, /buildReservationsRentalTypePath/u);
  assert.match(source, /params\.set\('rentalType', normalized\)/u);
  assert.match(source, /계약 현황/u);
  assert.match(source, /계약 유형/u);
  assert.match(source, /contractRentalTypeData\.map/u);
  assert.match(source, /contract-rental-type-cell/u);
  assert.doesNotMatch(source, /innerRadius=\{26\}/u);
  assert.doesNotMatch(source, /outerRadius=\{48\}/u);
});
