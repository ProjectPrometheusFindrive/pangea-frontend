import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('payment info refresh callback is declared after hydrateActionDetail to avoid TDZ', () => {
  const source = readProjectFile('src/app/pages/ActionRequired.tsx');

  const hydrateActionDetailIndex = source.indexOf('const hydrateActionDetail = useCallback');
  const handleRefreshPaymentInfoIndex = source.indexOf('const handleRefreshPaymentInfo = useCallback');

  assert.ok(hydrateActionDetailIndex >= 0, 'hydrateActionDetail declaration not found');
  assert.ok(handleRefreshPaymentInfoIndex >= 0, 'handleRefreshPaymentInfo declaration not found');
  assert.ok(
    hydrateActionDetailIndex < handleRefreshPaymentInfoIndex,
    'handleRefreshPaymentInfo must be declared after hydrateActionDetail',
  );
});
