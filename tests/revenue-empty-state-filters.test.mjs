import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('revenue filter toolbar stays outside PageStateBoundary so empty states still expose controls', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');

  const boundaryIndex = source.indexOf('<PageStateBoundary');
  const outerToolbarIndex = source.indexOf('className="m-4 mb-0 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"');
  const periodToolbarIndex = source.indexOf('{PERIOD_OPTIONS.map((option) => (');
  const granularityToolbarIndex = source.indexOf('{GRANULARITY_OPTIONS.map((option) => (');

  assert.ok(boundaryIndex >= 0, 'Revenue page should render PageStateBoundary');
  assert.ok(outerToolbarIndex >= 0, 'Revenue page should render an outer filter toolbar');
  assert.ok(periodToolbarIndex >= 0, 'Revenue page should render the period filter toolbar');
  assert.ok(granularityToolbarIndex >= 0, 'Revenue page should render the granularity filter toolbar');
  assert.ok(outerToolbarIndex < boundaryIndex, 'outer filter toolbar should stay outside PageStateBoundary');
  assert.ok(periodToolbarIndex < boundaryIndex, 'period filter toolbar should stay outside PageStateBoundary');
  assert.ok(granularityToolbarIndex < boundaryIndex, 'granularity filter toolbar should stay outside PageStateBoundary');
});

test('revenue page removes the dead duplicate toolbar block inside PageStateBoundary', () => {
  const source = readProjectFile('src/app/pages/Revenue.tsx');

  const periodToolbarMatches = source.match(/\{PERIOD_OPTIONS\.map\(\(option\) => \(/gu) ?? [];
  const granularityToolbarMatches = source.match(/\{GRANULARITY_OPTIONS\.map\(\(option\) => \(/gu) ?? [];

  assert.equal(periodToolbarMatches.length, 1, 'Revenue page should render the period toolbar only once');
  assert.equal(granularityToolbarMatches.length, 1, 'Revenue page should render the granularity toolbar only once');
  assert.doesNotMatch(source, /\{false && \(/u, 'Revenue page should not keep a dead duplicate toolbar block');
});
