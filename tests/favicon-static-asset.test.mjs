import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('login shell ships a favicon.ico fallback asset', () => {
  const faviconPath = path.join(projectRoot, 'public', 'favicon.ico');

  assert.equal(fs.existsSync(faviconPath), true);
});
