import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('SCRUM-288 restores the full home issue-card taxonomy from the approved Figma set', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  const issueCardIds = source.match(/testId:\s*'home-issue-card-[^']+'/gu) ?? [];
  assert.equal(issueCardIds.length, 8);

  assert.match(source, /label:\s*'보험 만료 임박'[\s\S]*?onClick:\s*\(\)\s*=>\s*handleIssueClick\('보험 만료 임박'\)[\s\S]*?testId:\s*'home-issue-card-insurance'/u);
  assert.match(source, /label:\s*'점검 만료 임박'[\s\S]*?onClick:\s*\(\)\s*=>\s*handleIssueClick\('정기점검 만료 임박'\)[\s\S]*?testId:\s*'home-issue-card-maintenance'/u);
  assert.match(source, /label:\s*'사고 접수'[\s\S]*?onClick:\s*\(\)\s*=>\s*handleIssueClick\('사고 접수'\)[\s\S]*?testId:\s*'home-issue-card-accident'/u);
});

test('SCRUM-288 keeps premium-only home issue cards explicit instead of placeholder gaps', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /label:\s*'차량이상'[\s\S]*?description:\s*'프리미엄 단말 연동 필요'[\s\S]*?onClick:\s*\(\)\s*=>\s*setShowPremiumModal\(true\)[\s\S]*?testId:\s*'home-issue-card-vehicle-anomaly'/u);
  assert.match(source, /label:\s*'단말 OFF'[\s\S]*?description:\s*'단말 데이터 연동 예정'[\s\S]*?onClick:\s*\(\)\s*=>\s*setShowPremiumModal\(true\)[\s\S]*?testId:\s*'home-issue-card-device-off'/u);
});

test('SCRUM-288 restores the desktop home issue grid to four columns', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /data-testid="home-issue-grid"[\s\S]*?mt-4 grid flex-1 auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4/u);
});
