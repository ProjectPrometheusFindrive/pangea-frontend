import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('new contract modal validates customer phone with the shared mobile format', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.ok(source.includes('const PHONE_REGEX = /^010-\\d{4}-\\d{4}$/;'));
  assert.match(source, /!PHONE_REGEX\.test\(customerPhone\.trim\(\)\)/u);
  assert.match(source, /nextErrors\.customerPhone\s*=/u);
});

test('new contract modal no longer collects unsupported ssn input', () => {
  const source = readProjectFile('src/app/components/NewContractModal.tsx');

  assert.doesNotMatch(source, /customerSSN/u);
  assert.doesNotMatch(source, /new-contract-customer-ssn-input/u);
});
