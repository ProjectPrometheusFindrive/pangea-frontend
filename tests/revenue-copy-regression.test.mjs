import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Revenue page keeps expected Korean UI copy without mojibake placeholders', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');

  for (const phrase of [
    '매출 요약',
    '기간:',
    '주간',
    '월간',
    '연간',
    '총 매출',
    '총 대여 건수',
    '평균 대여 금액',
    '미납금',
    '활성 차량',
    '결제 방법별 분포',
    '차종별 매출 현황',
    '월간 매출 추이',
    '결제 수단',
    '총매출',
    '순매출',
    '미납',
    '환불',
  ]) {
    assert.match(source, new RegExp(phrase, 'u'));
  }

  for (const removedPhrase of [
    '회사 범위',
    'Figma parity note',
    '현재 API 기준 기간별 매출',
    '현재 API 기준 순매출 추이',
    '기간별 버킷 상세',
  ]) {
    assert.doesNotMatch(source, new RegExp(removedPhrase, 'u'));
  }

  assert.doesNotMatch(source, />조회 기간</u);
  assert.doesNotMatch(source, />집계 단위</u);
  assert.doesNotMatch(source, />재조회</u);
  assert.doesNotMatch(source, /\?{3,}/u);
});

test('Prompt library keeps restored Korean guidance while preserving SCRUM-193 rule', () => {
  const source = readProjectFile('docs/prompt_library/prompt_library_v1.md');

  for (const phrase of [
    '초기 세팅 작업에서',
    '약관 동의 단계',
    '단말 OFF',
    'Revenue trend fallback bugfix tickets',
  ]) {
    assert.match(source, new RegExp(phrase, 'u'));
  }

  assert.doesNotMatch(source, /\?{3,}/u);
});
