import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('layout routes view-all notifications to the dedicated notifications route', () => {
  const source = readProjectFile('src/app/components/Layout.tsx');

  assert.match(source, /navigateWithRouteGuard\(NOTIFICATIONS_ROUTE\)/u);
});

test('notifications history page is registered in the router', () => {
  const routesSource = readProjectFile('src/app/routes.ts');

  assert.match(routesSource, /import Notifications from '\.\/pages\/Notifications';/u);
  assert.match(routesSource, /path: '\/notifications'/u);
  assert.match(routesSource, /Component: Notifications/u);
});

test('notifications history page exists', () => {
  const notificationsPagePath = path.join(projectRoot, 'src/app/pages/Notifications.tsx');

  assert.equal(fs.existsSync(notificationsPagePath), true);
});
