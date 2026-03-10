import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('company bootstrap skips settings/company fetches for installer view roles', () => {
  const source = readProjectFile('src/app/context/CompanyContext.tsx');

  assert.match(source, /viewRole/u);
  assert.match(source, /viewRole === 'device-installer'/u);
  assert.match(source, /clearCachedCompany\(\)/u);
  assert.match(source, /setIsLoading\(false\)/u);
  assert.match(source, /return;\s*\n\s*\}\s*\n\s*\n\s*void refreshCompany\(\);/u);
});

test('layout skips notification bootstrap and hides notification entry points for installers', () => {
  const source = readProjectFile('src/app/components/Layout.tsx');

  assert.match(source, /const \{ logout, user, viewRole \} = useAuth\(\);/u);
  assert.match(source, /const canUseNotifications = viewRole !== 'device-installer';/u);
  assert.match(source, /if \(!canUseNotifications\) \{\s*setNotifications\(\[\]\);\s*setUnreadCount\(0\);\s*setNotificationsError\(null\);\s*setIsNotificationsLoading\(false\);\s*return;\s*\}/u);
  assert.match(source, /\{canUseNotifications && \(/u);
});
