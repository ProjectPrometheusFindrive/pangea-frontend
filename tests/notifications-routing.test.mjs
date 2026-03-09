import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  ACTION_REQUIRED_ROUTE,
  resolveNotificationPath,
} from '../src/services/notificationNavigation.js';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('notification resolver keeps explicit relative paths', () => {
  assert.equal(
    resolveNotificationPath({
      path: '/reservations?search=R-123',
    }),
    '/reservations?search=R-123',
  );
});

test('notification resolver normalizes absolute urls into app paths', () => {
  assert.equal(
    resolveNotificationPath({
      linkUrl: 'https://pangea-frontend.vercel.app/assets?search=12%EA%B0%803456',
    }),
    '/assets?search=12%EA%B0%803456',
  );
});

test('notification resolver falls back to reservation search when reservation metadata exists', () => {
  assert.equal(
    resolveNotificationPath({
      linkUrl: null,
      metadata: {
        reservationId: 'R-OVERLAP-TEST-001',
      },
    }),
    '/reservations?search=R-OVERLAP-TEST-001',
  );
});

test('notification resolver falls back to asset search when asset metadata exists', () => {
  assert.equal(
    resolveNotificationPath({
      metadata: {
        entityType: 'asset',
        assetId: 'A-001',
      },
    }),
    '/assets?search=A-001',
  );
});

test('notification resolver uses action-required only when no actionable hint exists', () => {
  assert.equal(
    resolveNotificationPath({
      title: 'New notification',
    }),
    ACTION_REQUIRED_ROUTE,
  );
});

test('notifications service delegates path resolution to the shared helper', () => {
  const source = readProjectFile('src/services/notifications.ts');

  assert.match(source, /resolveNotificationPath/u);
});
