import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Revenue matches the GT-visible section contract without company/granularity-only controls or API gap sections', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');

  assert.match(source, /const GT_PERIOD_OPTIONS/u);
  assert.match(source, /label:\s*'주간'/u);
  assert.match(source, /label:\s*'월간'/u);
  assert.match(source, /label:\s*'연간'/u);

  assert.match(source, /title:\s*'총 매출'/u);
  assert.match(source, /title:\s*'총 대여 건수'/u);
  assert.match(source, /title:\s*'평균 대여 금액'/u);
  assert.match(source, /title:\s*'미납금'/u);
  assert.match(source, /title:\s*'활성 차량'/u);

  assert.match(source, />월간 매출 추이</u);
  assert.match(source, /aria-pressed=\{isVisible\}/u);
  assert.match(source, /label:\s*'총매출'/u);
  assert.match(source, /label:\s*'순매출'/u);
  assert.match(source, /label:\s*'미납'/u);
  assert.match(source, /label:\s*'환불'/u);
  assert.match(source, />결제 방법별 분포</u);
  assert.match(source, />차종별 매출 현황</u);

  assert.doesNotMatch(source, />회사 범위</u);
  assert.doesNotMatch(source, />조회 기간</u);
  assert.doesNotMatch(source, />집계 단위</u);
  assert.doesNotMatch(source, />재조회</u);
  assert.doesNotMatch(source, /Figma parity note/u);
  assert.doesNotMatch(source, />현재 API 기준 기간별 매출</u);
  assert.doesNotMatch(source, />현재 API 기준 순매출 추이</u);
  assert.doesNotMatch(source, />기간별 버킷 상세</u);
});
