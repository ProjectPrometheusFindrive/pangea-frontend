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
    server: {
      middlewareMode: true,
    },
  });
});

after(async () => {
  await viteServer?.close();
});

test('resolveApiBaseUrl keeps explicit env values and falls back to the active origin', async () => {
  const module = await viteServer.ssrLoadModule('/src/services/api/index.ts');
  const originalWindow = globalThis.window;

  assert.equal(module.resolveApiBaseUrl('http://127.0.0.1:5000'), 'http://127.0.0.1:5000');

  globalThis.window = {
    location: {
      origin: 'http://193.122.120.89',
    },
  };

  try {
    assert.equal(module.resolveApiBaseUrl(undefined), 'http://193.122.120.89');
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }

  assert.equal(module.resolveApiBaseUrl(''), 'https://api.pangea.local');
});
