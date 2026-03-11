import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('SCRUM-290 aligns the home operation-score taxonomy with the approved Figma labels', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /label:\s*'안전운전'/u);
  assert.match(source, /label:\s*'차량관리'/u);
  assert.match(source, /label:\s*'사업운영'/u);
  assert.doesNotMatch(source, /label:\s*'자산 활용률'/u);
  assert.doesNotMatch(source, /label:\s*'계약 완료율'/u);
  assert.doesNotMatch(source, /label:\s*'연체 안전도'/u);
});

test('SCRUM-290 keeps recent changes in a separate card instead of nesting it inside operation scores', () => {
  const source = readProjectFile('src/app/pages/Home.tsx');

  assert.match(source, /data-testid="home-operation-score-card"/u);
  assert.match(source, /data-testid="home-recent-changes-card"/u);
  assert.match(source, /data-testid="home-operation-score-card"[\s\S]*?운영 점수/u);
  assert.match(source, /data-testid="home-recent-changes-card"[\s\S]*?최근 변경/u);
});
