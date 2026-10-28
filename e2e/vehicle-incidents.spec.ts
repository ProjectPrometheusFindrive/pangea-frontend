import { expect, test } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

const faultDetails = {
  code: '290', diagnosticType: 'GoFault', state: 'Active', severity: 'CheckAtNextHalt',
  occurredAt: '2026-10-27T04:19:04Z', name: 'Low voltage power supply and device restarted',
  effectOnComponent: 'Brown-out reset detected.', recommendation: 'Check voltage data in MyGeotab Measurements. Check the installation.',
};
const fault = {
  id: 'GEOTAB-ACTION:power', companyId: 'company-001', category: '차량이상', type: '차량이상',
  subCategory: '차량 이상', issueCode: 'vehicle.malfunction', reasonType: 'vehicle_fault',
  title: '차량 이상', vehicleNumber: '282누7485', geotabVehicleId: 'VIN-POWER', customerName: '-',
  status: 'open', statusCode: 'open', severity: 'medium', createdAt: '2026-10-27T04:25:06Z',
  faultDetails, // The production v2 action API omits notificationType.

};
const asset = { id: 'VIN-POWER', vin: 'VIN-POWER', vehicleNumber: '282누7485', plate: '282누7485', model: '아반떼', status: 'Available', hasDevice: true, version: 1 };

test('fault evidence, asset navigation, newest-first incident cards and return to exact completed issue', async ({ page }) => {
  await seedAuthSession(page, 'admin');
  const completed = { ...fault, id: 'GEOTAB-ACTION:old', category: '도난 의심', type: '도난 의심', notificationType: 'theft-suspicion', status: 'done', statusCode: 'done', faultDetails: undefined };
  let historyFailed = true;
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [fault], totalCount: 1 }),
    'GET /api/v2/action-items/GEOTAB-ACTION%3Apower': async ({ route }) => fulfillSuccess(route, fault),
    'GET /api/v2/action-items/GEOTAB-ACTION%3Aold': async ({ route }) => fulfillSuccess(route, completed),
    'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [asset], total: 1 }),
    'GET /api/v2/assets/VIN-POWER': async ({ route }) => fulfillSuccess(route, asset),
    'GET /api/v2/assets/VIN-POWER/activities': async ({ route }) => fulfillSuccess(route, { items: [], total: 0 }),
    'GET /api/v2/assets/VIN-POWER/incidents': async ({ route, request }) => {
      if (historyFailed) { historyFailed = false; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ status: 'error', error: { message: 'temporary failure' } }) }); return; }
      const older = new URL(request.url()).searchParams.get('page') === '2';
      await fulfillSuccess(route, { items: older ? [{ id: 'old', actionItemId: completed.id, type: 'theft_suspected', title: '도난 의심', status: 'completed', occurredAt: '2026-10-12T02:40:49Z', evidenceSummary: { geofenceName: '회사 시험 구역', thresholdMinutes: 5 } }] : [{ id: 'power', actionItemId: fault.id, title: '차량 이상', type: 'vehicle_fault', status: 'open', occurredAt: faultDetails.occurredAt, faultDetails }], total: 2 });
    },
  } });
  await page.goto('/action-required?actionItemId=GEOTAB-ACTION%3Apower');
  const evidence = page.getByRole('region', { name: '차량 이상 진단 정보' });
  await expect(evidence).toContainText('고장 코드');
  await expect(evidence).toContainText('290');
  await expect(evidence).toContainText('고장 내용');
  await expect(evidence).toContainText('점검 안내');
  await expect(evidence).toContainText('다음 정차 시 점검');
  await expect(evidence).toContainText('Check voltage data in device management system Measurements. Check the installation.');
  await expect(evidence).toContainText('단말기 진단');
  await expect(evidence).toContainText('단말기 원문');
  await expect(evidence).not.toContainText(/mygeotab|geotab|GoFault/i);
  await expect(evidence).toContainText('단말 공급 전압 저하');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(evidence).toBeVisible();
  expect(await evidence.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  const plateButton = page.getByRole('button', { name: '282누7485', exact: true });
  await plateButton.scrollIntoViewIfNeeded();
  const labelBounds = await page.getByText('차량번호', { exact: true }).last().boundingBox();
  const plateBounds = await plateButton.boundingBox();
  expect(labelBounds).not.toBeNull();
  expect(plateBounds).not.toBeNull();
  expect(plateBounds!.y).toBeGreaterThanOrEqual(labelBounds!.y + labelBounds!.height);
  await evidence.screenshot({ path: 'docs/screenshots/vehicle-fault-evidence.png' });
  await page.getByRole('button', { name: '282누7485', exact: true }).click();
  const modal = page.getByTestId('asset-detail-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: '차량 이상 히스토리' })).toHaveClass(/text-blue/);
  await expect(modal.getByRole('alert')).toContainText('불러오지 못했습니다');
  await modal.getByRole('button', { name: '다시 시도', exact: true }).click();
  const history = modal.getByRole('region', { name: '차량 이상 사건 목록' });
  await expect(history.locator('article')).toHaveCount(1);
  await expect(history.locator('article').first()).toContainText('코드 290');
  await expect(modal.getByText('프리미엄으로 업그레이드')).toHaveCount(0);
  await expect(modal.getByText('차량 단말 연동')).toBeVisible();
  await history.getByRole('button', { name: '이전 사건 더 보기' }).click();
  await expect(history.locator('article')).toHaveCount(2);
  await expect(history.locator('article').first()).toContainText('차량 이상');
  await expect(history.locator('article').last()).toContainText('회사 시험 구역');
  await expect(history.locator('article').last()).toContainText('완료');
  await page.screenshot({ path: 'docs/screenshots/vehicle-incident-history.png', fullPage: true });
  await history.locator('article').last().getByRole('link', { name: '이슈카드 보기' }).click();
  await expect(page).toHaveURL(/actionItemId=GEOTAB-ACTION%3Aold/);
  await expect(page.getByText('도난 의심 알림', { exact: true })).toBeVisible();
});

test('vehicle without a device retains installation prompt and empty history', async ({ page }) => {
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    'GET /api/v2/assets': async ({ route }) => fulfillSuccess(route, { items: [{ ...asset, hasDevice: false }], total: 1 }),
    'GET /api/v2/assets/VIN-POWER': async ({ route }) => fulfillSuccess(route, { ...asset, hasDevice: false }),
    'GET /api/v2/assets/VIN-POWER/activities': async ({ route }) => fulfillSuccess(route, { items: [], total: 0 }),
    'GET /api/v2/assets/VIN-POWER/incidents': async ({ route }) => fulfillSuccess(route, { items: [], total: 0 }),
  } });
  await page.goto('/assets?assetId=VIN-POWER');
  const modal = page.getByTestId('asset-detail-modal');
  await modal.getByRole('button', { name: '차량 이상 히스토리' }).click();
  await expect(modal.getByText('기록된 차량 이상 사건이 없습니다.')).toBeVisible();
  await expect(modal.getByRole('button', { name: '프리미엄으로 업그레이드' })).toBeVisible();
});

test('unfamiliar fault codes display provider text verbatim without alert-type metadata', async ({ page }) => {
  const name = 'Unfamiliar component fault: Provider-defined condition';
  const recommendation = 'Initial Checks: Inspect the connector.\nDiagnostic Procedures: Refer to the service manual.';
  const unknown = {
    ...fault, id: 'GEOTAB-ACTION:unknown', reasonType: 'provider_specific_fault', issueCode: 'provider.unclassified',
    faultDetails: { ...faultDetails, code: '98765', name, recommendation, effectOnComponent: 'Provider-defined effect.' },
  };
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, { user: { role: 'admin' }, handlers: {
    'GET /api/v2/action-items': async ({ route }) => fulfillSuccess(route, { items: [unknown], totalCount: 1 }),
    'GET /api/v2/action-items/GEOTAB-ACTION%3Aunknown': async ({ route }) => fulfillSuccess(route, unknown),
  } });
  await page.goto('/action-required?actionItemId=GEOTAB-ACTION%3Aunknown');
  const evidence = page.getByRole('region', { name: '차량 이상 진단 정보' });
  await expect(evidence).toContainText('고장 코드');
  await expect(evidence).toContainText('98765');
  await expect(evidence.getByText(name, { exact: true })).toBeVisible();
  expect(await evidence.locator('p').filter({ hasText: '고장 내용 (단말기 원문)' }).textContent()).toBe(`고장 내용 (단말기 원문)${name}`);
  const providerRecommendation = evidence.locator('p').filter({ hasText: '점검 안내 (단말기 원문)' });
  expect(await providerRecommendation.textContent()).toBe(`점검 안내 (단말기 원문)${recommendation}`);
  await expect(evidence).not.toContainText('단말기 관리 시스템에서 발생 시점의 전압 기록 확인');
  await expect(page.getByText('차량 이상 알림', { exact: true })).toHaveCount(0);
});
