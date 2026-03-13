import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('SCRUM-290 keeps the approved operation-score labels without inventing unsupported score semantics', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /label:\s*'안전운전'/u);
  assert.match(source, /label:\s*'차량관리'/u);
  assert.match(source, /label:\s*'사업운영'/u);
  assert.doesNotMatch(source, /const completionRateScore =/u);
  assert.doesNotMatch(source, /const safetyDrivingScore =/u);
  assert.doesNotMatch(source, /const vehicleManagementScore =/u);
  assert.doesNotMatch(source, /const paymentHealthScore =/u);
  assert.doesNotMatch(source, /const businessOperationScore =/u);
  assert.doesNotMatch(source, /label:\s*'자산 활용률'/u);
  assert.doesNotMatch(source, /label:\s*'계약 완료율'/u);
  assert.doesNotMatch(source, /label:\s*'연체 안전도'/u);
});

test('SCRUM-290 keeps only the GT-visible operation score card on home', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /data-testid="home-operation-score-card"/u);
  assert.match(source, /data-testid="home-operation-score-card"[\s\S]*?운영 점수/u);
  assert.doesNotMatch(source, /data-testid="home-recent-changes-card"/u);
  assert.doesNotMatch(source, /최근 변경/u);
  assert.doesNotMatch(source, /home-operation-score-contract-gap/u);
});
