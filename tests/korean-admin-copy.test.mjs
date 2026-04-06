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

test('notifications service contains concise Korean copy for notification codes', () => {
  const source = readProjectFile('src/services/notifications.ts');

  for (const phrase of [
    '오늘 대여 시작',
    '예약 상태 변경',
    '반납 완료',
    '사고 접수',
    '새 지원 티켓',
    '문의 상태 변경',
  ]) {
    assert.match(source, new RegExp(phrase, 'u'));
  }

  assert.match(source, /notificationCode/u);
  assert.match(source, /NOTIFICATION_TITLE_BY_CODE/u);
});
