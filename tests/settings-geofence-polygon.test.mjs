import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('settings geofence service types expose polygon points payloads', () => {
  const source = readProjectFile('src/services/settings.ts');

  assert.match(source, /interface SettingsGeofencePoint/u);
  assert.ok(source.includes('points?: SettingsGeofencePoint[]'));
  assert.ok(source.includes('points: SettingsGeofencePoint[]'));
});

test('kakao geofence input component exists for polygon editing', () => {
  const source = readProjectFile('src/app/components/KakaoGeofenceInput.tsx');

  assert.match(source, /pointsText/u);
  assert.match(source, /shape === 'polygon'/u);
  assert.match(source, /<textarea/u);
});

test('settings geofence editor wires polygon input and submits point payloads', () => {
  const source = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(source, /KakaoGeofenceInput/u);
  assert.match(source, /pointsText/u);
  assert.match(source, /shape/u);
  assert.match(source, /points:\s*parsedPolygon\.points/u);
  assert.match(source, /geofence\.points\?\.length/u);
});
