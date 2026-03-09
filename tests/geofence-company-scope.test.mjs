import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('settings geofence requests thread explicit company scope through the page and service layer', () => {
  const settingsServiceSource = readProjectFile('src/services/settings.ts');
  const settingsPageSource = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(settingsServiceSource, /companyId\?: string/);
  assert.match(settingsServiceSource, /listSettingsGeofences[\s\S]*query:\s*\{[\s\S]*companyId:\s*options\.companyId[\s\S]*\}/u);
  assert.match(settingsServiceSource, /createSettingsGeofence[\s\S]*query:\s*\{[\s\S]*companyId:\s*options\.companyId[\s\S]*\}/u);
  assert.match(settingsServiceSource, /updateSettingsGeofence[\s\S]*query:\s*\{[\s\S]*companyId:\s*options\.companyId[\s\S]*\}/u);
  assert.match(settingsServiceSource, /deleteSettingsGeofence[\s\S]*query:\s*\{[\s\S]*companyId:\s*options\.companyId[\s\S]*\}/u);
  assert.match(settingsPageSource, /useSearchParams/);
  assert.match(settingsPageSource, /companyId:\s*settingsCompanyId\s*\?\?\s*undefined/);
});
