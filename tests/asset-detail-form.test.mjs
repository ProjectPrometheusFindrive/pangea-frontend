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

test('asset detail form helpers include color/category/vehicleType in hydrate and patch payload', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/assetsDetailForm.ts');

  const baselineAsset = {
    plate: '12가3456',
    vehicleNumber: '12가3456',
    model: '아반떼',
    year: '2024',
    status: '가용',
    memo: '기존 메모',
    color: '검정',
    category: 'SUV',
    vehicleType: '승용',
    version: 3,
  };

  const hydratedForm = module.toAssetEditForm(baselineAsset);
  assert.deepEqual(hydratedForm, {
    plate: '12가3456',
    model: '아반떼',
    year: '2024',
    status: '가용',
    memo: '기존 메모',
    color: '검정',
    category: 'SUV',
    vehicleType: '승용',
  });

  const result = module.buildAssetPatchPayload({
    asset: baselineAsset,
    form: {
      ...hydratedForm,
      color: '흰색',
      category: '세단',
      vehicleType: '중형',
    },
  });

  assert.deepEqual(result.fieldErrors, {});
  assert.deepEqual(result.payload, {
    version: 3,
    color: '흰색',
    category: '세단',
    vehicleType: '중형',
  });

  const fieldErrors = module.mapAssetEditFieldErrors([
    { name: 'color', reason: '색상을 확인해 주세요.' },
    { name: 'category', reason: '카테고리를 확인해 주세요.' },
    { name: 'vehicleType', reason: '차량 유형을 확인해 주세요.' },
  ]);
  assert.deepEqual(fieldErrors, {
    color: '색상을 확인해 주세요.',
    category: '카테고리를 확인해 주세요.',
    vehicleType: '차량 유형을 확인해 주세요.',
  });
});
