import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function loadProjectModule(relativePath) {
  return import(pathToFileURL(path.join(projectRoot, relativePath)).href);
}

test('asset create readiness blocks placeholder company profiles with recoverable guidance', async () => {
  const module = await loadProjectModule('src/app/pages/assetCreateReadiness.js');

  assert.deepEqual(
    module.getAssetCreateReadiness({
      tenantCompanyId: 'company-123',
      company: {
        id: 'company-local',
        name: '',
        businessNumber: '',
        address: '',
      },
    }),
    {
      isReady: false,
      message: module.COMPANY_PROFILE_REQUIRED_MESSAGE,
      settingsPath: module.COMPANY_PROFILE_SETTINGS_PATH,
    },
  );
});

test('asset create readiness allows saved company profiles', async () => {
  const module = await loadProjectModule('src/app/pages/assetCreateReadiness.js');

  assert.deepEqual(
    module.getAssetCreateReadiness({
      tenantCompanyId: 'company-123',
      company: {
        id: 'company-123',
        name: 'Pangea Mobility',
        businessNumber: '123-45-67890',
        address: 'Seoul',
      },
    }),
    {
      isReady: true,
      message: null,
      settingsPath: null,
    },
  );
});
