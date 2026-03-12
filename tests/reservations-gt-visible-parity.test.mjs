import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Reservations matches the GT top control contract without overdue, date-range, or page-size controls', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /handleViewFilterChange\('all'\)/u);
  assert.match(source, /handleViewFilterChange\('reservation'\)/u);
  assert.match(source, /handleViewFilterChange\('rental'\)/u);
  assert.match(source, /handleViewFilterChange\('return'\)/u);
  assert.match(source, /handleViewFilterChange\('unpaid'\)/u);
  assert.doesNotMatch(source, /handleViewFilterChange\('overdue'\)/u);

  assert.match(source, /setCurrentWeekStart\(prev => prev - 7\)/u);
  assert.match(source, /setCurrentWeekStart\(0\)/u);
  assert.match(source, /setCurrentWeekStart\(prev => prev \+ 7\)/u);

  assert.match(source, /placeholder="차량번호 검색"/u);
  assert.match(source, /aria-label="차량번호 검색"/u);
  assert.match(source, /총\s*<span className="font-semibold text-blue-600">\{filteredVehicles\.length\}<\/span>대 표시 중/u);
  assert.match(source, /const page = DEFAULT_PAGE;/u);
  assert.match(source, /const pageSize = DEFAULT_PAGE_SIZE;/u);
  assert.match(source, /const mergedReservationRows: unknown\[\] = \[\];/u);
  assert.match(source, /const pageRows = getCollectionFromPayload\(payload, \['reservations', 'items', 'rows', 'list'\]\) \?\? \[\];/u);
  assert.match(source, /nextParams\.delete\('page'\)/u);
  assert.match(source, /nextParams\.delete\('size'\)/u);

  assert.doesNotMatch(source, />기간:</u);
  assert.doesNotMatch(source, /value=\{fromDate \?\? ''\}/u);
  assert.doesNotMatch(source, /value=\{toDate \?\? ''\}/u);
  assert.doesNotMatch(source, /현재 페이지/u);
  assert.doesNotMatch(source, /서버 집계/u);
  assert.doesNotMatch(source, /PAGE_SIZE_OPTIONS\.map/u);
});
