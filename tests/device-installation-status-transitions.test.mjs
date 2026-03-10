import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('device installation page exposes start and complete transitions with refresh semantics', async () => {
  const [pageSource, serviceSource] = await Promise.all([
    readFile(path.join(projectRoot, 'src/app/pages/DeviceInstallation.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/deviceInstallations.ts'), 'utf8'),
  ]);

  assert.match(serviceSource, /export async function patchDeviceInstallationStatus/u);

  assert.match(pageSource, /handleStartInstallation/u);
  assert.match(pageSource, /handleCompleteInstallation/u);
  assert.match(pageSource, /patchDeviceInstallationStatus\(installationId,\s*\{\s*status:\s*'in_progress'/u);
  assert.match(pageSource, /patchDeviceInstallationStatus/u);
  assert.match(pageSource, /status:\s*'completed'/u);
  assert.match(pageSource, /installedAt:\s*new Date\(\)\.toISOString\(\)/u);
  assert.match(pageSource, /void handleCompleteInstallation\(installation\.id\);/u);
  assert.doesNotMatch(pageSource, /void handleCompleteInstallation\(installation\);/u);
  assert.match(pageSource, /toActionErrorMessage\('start', error\)/u);
  assert.match(pageSource, /toActionErrorMessage\('complete', error\)/u);
  assert.match(pageSource, /await refreshAll\(\)/u);
  assert.match(pageSource, /작업 시작/u);
  assert.match(pageSource, /작업 완료/u);
});
