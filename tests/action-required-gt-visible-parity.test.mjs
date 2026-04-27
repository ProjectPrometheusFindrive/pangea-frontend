import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('action required page keeps the GT chip set and result summary copy', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /'사고 접수'/u);
  assert.match(source, /'반납 지연'/u);
  assert.match(source, /'미납\/결제 문제'/u);
  assert.match(source, /'단말 OFF'/u);
  assert.match(source, /'도난 의심'/u);
  assert.match(source, /'정기점검'/u);
  assert.match(source, /'차량이상'/u);
  assert.match(source, /'보험 만료 임박'/u);
  assert.match(source, /총\s*<span className="font-bold text-blue-600">\{totalFilteredItems\}<\/span>건의 조치 필요 항목/u);
  assert.doesNotMatch(source, /조치 필요 검색/u);
  assert.match(source, /const ISSUE_FILTER_CHIPS:[\s\S]*\[[\s\S]*'정기점검'[\s\S]*\]/u);
  assert.doesNotMatch(source, /현재 페이지/u);
  assert.doesNotMatch(source, /서버 집계/u);
});

test('action required table keeps the GT header contract with conditional unpaid amount only', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, />\s*유형/u);
  assert.match(source, />\s*차량번호/u);
  assert.match(source, />\s*고객명/u);
  assert.match(source, />\s*발생일/u);
  assert.match(source, />\s*심각도/u);
  assert.match(source, />\s*상태/u);
  assert.match(source, />\s*담당자/u);
  assert.match(source, />\s*액션/u);
  assert.match(source, /isUnpaidFilterActive[\s\S]*>\s*미납금액/u);
  assert.doesNotMatch(source, />\s*결제상태/u);
  assert.match(source, /formatActionDate\(/u);
  assert.match(source, /\{formatActionDateOnly\(item\.date\)\}/u);
  assert.match(source, /\{item\.severity\}/u);
});

test('action required detail panel keeps the GT-facing CTA and section labels', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /결제 정보/u);
  assert.match(source, /처리 메모/u);
  assert.match(source, /메모 저장/u);
  assert.match(source, /관련 자산 보기/u);
  assert.match(source, /관련 예약 보기/u);
  assert.match(source, /이슈 해결 완료/u);
  assert.match(source, /\{formatActionDateOnly\(selectedItem\.date\)\}/u);
  assert.doesNotMatch(source, /최근 반영/u);
  assert.doesNotMatch(source, /선택한 항목이 존재하지 않습니다/u);
});
