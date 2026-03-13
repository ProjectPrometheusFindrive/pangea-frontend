import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('settings page auto-resolves super admin company scope without rendering a selector gate', async () => {
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
  assert.match(settingsPageSource, /const effectiveSettingsCompanyId = useMemo\(/u);
  assert.match(settingsPageSource, /settingsCompanyId \?\? \(isSuperAdmin \? companyOptions\[0\]\?\.companyId \?\? null : null\)/u);
  assert.match(settingsPageSource, /if \(!selectedCompanyId && normalizedItems\.length > 0\) \{/u);
  assert.match(settingsPageSource, /updateSettingsCompanyScope\(normalizedItems\[0\]\.companyId, true\)/u);
  assert.doesNotMatch(settingsPageSource, /회사 범위/u);
});
