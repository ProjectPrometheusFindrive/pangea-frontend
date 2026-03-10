import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('reservation calendar resolves the display row by VIN before falling back to vehicleNumber', () => {
  const reservationsSource = readProjectFile('src/app/pages/Reservations.tsx');
  const viewModelSource = readProjectFile('src/app/pages/reservationsViewModel.ts');

  assert.match(viewModelSource, /export function resolveReservationVehicleNumber/u);
  assert.match(viewModelSource, /const reservationVin = normalizeVehicleVin\(reservation\.vin\)/u);
  assert.match(viewModelSource, /normalizeVehicleVin\(vehicle\.vin\) === reservationVin/u);

  assert.match(reservationsSource, /const reservationsByVehicle = useMemo\(\(\) => \{/u);
  assert.match(reservationsSource, /resolveReservationVehicleNumber\(reservation, vehicleAssets\)/u);
  assert.match(reservationsSource, /reservationsByVehicle\.get\(vehicleNumber\)/u);
  assert.match(reservationsSource, /const vehicleReservations = reservationsByVehicle\.get\(vehicle\) \?\? \[\]/u);
});
