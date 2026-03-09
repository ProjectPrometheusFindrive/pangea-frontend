import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('home keeps today tasks in a left column and issue-matched cards in the priority panel', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /data-testid="home-priority-panel"/u);
  assert.match(source, /lg:grid-cols-\[280px_minmax\(0,1fr\)\]/u);
  assert.match(source, /data-testid="home-today-column"/u);
  assert.match(source, /data-testid="home-issue-grid"/u);
  assert.match(source, /home-issue-card-maintenance/u);
  assert.match(source, /home-issue-card-stolen/u);
  assert.match(source, /home-issue-card-device-off/u);
  assert.match(source, /premiumVehiclePreviewCount = Math\.max\(1, kpis\.totalAssets\)/u);
});
