import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('action required list request uses pageSize and forwards status priority assignee filters', () => {
  const serviceSource = readProjectFile('src/services/actionRequired.ts');
  const pageSource = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.match(serviceSource, /pageSize\?: number;/u);
  assert.match(serviceSource, /const \{ page, pageSize, status, priority, assignee, signal \} = options;/u);
  assert.match(serviceSource, /query:\s*\{[\s\S]*page,\s*pageSize,\s*status,\s*priority,\s*assignee,/u);

  assert.match(pageSource, /getActionRequiredList\(\{\s*page,\s*pageSize,\s*status:/u);
  assert.match(pageSource, /priority:\s*priorityFilter === 'all' \? undefined : priorityFilter,/u);
  assert.match(pageSource, /assignee:\s*assigneeFilter === 'all' \? undefined : assigneeFilter,/u);
});

test('action required page hides non-GT dropdown filters from the visible contract', () => {
  const pageSource = readProjectFile('src/app/pages/ActionRequired.tsx');

  assert.doesNotMatch(pageSource, /id="action-required-status-filter"/u);
  assert.doesNotMatch(pageSource, /id="action-required-priority-filter"/u);
  assert.doesNotMatch(pageSource, /id="action-required-assignee-filter"/u);
  assert.doesNotMatch(pageSource, /id="action-required-page-size"/u);
});
