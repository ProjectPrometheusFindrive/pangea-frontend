import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('notifications service accepts page and pageSize request options', () => {
  const source = readProjectFile('src/services/notifications.ts');

  assert.match(source, /export interface NotificationListRequestOptions[\s\S]*page\?: number;/u);
  assert.match(source, /export interface NotificationListRequestOptions[\s\S]*pageSize\?: number;/u);
});

test('notifications service sends page and pageSize to the backend contract', () => {
  const source = readProjectFile('src/services/notifications.ts');

  assert.match(source, /query:\s*\{[\s\S]*page:\s*options\.page,/u);
  assert.match(source, /query:\s*\{[\s\S]*pageSize:\s*options\.pageSize,/u);
  assert.doesNotMatch(source, /query:\s*\{[\s\S]*limit:\s*options\.limit,/u);
});

test('notifications history page requests paged notifications and exposes bulk mark-as-read behavior', () => {
  const source = readProjectFile('src/app/pages/Notifications.tsx');

  assert.match(source, /getNotifications\(\{\s*page:\s*currentPage,\s*pageSize:\s*PAGE_SIZE,\s*signal\s*\}\)/u);
  assert.match(source, /markAllNotificationsAsRead/u);
});

test('layout refreshes notification summary from the shared updated-state event', () => {
  const source = readProjectFile('src/app/components/Layout.tsx');

  assert.match(source, /NOTIFICATION_STATE_UPDATED_EVENT/u);
  assert.match(source, /getNotifications\(\{\s*page:\s*1,\s*pageSize:\s*30,\s*signal\s*\}\)/u);
  assert.match(source, /window\.addEventListener\(NOTIFICATION_STATE_UPDATED_EVENT/u);
});
