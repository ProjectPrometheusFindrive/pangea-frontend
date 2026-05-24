import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('reservation calendar highlights the today column without overriding drag feedback', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /const isTodayColumn = dayOffset === 0;/u);
  assert.match(source, /data-testid=\{isTodayColumn \? 'reservation-calendar-today-header' : undefined\}/u);
  assert.match(source, /data-today-column=\{isTodayColumn \? 'true' : undefined\}/u);
  assert.match(source, /isTodayColumn\s*\?\s*'border-blue-200 bg-blue-100\/70'\s*:\s*'border-gray-200 bg-gray-50'/u);
  assert.match(source, /isTodayColumn\s*\?\s*'bg-blue-50\/60 hover:bg-blue-100\/60'\s*:\s*'hover:bg-blue-50\/30'/u);
  assert.match(source, /isInDragSelection\s*\?\s*\(hasConflict \? 'bg-red-200\/50' : 'bg-blue-200\/50'\)/u);
});
