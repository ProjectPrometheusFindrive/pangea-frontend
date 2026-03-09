import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('terms agreement uses a single all-agree control and refreshed policy copy', () => {
  const source = readProjectFile('src/app/pages/TermsAgreement.tsx');

  assert.match(source, /전체 동의/u);
  assert.doesNotMatch(source, /필수 전체 동의/u);
  assert.doesNotMatch(source, /선택 약관/u);
  assert.match(source, /privacy:\s*shouldCheck,[\s\S]*location:\s*shouldCheck,[\s\S]*marketing:\s*shouldCheck/u);

  assert.match(source, /서비스 회원가입 및 관리/u);
  assert.match(source, /차량 배차, 예약 운영, 고객 상담/u);
  assert.match(source, /차량 관제, 도난·분실 대응, 운행기록 분석/u);
  assert.match(source, /프로모션, 이벤트, 신규 기능, 제휴 혜택/u);
  assert.match(source, /언제든지 수신 동의를 철회/u);
});
