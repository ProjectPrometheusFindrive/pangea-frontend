import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('ActionRequired exposes Korean severity labels instead of raw English option copy', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(source, /높음/u);
  assert.match(source, /보통/u);
  assert.match(source, /낮음/u);
  assert.doesNotMatch(source, /<option value="high">High<\/option>/u);
  assert.doesNotMatch(source, /<option value="medium">Medium<\/option>/u);
  assert.doesNotMatch(source, /<option value="low">Low<\/option>/u);
});

test('notifications service contains Korean fallback copy for known notification events', () => {
  const source = readProjectFile('src/services/notifications.ts');

  for (const phrase of [
    '새 예약이 생성되었습니다.',
    '예약 상태가 변경되었습니다.',
    '예약이 반납 처리되었습니다.',
    '사고가 접수되었습니다.',
    '새 문의가 접수되었습니다.',
    '문의 상태가 변경되었습니다.',
  ]) {
    assert.match(source, new RegExp(phrase, 'u'));
  }
});
