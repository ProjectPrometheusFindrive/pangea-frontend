import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('revenue page defines a GT-compatible top KPI taxonomy backed by revenue API aggregates', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');
  const serviceSource = readProjectFile('src/services/revenue.ts');

  assert.match(source, /GT_PERIOD_OPTIONS/u);
  assert.match(source, /label:\s*'주간'/u);
  assert.match(source, /label:\s*'월간'/u);
  assert.match(source, /label:\s*'연간'/u);
  assert.match(source, /buildRevenueParityCards/u);
  assert.match(source, /title:\s*'총 매출'/u);
  assert.match(source, /title:\s*'총 대여 건수'/u);
  assert.match(source, /title:\s*'평균 대여 금액'/u);
  assert.match(source, /title:\s*'미납금'/u);
  assert.match(source, /title:\s*'활성 차량'/u);
  assert.match(source, /paidCount > 0 \? Math\.round\(totals\.grossRevenue \/ totals\.paidCount\) : 0/u);
  assert.match(source, /totals\.unpaidAmount/u);
  assert.match(source, /totals\.activeVehicleCount/u);
  assert.match(source, /buildRevenuePaymentMethodSlices\(summaryPaymentMethods\)/u);
  assert.match(source, /buildRevenueModelRows\(summaryVehicles\)/u);
  assert.match(serviceSource, /paymentMethods:\s*RevenuePaymentMethod\[\]/u);
  assert.match(serviceSource, /vehicles:\s*RevenueVehicle\[\]/u);
  assert.doesNotMatch(source, /grossRevenue \* 0\.08/u);
  assert.doesNotMatch(source, /const models = \[/u);
  assert.doesNotMatch(source, /const ratios = \[/u);
});

test('revenue page keeps GT-visible section headings without API-only diagnostic sections', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');

  assert.match(source, />월간 매출 추이</u);
  assert.match(source, />결제 방법별 분포</u);
  assert.match(source, />차종별 매출 현황</u);
  assert.doesNotMatch(source, /Figma parity note/u);
  assert.doesNotMatch(source, />현재 API 기준 기간별 매출</u);
  assert.doesNotMatch(source, />현재 API 기준 순매출 추이</u);
  assert.doesNotMatch(source, />기간별 버킷 상세</u);
});
