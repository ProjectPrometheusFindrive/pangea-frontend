import { expect, test } from '@playwright/test';
import { installApiMocks, fulfillSuccess, type ApiMockHandler } from './helpers/apiMock';
import { seedAuthSession } from './helpers/session';

const policy = { minimumDistanceKm: 300, settlementDelayMinutes: 5, revision: 1, formulaVersion: 'pangea-contract-v1' };
const metric = { distanceKm: 300, drivingSeconds: 36000, speedingSeconds: 720, speedingPercent: 2, counts: { acceleration: 3, braking: 1, cornering: 2, speeding: 1 }, components: { acceleration: 83.9, braking: 94.6, cornering: 89.3, speeding: 80 } };
const item = { contractId: 'R1', representativeName: '대표 계약자', vehicleNumber: '12가3456', status: 'final', score: 85.6, metrics: metric, policy };
const record = { key: 'device:ExceptionEvent:event1', category: 'acceleration', start: '2026-10-29T01:00:00Z', stop: '2026-10-29T01:00:01Z', excluded: false };
const detail = { ...item, startedAt: '2026-10-29T00:00:00Z', returnedAt: '2026-10-29T12:00:00Z', events: [record], trips: [], warnings: [], monthly: [{ ...metric, month: '2026-10', score: 85.6 }], history: [] };
const base: Record<string, ApiMockHandler> = {
  'GET /api/v2/notifications': async ({ route }) => fulfillSuccess(route, { items: [], totalCount: 0 }),
  'GET /api/v2/notifications/summary': async ({ route }) => fulfillSuccess(route, { unreadCount: 0 }),
  'GET /api/v2/safety/settings': async ({ route }) => fulfillSuccess(route, policy),
  'GET /api/v2/safety/contracts': async ({ route }) => fulfillSuccess(route, { items: [item, { ...item, contractId: 'R2', status: 'insufficient_distance', score: null, metrics: { ...metric, distanceKm: 180 } }], hasMore: false }),
  'GET /api/v2/safety/contracts/R1': async ({ route }) => fulfillSuccess(route, detail),
};

test('admin sees contract scores, adjusts future minimum and excludes a false event with a reason', async ({ page }) => {
  let settingBody: unknown;
  let exclusionBody: unknown;
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, { user: { role: 'admin' }, handlers: { ...base,
    'PATCH /api/v2/safety/settings': async ({ route, request }) => { settingBody = request.postDataJSON(); await fulfillSuccess(route, { ...policy, minimumDistanceKm: 500, revision: 2 }); },
    'PATCH /api/v2/safety/contracts/R1/exclusions': async ({ route, request }) => {
      exclusionBody = request.postDataJSON();
      await fulfillSuccess(route, { ...detail, score: 86.7, events: [{ ...record, excluded: true, exclusionReason: '오탐 확인' }] });
    },
  } });
  await page.goto('/contract-safety');
  await expect(page.getByRole('heading', { name: '계약 안전운전점수' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'R1' })).toContainText('85.6점');
  await expect(page.getByRole('row').filter({ hasText: 'R2' })).toContainText('평가 거리 부족');
  await page.getByLabel('최소 주행거리 (km)', { exact: true }).fill('500');
  await page.getByRole('button', { name: '설정 저장' }).click();
  await expect(page.getByRole('status')).toContainText('새로 생성하는 계약');
  expect(settingBody).toEqual({ minimumDistanceKm: 500, revision: 1 });
  await page.getByRole('row').filter({ hasText: 'R1' }).getByRole('button', { name: '상세 보기' }).click();
  const region = page.getByRole('region', { name: '계약 평가 상세' });
  await expect(region).toContainText('기준 300km');
  await region.getByRole('button', { name: '평가 제외', exact: true }).click();
  await expect(page.getByRole('button', { name: '사유 저장 및 재계산' })).toBeDisabled();
  await page.getByLabel('조정 사유', { exact: true }).fill('오탐 확인');
  await page.getByRole('button', { name: '사유 저장 및 재계산' }).click();
  await expect(region).toContainText('86.7점');
  await expect(region).toContainText('오탐 확인');
  expect(exclusionBody).toEqual({ recordKey: record.key, excluded: true, reason: '오탐 확인' });
});

test('member has read-only scoring and receives no administrative controls', async ({ page }) => {
  await seedAuthSession(page, 'member');
  await installApiMocks(page, { user: { role: 'member' }, handlers: base });
  await page.goto('/contract-safety');
  await expect(page.getByRole('row').filter({ hasText: 'R1' })).toContainText('85.6점');
  await expect(page.getByLabel('최소 주행거리 (km)', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '설정 저장' })).toHaveCount(0);
  await page.getByRole('row').filter({ hasText: 'R1' }).getByRole('button', { name: '상세 보기' }).click();
  await expect(page.getByRole('region', { name: '계약 평가 상세' })).toBeVisible();
  await expect(page.getByRole('button', { name: '평가 제외', exact: true })).toHaveCount(0);
});

test('super admin selects company by name and sends the company scope', async ({ page }) => {
  const scopes: (string | null)[] = [];
  await seedAuthSession(page, 'super_admin', { companyId: '' });
  await installApiMocks(page, { user: { role: 'super_admin', companyId: '' }, handlers: { ...base,
    'GET /api/v2/admin/geotab/tenants': async ({ route }) => fulfillSuccess(route, { items: [{ companyId: 'A', name: '테스트회사' }] }),
    'GET /api/v2/safety/contracts': async ({ route, request }) => { scopes.push(new URL(request.url()).searchParams.get('companyId')); await fulfillSuccess(route, { items: [item], hasMore: false }); },
  } });
  await page.goto('/contract-safety');
  await expect(page.getByText('평가할 회사를 선택해 주세요.')).toBeVisible();
  await page.getByLabel('회사 선택', { exact: true }).selectOption({ label: '테스트회사' });
  await expect(page.getByRole('row').filter({ hasText: 'R1' })).toContainText('85.6점');
  expect(scopes).toEqual(['A']);
});

test('generated demo aggregates show real formula scores and explicit demo detail', async ({ page }) => {
  await seedAuthSession(page, 'admin');
  const demoItem = { ...item, isDemo: true, demoScenarioLabel: '기본 산식 예시' };
  await installApiMocks(page, { user: { role: 'admin' }, handlers: { ...base,
    'GET /api/v2/safety/contracts': async ({ route }) => fulfillSuccess(route, { items: [demoItem], hasMore: false }),
    'GET /api/v2/safety/contracts/R1': async ({ route }) => fulfillSuccess(route, { ...detail, ...demoItem, events: [], trips: [] }),
  } });
  await page.goto('/contract-safety');
  await expect(page.getByRole('note')).toContainText('데모용 안전운전 데이터');
  const row = page.getByRole('row').filter({ hasText: 'R1' });
  await expect(row).toContainText('85.6점');
  await expect(row).toContainText('데모 · 기본 산식 예시');
  await row.getByRole('button', { name: '상세 보기' }).click();
  const region = page.getByRole('region', { name: '계약 평가 상세' });
  await expect(region).toContainText('집계형 데모 예시');
  await expect(region).toContainText('개별 운행·이벤트 기록은 생성하지 않습니다');
  await expect(region).toContainText('3회');
  await expect(region.getByRole('button', { name: '평가 제외', exact: true })).toHaveCount(0);
});

test('right-side detail preserves global filters, pagination, scroll and trigger focus', async ({ page }) => {
  const calls: URL[] = [];
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, { user: { role: 'admin' }, handlers: { ...base,
    'GET /api/v2/safety/contracts': async ({ route, request }) => {
      const url = new URL(request.url()); calls.push(url);
      const second = url.searchParams.get('offset') === '20';
      await fulfillSuccess(route, { items: [{ ...item, contractId: second ? 'R21' : 'R1' }], hasMore: !second, totalCount: 21, unfilteredCount: 45 });
    },
    'GET /api/v2/safety/contracts/R21': async ({ route }) => fulfillSuccess(route, { ...detail, contractId: 'R21' }),
  } });
  await page.goto('/contract-safety?minDistanceKm=300&sort=score_desc');
  await page.getByRole('button', { name: '다음', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'R21' });
  await expect(row).toBeVisible();
  const count = calls.length;
  const scroll = await page.getByRole('main').evaluate(e => e.scrollTop);
  const trigger = row.getByRole('button', { name: '상세 보기' });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: '계약 안전운전 상세' });
  await expect(panel.getByRole('region', { name: '계약 평가 상세' })).toContainText('85.6점');
  await expect(panel).toHaveCSS('right', '0px');
  await expect.poll(async () => (await panel.boundingBox())?.x).toBe(page.viewportSize()!.width - (await panel.boundingBox())!.width);
  await page.screenshot({ path: '/tmp/pangea-safety-drawer-local.png', fullPage: true });
  const box = await panel.boundingBox();
  expect(box?.y).toBe(0); expect(box!.width).toBeLessThan(page.viewportSize()!.width);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.getByRole('main').evaluate(e => e.scrollTop)).toBe(scroll);
  expect(calls.length).toBe(count);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('score_desc');
  expect(new URL(page.url()).searchParams.get('minDistanceKm')).toBe('300');
  expect(calls.at(-1)?.searchParams.get('offset')).toBe('20');
});

test('time/distance filters validate ranges, send global query and reset', async ({ page }) => {
  const calls: URL[] = [];
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, { user: { role: 'admin' }, handlers: { ...base,
    'GET /api/v2/safety/contracts': async ({ route, request }) => {
      const url = new URL(request.url()); calls.push(url);
      await fulfillSuccess(route, { items: [item], totalCount: 1, unfilteredCount: 45, hasMore: false });
    },
  } });
  await page.goto('/contract-safety');
  await expect(page.getByRole('row').filter({ hasText: 'R1' })).toBeVisible();
  await page.getByLabel('최소 주행거리 필터 (km)', { exact: true }).fill('900');
  await page.getByLabel('최대 주행거리 필터 (km)', { exact: true }).fill('300');
  const before = calls.length;
  await page.getByRole('button', { name: '필터 적용', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('최대값');
  expect(calls.length).toBe(before);
  await page.getByLabel('최소 주행거리 필터 (km)', { exact: true }).fill('300');
  await page.getByLabel('최대 주행거리 필터 (km)', { exact: true }).fill('900');
  await page.getByLabel('최소 주행시간 (시간)', { exact: true }).fill('2.5');
  await page.getByLabel('최대 주행시간 (시간)', { exact: true }).fill('12');
  await page.getByLabel('평가 기간 시작일', { exact: true }).fill('2026-10-01');
  await page.getByLabel('평가 기간 종료일', { exact: true }).fill('2026-11-02');
  await page.getByLabel('평가 상태', { exact: true }).selectOption('final');
  await page.getByRole('button', { name: '필터 적용', exact: true }).click();
  await expect(page.getByText('조회 1건 / 전체 45건', { exact: true })).toBeVisible();
  await page.getByLabel('점수 정렬', { exact: true }).selectOption('score_asc');
  await expect.poll(() => calls.at(-1)?.searchParams.get('sort')).toBe('score_asc');
  for (const [key, value] of Object.entries({ minDistanceKm: '300', maxDistanceKm: '900', minDrivingHours: '2.5', maxDrivingHours: '12', fromDate: '2026-10-01', toDate: '2026-11-02', status: 'final', offset: '0' })) expect(calls.at(-1)?.searchParams.get(key)).toBe(value);
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await expect(page.getByLabel('최소 주행거리 필터 (km)', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('점수 정렬', { exact: true })).toHaveValue('newest');
});

test('mobile drawer uses full width and reports inaccessible deep-link target inside the panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuthSession(page, 'admin');
  await installApiMocks(page, { user: { role: 'admin' }, handlers: { ...base,
    'GET /api/v2/safety/contracts/missing': async ({ route }) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ status: 'error', error: { code: 'NOT_FOUND', message: '계약을 찾을 수 없습니다.' } }) }),
  } });
  await page.goto('/contract-safety?contractId=missing');
  const panel = page.getByRole('dialog', { name: '계약 안전운전 상세' });
  await expect(panel.getByRole('alert')).toContainText('계약을 찾을 수 없습니다.');
  await expect.poll(async () => (await panel.boundingBox())?.x).toBe(0);
  const box = await panel.boundingBox();
  expect(box?.width).toBe(390);
  await panel.getByRole('button', { name: '상세 닫기', exact: true }).click();
  await expect(panel).toBeHidden();
});
