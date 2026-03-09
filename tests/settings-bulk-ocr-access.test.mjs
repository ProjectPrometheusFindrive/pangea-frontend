import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

let viteServer;

before(async () => {
  viteServer = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: {
      noDiscovery: true,
    },
    server: {
      middlewareMode: true,
      hmr: false,
    },
  });
});

after(async () => {
  await viteServer?.close();
});

test('bulk OCR access accepts asset write permission even without settings write', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/settingsBulkOcr.ts');

  assert.equal(
    module.canAccessBulkOcr({
      canEditSettings: false,
      canWriteAssets: true,
    }),
    true,
  );
  assert.equal(
    module.canAccessBulkOcr({
      canEditSettings: true,
      canWriteAssets: false,
    }),
    true,
  );
  assert.equal(
    module.canAccessBulkOcr({
      canEditSettings: false,
      canWriteAssets: false,
    }),
    false,
  );
});
