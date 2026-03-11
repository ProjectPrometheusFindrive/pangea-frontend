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
  assert.match(source, /toCanonicalAssetBucketName\(name\)/u);
  assert.match(source, /sumByKeys\(normalizedManagementStageCounts, \['정비중'\]\)/u);
  assert.match(source, /Object\.entries\(normalizedManagementStageCounts\)/u);
});

test('SCRUM-289 keeps Home asset fallback buckets aligned with Figma taxonomy', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /name: '대여중'/u);
  assert.match(source, /name: '가용'/u);
  assert.match(source, /name: '정비중'/u);
  assert.match(source, /name: '예약'/u);
  assert.doesNotMatch(source, /name: '운영중'/u);
  assert.doesNotMatch(source, /name: '점검대기'/u);
});
