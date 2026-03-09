import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('SCRUM-266 home groups the work rail and issue grid in the same priority panel', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /data-testid="home-priority-panel"/u);
  assert.match(source, /data-testid="home-today-column"/u);
  assert.match(source, /data-testid="home-issue-grid"/u);
  assert.match(source, /정기점검 만료 임박/u);
  assert.match(source, /미납\/결제 문제/u);
});

test('SCRUM-267 keeps the maintenance issue label aligned between Home and ActionRequired', () => {
  const homeSource = readProjectFile('src/app/pages/Home.tsx');
  const actionRequiredSource = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(homeSource, /handleIssueClick\('정기점검 만료 임박'\)/u);
  assert.match(actionRequiredSource, /'정기점검 만료 임박'/u);
  assert.match(actionRequiredSource, /return '정기점검 만료 임박';/u);
});

test('SCRUM-268 keeps the premium CTA vehicle count bound to the tenant asset total', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /premiumVehiclePreviewCount/u);
  assert.match(source, /premiumVehiclePreviewCount\.toLocaleString\(\)/u);
});
