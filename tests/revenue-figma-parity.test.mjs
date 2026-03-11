import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('revenue page defines a figma-compatible top KPI taxonomy backed by current totals', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');

  assert.match(source, /buildRevenueParityCards/u);
  assert.match(source, /title:\s*'총 매출'/u);
  assert.match(source, /title:\s*'총 대여 건수'/u);
  assert.match(source, /title:\s*'평균 대여 금액'/u);
  assert.match(source, /title:\s*'순매출'/u);
  assert.match(source, /title:\s*'환불 금액'/u);
  assert.match(source, /paidCount > 0 \? Math\.round\(totals\.grossRevenue \/ totals\.paidCount\) : 0/u);
  assert.match(source, /대여 데이터 없음/u);
});

test('revenue page keeps unsupported figma sections visible as explicit contract gaps', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');

  assert.match(source, /REVENUE_FIGMA_UNSUPPORTED_SECTIONS/u);
  assert.match(source, /title:\s*'결제 방법별 분포'/u);
  assert.match(source, /결제 수단별 집계/u);
  assert.match(source, /title:\s*'차량별 매출 현황'/u);
  assert.match(source, /차량별 매출 랭킹/u);
  assert.match(source, /REVENUE_FIGMA_CONTRACT_GAP_NOTE/u);
  assert.match(source, /미납금/u);
  assert.match(source, /활성 차량/u);
});
