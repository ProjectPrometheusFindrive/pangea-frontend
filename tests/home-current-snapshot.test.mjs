import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('SCRUM-297 removes Home preset query state and pins summary fetches to the current day', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /function resolveTodayRange\(\): \{ from: string; to: string \}/u);
  assert.match(source, /const today = new Date\(\);/u);
  assert.match(source, /from: toIsoDate\(today\),/u);
  assert.match(source, /to: toIsoDate\(today\),/u);
  assert.match(source, /const \{ from, to \} = resolveTodayRange\(\);/u);
  assert.doesNotMatch(source, /searchParams\.get\('preset'\)/u);
  assert.doesNotMatch(source, /updateHomeSearchParams\(\{ preset:/u);
  assert.doesNotMatch(source, /PERIOD_OPTIONS\.map/u);
});

test('SCRUM-297 updates Home empty and recent-change copy away from adjustable period language', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /emptyTitle="현재 표시할 홈 데이터가 없습니다"/u);
  assert.match(source, /emptyDescription="지금 기준으로 집계된 데이터가 없어 잠시 후 다시 확인해 주세요\."?/u);
  assert.match(source, /<li className="text-xs text-gray-500">오늘 변경 이력이 없습니다\.<\/li>/u);
  assert.doesNotMatch(source, /조회 기간에 표시할 홈 데이터가 없습니다/u);
  assert.doesNotMatch(source, /기간을 변경하거나 다시 조회해 주세요\./u);
  assert.doesNotMatch(source, /해당 기간의 변경 이력이 없습니다\./u);
});
