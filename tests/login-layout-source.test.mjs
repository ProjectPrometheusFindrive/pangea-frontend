import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('SCRUM-265 login renders a split shell with a dedicated brand panel', () => {
  const source = readProjectFile('src/app/pages/Login.tsx');

  assert.match(source, /data-testid="login-shell"/u);
  assert.match(source, /data-testid="login-brand-panel"/u);
  assert.match(source, /data-testid="login-form-panel"/u);
  assert.match(source, />Pangea</u);
  assert.match(source, /차량 관리의 새로운 기준/u);
  assert.match(source, /to="\/terms"/u);
});
