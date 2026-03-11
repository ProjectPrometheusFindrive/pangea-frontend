import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('SCRUM-295 keeps the vehicle-first installer form complete for manual entry', async () => {
  const pageSource = await readFile(path.join(projectRoot, 'src/app/pages/DeviceInstallation.tsx'), 'utf8');

  assert.match(pageSource, /summary\.scheduled \+ summary\.inProgress/u);
  assert.match(pageSource, /summary\.completed/u);
  assert.match(pageSource, /data-testid="device-installation-vin-input"/u);
  assert.match(pageSource, /data-testid="device-installation-manual-vin-input"/u);
  assert.match(pageSource, /data-testid="device-installation-scheduled-at-input"/u);
  assert.match(pageSource, /Health Check/u);
  assert.match(pageSource, /device-installation-serial-photo-file-input/u);
});

test('SCRUM-295 keeps cancelled work distinct from completed and in-progress states', async () => {
  const [pageSource, serviceSource] = await Promise.all([
    readFile(path.join(projectRoot, 'src/app/pages/DeviceInstallation.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/deviceInstallations.ts'), 'utf8'),
  ]);

  assert.match(pageSource, /type DeviceInstallationDisplayStatus = 'pending' \| 'completed' \| 'cancelled';/u);
  assert.match(pageSource, /function toDisplayStatus\(status: DeviceInstallationStatus\): DeviceInstallationDisplayStatus/u);
  assert.match(pageSource, /if \(status === 'cancelled'\)\s*\{\s*return 'cancelled';/u);
  assert.doesNotMatch(pageSource, /return 'failed';/u);
  assert.match(serviceSource, /export type DeviceInstallationStatus = 'scheduled' \| 'in_progress' \| 'completed' \| 'cancelled';/u);
});

test('SCRUM-295 renders installation and serial photos in separate columns', async () => {
  const pageSource = await readFile(path.join(projectRoot, 'src/app/pages/DeviceInstallation.tsx'), 'utf8');

  assert.match(pageSource, /installation\.photos\[0\]/u);
  assert.match(pageSource, /installation\.photos\[1\]/u);
  assert.doesNotMatch(pageSource, /installation\.photos\.map/u);
});
