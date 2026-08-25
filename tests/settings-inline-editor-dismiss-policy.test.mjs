import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('settings inline editors use Escape-only shared dismiss policy', () => {
  const source = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(source, /import \{ useModalDismiss \} from '\.\.\/hooks\/useModalDismiss';/u);
  assert.match(source, /isOpen: isGeofenceEditorOpen,[\s\S]*onDismiss: closeGeofenceEditor,[\s\S]*closeOnBackdrop: false/u);
  assert.match(source, /isOpen: isGarageEditorOpen,[\s\S]*onDismiss: closeGarageEditor,[\s\S]*closeOnBackdrop: false/u);
  assert.match(source, /isOpen: isInvitationEditorOpen,[\s\S]*onDismiss: closeInvitationEditor,[\s\S]*closeOnBackdrop: false/u);
});

test('settings inline editors keep saving and dirty guards on dismiss', () => {
  const source = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(source, /const isGarageEditorDirty = useMemo/u);
  assert.match(source, /저장하지 않은 지오펜스 변경 사항이 있습니다\. 닫으시겠습니까\?/u);
  assert.match(source, /저장하지 않은 차고지 변경 사항이 있습니다\. 닫으시겠습니까\?/u);
  assert.match(source, /저장하지 않은 초대 정보가 있습니다\. 닫으시겠습니까\?/u);
  assert.match(source, /disabled: isGeofenceSaving/u);
  assert.match(source, /disabled: isGarageSaving/u);
  assert.match(source, /disabled: isInvitationSaving/u);
});

test('settings garage editor close paths share one guarded close handler', () => {
  const source = readProjectFile('src/app/pages/Settings.tsx');

  assert.match(source, /const closeGarageEditor = useCallback/u);
  assert.match(source, /onClick=\{closeGarageEditor\}/u);
  assert.equal((source.match(/onClick=\{closeGarageEditor\}/gu) ?? []).length, 2);
});
