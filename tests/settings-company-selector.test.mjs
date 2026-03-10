import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('settings page supports a super admin company selector with pre-selection guard', async () => {
  const [settingsSource, pageSource] = await Promise.all([
    readFile(path.join(projectRoot, 'src/services/settings.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/pages/Settings.tsx'), 'utf8'),
  ]);

  assert.match(settingsSource, /export function listSettingsCompanies/);
  assert.match(pageSource, /const \[searchParams,\s*setSearchParams\] = useSearchParams/u);
  assert.match(pageSource, /listSettingsCompanies/u);
  assert.match(pageSource, /selectedCompanyId:\s*settingsCompanyId/u);
  assert.match(pageSource, /회사를 선택해 주세요/u);
  assert.match(pageSource, /isSuperAdmin && !settingsCompanyId/u);
});
