import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('device installation page supports scheduled task selection with auto-fill fallback to manual entry', async () => {
  const pageSource = await readFile(path.join(projectRoot, 'src/app/pages/DeviceInstallation.tsx'), 'utf8');

  assert.match(pageSource, /const \[scheduledTaskOptions,\s*setScheduledTaskOptions\] = useState<DeviceInstallationItem\[\]>\(\[\]\)/u);
  assert.match(pageSource, /const \[selectedTaskId,\s*setSelectedTaskId\] = useState<string \| null>\(null\)/u);
  assert.match(pageSource, /const applyScheduledTaskSelection = useCallback\(\(installation: DeviceInstallationItem\) =>/u);
  assert.match(pageSource, /getDeviceInstallationList\(\{\s*page:\s*1,\s*pageSize:\s*5,\s*status:\s*'scheduled'/u);
  assert.match(pageSource, /setSelectedTaskId\(task\.id\)/u);
  assert.match(pageSource, /setVin\(task\.vin\)/u);
  assert.match(pageSource, /data-testid=\{`device-installation-task-select-\$\{installation\.id\}`\}/u);
  assert.match(pageSource, /setSelectedTaskId\(null\)/u);
  assert.match(pageSource, /수기 입력으로 계속/u);
});
