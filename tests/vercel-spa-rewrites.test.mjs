import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('vercel rewrites route SPA paths to index without breaking static files', () => {
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));

  assert.ok(Array.isArray(config.rewrites));
  assert.deepEqual(config.rewrites, [
    {
      source: '/((?!.*\\..*).*)',
      destination: '/index.html',
    },
  ]);
});
