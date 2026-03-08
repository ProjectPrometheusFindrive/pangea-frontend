import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('reservation service payload type exposes structured payment fields', () => {
  const source = readProjectFile('src/services/reservations.ts');

  assert.match(source, /paymentMethod\?: string;/u);
  assert.match(source, /paymentStatus\?: string;/u);
  assert.match(source, /amount\?: number;/u);
  assert.match(source, /deposit\?: number;/u);
});

test('reservation create flow sends structured payment fields with the API request', () => {
  const source = readProjectFile('src/app/pages/Reservations.tsx');

  assert.match(source, /paymentMethod: formValues\.paymentMethod,/u);
  assert.match(source, /paymentStatus: formValues\.paymentStatus,/u);
  assert.match(source, /amount: toCurrencyNumberFromInput\(formValues\.amount\),/u);
  assert.match(source, /deposit: toCurrencyNumberFromInput\(formValues\.deposit\),/u);
});
