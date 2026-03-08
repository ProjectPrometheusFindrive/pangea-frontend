import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = 'C:/Users/juhyu/.config/superpowers/worktrees/pangea-frontend/SCRUM-235-member-reservation-cancel-403';

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('reservation cancel action is guarded by transition permission instead of generic write permission', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /if\s*\(!canTransitionReservations\)\s*\{/u);
  assert.match(source, /selectedReservation\.type === 'reservation' && canTransitionReservations/u);
  assert.match(source, /disabled=\{!canTransitionReservations \|\| activeReservationAction !== null\}/u);
});
