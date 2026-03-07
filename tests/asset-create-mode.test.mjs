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

test('asset create mode helper routes manual mode directly to preview and keeps empty manual forms non-dirty', async () => {
  const module = await viteServer.ssrLoadModule('/src/app/pages/assetCreateMode.ts');

  assert.equal(
    module.resolveCreateModeSwitch({
      nextMode: 'manual',
      hasRegistrationFile: false,
      hasOcrOutput: false,
    }),
    'preview',
  );
  assert.equal(
    module.resolveCreateModeSwitch({
      nextMode: 'ocr',
      hasRegistrationFile: false,
      hasOcrOutput: false,
    }),
    'upload',
  );
  assert.equal(
    module.resolveCreateModeSwitch({
      nextMode: 'ocr',
      hasRegistrationFile: true,
      hasOcrOutput: true,
    }),
    'preview',
  );

  const emptyForm = {
    vehicleNumber: '',
    vin: '',
    model: '',
    year: '',
    owner: '',
    insuranceExpiry: '',
  };
  const emptyFiles = {
    vehicleRegistration: null,
    insurance: null,
    loanSchedule: null,
  };

  assert.equal(
    module.isCreateDirty({
      createMode: 'manual',
      uploadStep: 'preview',
      createForm: emptyForm,
      uploadedFiles: emptyFiles,
    }),
    false,
  );
  assert.equal(
    module.isCreateDirty({
      createMode: 'ocr',
      uploadStep: 'preview',
      createForm: emptyForm,
      uploadedFiles: emptyFiles,
    }),
    true,
  );
  assert.equal(
    module.isCreateDirty({
      createMode: 'manual',
      uploadStep: 'preview',
      createForm: { ...emptyForm, vehicleNumber: '12가3456' },
      uploadedFiles: emptyFiles,
    }),
    true,
  );
});
