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
  assert.match(actionRequiredSource, /'정기점검'/u);
  assert.match(actionRequiredSource, /filterParam === '정기점검 만료 임박'/u);
  assert.match(actionRequiredSource, /return '정기점검';/u);
});

test('SCRUM-267 binds reopened home issue counts to action-required counts instead of home summary fields', () => {
  const homeSource = readProjectFile('src/app/pages/Home.tsx');

  assert.match(homeSource, /actionItemCountsByType/u);
  assert.match(homeSource, /count:\s*actionItemCountsByType\['반납 지연'\]/u);
  assert.match(homeSource, /count:\s*actionItemCountsByType\['미납\/결제 문제'\]/u);
  assert.doesNotMatch(homeSource, /count:\s*alerts\.overdue/u);
  assert.doesNotMatch(homeSource, /count:\s*kpis\.unpaidContracts/u);
});

test('SCRUM-267 keeps action-required count sync non-blocking and no longer labels the issue panel as period-scoped', () => {
  const homeSource = readProjectFile('src/app/pages/Home.tsx');

  assert.match(homeSource, /Promise\.allSettled\(/u);
  assert.doesNotMatch(homeSource, /periodLabel \? `\$\{periodLabel\}/u);
});

test('SCRUM-268 keeps the premium CTA vehicle count bound to the tenant asset total', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /premiumVehiclePreviewCount/u);
  assert.match(source, /premiumVehiclePreviewCount\.toLocaleString\(\)/u);
});
