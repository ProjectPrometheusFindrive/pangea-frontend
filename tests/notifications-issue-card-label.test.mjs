import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('notifications service formats opaque action-item ids into issue-type vehicle labels', () => {
  const source = readProjectFile('src/services/notifications.ts');

  assert.match(source, /ACTION_ITEM_IDENTIFIER_PATTERN/u);
  assert.match(source, /metadata\.vehicleNumber/u);
  assert.match(source, /payload\.notificationCode/u);
  assert.match(source, /return `\$\{actionItemType\}-\$\{vehicleNumber\}`;/u);
  assert.match(source, /`\$\{actionItemDisplayName\}에 메모가 추가되었습니다\.`/u);
});

test('notifications service normalizes verbose event titles into legacy-style concise labels', () => {
  const source = readProjectFile('src/services/notifications.ts');

  for (const phrase of [
    '반납 지연',
    '사고 접수',
    '도난 의심',
    '보험 만료 임박',
    '단말 OFF',
    '오늘 대여 시작',
    '결제 문제',
    '정기점검 예정',
  ]) {
    assert.match(source, new RegExp(phrase, 'u'));
  }
});

test('notifications service formats concise card messages by notification code', () => {
  const source = readProjectFile('src/services/notifications.ts');

  for (const phrase of [
    '예약이 생성되었습니다.',
    '상태가',
    '반납이 완료되었습니다.',
    '사고가 접수되었습니다.',
    '지원 티켓',
    '메모가 추가되었습니다.',
  ]) {
    assert.match(source, new RegExp(phrase, 'u'));
  }
});

test('layout dropdown renders the notification title without prepending vehicle number', () => {
  const source = readProjectFile('src/app/components/Layout.tsx');

  assert.match(
    source,
    /<h4 className="text-sm font-bold text-gray-900 truncate">\s*\{notification\.title\}\s*<\/h4>/u,
  );
  assert.doesNotMatch(
    source,
    /`\$\{notification\.vehicleNumber\}\s*-\s*\$\{notification\.title\}`/u,
  );
});
