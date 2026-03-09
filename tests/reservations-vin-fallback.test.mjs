import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = 'C:/Users/juhyu/.config/superpowers/worktrees/pangea-frontend/SCRUM-220-reservations-total-count-mismatch';

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('reservation normalization falls back to VIN when the plate fields are missing', () => {
  const reservationsSource = readProjectFile('src/app/pages/Reservations.tsx');
  const viewModelSource = readProjectFile('src/app/pages/reservationsViewModel.ts');

  assert.match(reservationsSource, /\?\?\s*toStringValue\(row\.vin\)/u);
  assert.match(viewModelSource, /\?\?\s*toStringValue\(row\.vin\)/u);
});
