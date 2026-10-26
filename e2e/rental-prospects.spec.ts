import { expect, test } from '@playwright/test';
import { fulfillSuccess, installApiMocks } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

const office = {
  id: 'office-1', name: '경기 영업 테스트 렌터카', officeType: '주사업장', address: '경기도 수원시 테스트로 1',
  phone: '031-123-4567', latitude: 37.28, longitude: 127.01, totalVehicles: 100,
  passengerVehicles: 80, vans: 20, electricPassengerVehicles: 5, electricVans: 0,
  referenceDate: '2026-09-01', provider: '경기도 수원시', memo: '', excluded: false,
};

test('map hover, selection, memo persistence, exclusion filters, viewport list and zoom', async ({ page }) => {
  let saved = { ...office };
  await seedAuthSession(page, 'super_admin');
  await installApiMocks(page, { user: { role: 'super_admin' }, handlers: {
    'GET /api/v2/admin/rental-prospects': async ({ route }) => fulfillSuccess(route, {
      items: [saved, { ...office, id: 'office-2', name: '북부 렌터카', latitude: 38.1, longitude: 127.2, totalVehicles: 4 }],
      sourceUrl: 'https://www.data.go.kr/data/15025689/standard.do', fetchedAt: '2026-10-26',
    }),
    'PATCH /api/v2/admin/rental-prospects/office-1': async ({ route, request }) => {
      saved = { ...saved, ...request.postDataJSON(), updatedAt: new Date().toISOString() };
      await fulfillSuccess(route, saved);
    },
  }});
  await page.goto('/admin/rental-prospects');
  await expect(page.getByRole('link', { name: '렌터카 영업 지도' })).toBeVisible();
  await expect(page.locator('.leaflet-interactive')).toHaveCount(2);
  const radii = await page.locator('.leaflet-interactive').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().width));
  expect(radii[0]).toBeGreaterThan(radii[1]);
  await page.locator('.leaflet-interactive').first().hover();
  await expect(page.locator('.leaflet-tooltip')).toContainText('승용 80대');
  await page.locator('.leaflet-interactive').first().click();
  await page.getByRole('textbox', { name: '영업 메모' }).fill('담당자 통화 완료. 다음 주 제안서 전달.');
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '저장하지 않은 메모' })).toBeVisible();
  await page.getByRole('button', { name: '계속 작성', exact: true }).click();
  await page.getByRole('button', { name: '메모 저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
  await page.reload();
  await page.getByRole('button').filter({ hasText: office.name }).click();
  await expect(page.getByRole('textbox', { name: '영업 메모' })).toHaveValue(saved.memo);
  await page.getByRole('checkbox', { name: '마케팅 대상에서 제외' }).click();
  await expect(page.getByRole('checkbox', { name: '마케팅 대상에서 제외' })).toBeChecked();
  await expect(page.locator('.leaflet-interactive')).toHaveCount(1);
  await page.getByLabel('마케팅 대상 필터').selectOption('excluded');
  await expect(page.locator('.leaflet-interactive')).toHaveCount(1);
  await page.getByLabel('마케팅 대상 필터').selectOption('all');
  await expect(page.locator('.leaflet-interactive')).toHaveCount(2);
  await page.getByLabel('업체 검색').fill('북부');
  await expect(page.locator('.leaflet-interactive')).toHaveCount(1);
  await page.getByLabel('업체 검색').fill('');
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.waitForTimeout(300);
  }
  const map = page.getByLabel('경기도 렌터카 업체 지도');
  await map.focus();
  for (let i = 0; i < 12; i++) {
    await map.press('ArrowLeft');
    await page.waitForTimeout(300);
  }
  await expect(page.getByRole('heading', { name: '현재 지도 내 업체 · 0곳' })).toBeVisible();
});

for (const role of ['admin', 'member', 'installer'] as const) {
  test(`${role} cannot enter super admin map`, async ({ page }) => {
    let requested = false;
    await seedAuthSession(page, role);
    await installApiMocks(page, { user: { role }, handlers: {
      'GET /api/v2/admin/rental-prospects': async ({ route }) => { requested = true; await fulfillSuccess(route, { items: [] }); },
    }});
    await page.goto('/admin/rental-prospects');
    await expect(page).toHaveURL(/\/forbidden$/);
    expect(requested).toBe(false);
  });
}
