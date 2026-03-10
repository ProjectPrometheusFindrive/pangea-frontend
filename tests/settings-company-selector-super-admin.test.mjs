import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('settings page exposes super admin company selector and query-synced guard state', async () => {
  const [settingsServiceSource, settingsPageSource] = await Promise.all([
    readFile(path.join(projectRoot, 'src/services/settings.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/pages/Settings.tsx'), 'utf8'),
  ]);

  assert.match(settingsServiceSource, /export interface SettingsCompanyOption/u);
  assert.match(settingsServiceSource, /listSettingsCompanies/u);
  assert.match(settingsServiceSource, /path:\s*'\/api\/v2\/settings\/companies'/u);

  assert.match(settingsPageSource, /const \[searchParams,\s*setSearchParams\] = useSearchParams\(\)/u);
  assert.match(settingsPageSource, /const isSuperAdmin = \(user\?\.role \?\? ''\)\.trim\(\)\.toLowerCase\(\) === 'super_admin'/u);
  assert.match(settingsPageSource, /listSettingsCompanies\(/u);
  assert.match(settingsPageSource, /setSearchParams\(\(previousParams\)/u);
  assert.match(settingsPageSource, /if \(isSuperAdmin && !settingsCompanyId\)/u);
  assert.match(settingsPageSource, /회사를 선택해 주세요/u);
  assert.match(settingsPageSource, /value=\{settingsCompanyId \?\? ''\}/u);
});
