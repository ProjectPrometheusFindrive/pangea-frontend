import { expect, test } from '@playwright/test';

test('isolated real API login and contract score UI', async ({ page, baseURL }) => {
  test.skip(process.env.E2E_SAFETY_LIVE !== '1', 'Requires scripts/verify_contract_safety.py --serve and a local Vite API override');
  if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') throw new Error('Synthetic verification is localhost only');
  await page.goto('/login?returnUrl=%2Fcontract-safety');
  await page.getByLabel('아이디(가입 이메일)').fill('safety-local-admin');
  await page.getByLabel('비밀번호', { exact: true }).fill('local-safety-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '계약 안전운전점수' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'SAFETY-001' })).toContainText('85.6점');
  await page.getByRole('button', { name: '상세 보기' }).click();
  await expect(page.getByRole('region', { name: '계약 평가 상세' })).toContainText('85.6점 · 확정');
  await page.screenshot({ path: '/tmp/pangea-contract-safety-local.png', fullPage: true });
});
