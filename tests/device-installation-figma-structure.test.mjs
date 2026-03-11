import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('SCRUM-295 reshapes device installation around the Figma vehicle-first information architecture', async () => {
  const pageSource = await readFile(path.join(projectRoot, 'src/app/pages/DeviceInstallation.tsx'), 'utf8');

  assert.match(pageSource, /대기:\s*<strong>\{summary\.scheduled \+ summary\.inProgress\}<\/strong>건/u);
  assert.match(pageSource, /완료:\s*<strong>\{summary\.completed\}<\/strong>건/u);
  assert.match(pageSource, /차량번호/u);
  assert.match(pageSource, /<select[\s\S]*?data-testid="device-installation-vin-input"/u);
  assert.match(pageSource, /장착 대상 차량 리스트/u);
  assert.match(pageSource, /차종/u);
  assert.match(pageSource, /연식/u);
  assert.match(pageSource, /Health Check/u);
  assert.match(pageSource, /장착사진/u);
  assert.match(pageSource, /시리얼사진/u);
});

test('SCRUM-295 keeps a UI-facing pending\/completed\/failed status taxonomy over the existing workflow', async () => {
  const [pageSource, serviceSource] = await Promise.all([
    readFile(path.join(projectRoot, 'src/app/pages/DeviceInstallation.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/deviceInstallations.ts'), 'utf8'),
  ]);

  assert.match(pageSource, /type DeviceInstallationDisplayStatus = 'pending' \| 'completed' \| 'failed';/u);
  assert.match(pageSource, /function toDisplayStatus\(status: DeviceInstallationStatus\): DeviceInstallationDisplayStatus/u);
  assert.match(pageSource, /if \(status === 'completed'\)/u);
  assert.match(pageSource, /if \(status === 'cancelled'\)/u);
  assert.match(pageSource, /return 'pending';/u);
  assert.match(serviceSource, /export type DeviceInstallationStatus = 'scheduled' \| 'in_progress' \| 'completed' \| 'cancelled';/u);
});
