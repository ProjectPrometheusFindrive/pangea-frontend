import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
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

async function renderVehicleDetailModal() {
  const { VehicleDetailModal } = await viteServer.ssrLoadModule('/src/app/components/VehicleDetailModal.tsx');

  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(VehicleDetailModal, {
        asset: {
          id: 'ASSET-001',
          vehicleNumber: '12가3456',
          plate: '12가3456',
          model: '아반떼',
          status: '가용',
          vin: 'KMH12A34560000001',
          year: '2024',
          owner: '홍길동',
          insuranceExpiry: '2026-12-31',
          nextInspection: '2026-06-30',
          issues: [],
          version: 1,
          updatedAt: '2026-03-07T00:00:00.000Z',
          memo: '',
        },
        historyEntries: [],
        isHistoryLoading: false,
        historyError: null,
        onHistoryRetry: () => {},
        onConflictRefresh: () => {},
        isOpen: true,
        onClose: () => true,
        editForm: {
          plate: '12가3456',
          model: '아반떼',
          year: '2024',
          status: '가용',
          memo: '',
          color: '',
          category: '',
          vehicleType: '',
        },
        fieldErrors: {},
        saveError: null,
        conflictNotice: null,
        isSaving: false,
        isDeleting: false,
        isDirty: false,
        canEdit: true,
        onEditFieldChange: () => {},
        handleSave: () => {},
        handleDelete: () => {},
        getStatusColor: () => 'bg-slate-100 text-slate-700',
      }),
    ),
  );
}

test('VehicleDetailModal renders editable color/category/vehicleType inputs without contractStatus editor', async () => {
  const markup = await renderVehicleDetailModal();

  assert.match(markup, /asset-detail-color-input/);
  assert.match(markup, /asset-detail-category-input/);
  assert.match(markup, /asset-detail-vehicle-type-input/);
  assert.doesNotMatch(markup, /asset-detail-contract-status-input/);
});
