import { test, expect } from '@playwright/test';

test('login provides email guidance and recovery navigation', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('아이디(가입 이메일)')).toBeVisible();
  await page.getByRole('link', { name: '가입 이메일을 잊으셨나요?' }).click();
  await expect(page.getByText('Pangea 아이디는 가입할 때 사용한 이메일입니다.')).toBeVisible();
});

test('request shows generic message and cooldown', async ({ page }) => {
  await page.route('**/api/v2/auth/forgot-password', route => route.fulfill({ json: { status: 'success', data: { message: '입력하신 정보와 일치하는 계정이 있으면 비밀번호 재설정 메일을 보내드립니다.' } } }));
  await page.goto('/forgot-password');
  await page.getByLabel('가입 이메일', { exact: true }).fill('owner@example.com');
  await page.getByRole('button', { name: '재설정 메일 보내기' }).click();
  await expect(page.getByRole('status')).toContainText('일치하는 계정이 있으면');
  await expect(page.getByRole('button')).toBeDisabled();
});

test('reset clears URL token, validates confirmation and handles expired links', async ({ page }) => {
  await page.route('**/api/v2/auth/reset-password', route => route.fulfill({ status: 400, json: { status: 'error', error: { type: 'INVALID_TOKEN', message: '유효하지 않거나 만료된 링크입니다.' } } }));
  await page.goto('/reset-password#token=test-token');
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel('새 비밀번호', { exact: true }).fill('Password123');
  await page.getByLabel('새 비밀번호 확인').fill('Mismatch123');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(page.getByRole('alert')).toHaveText('비밀번호가 일치하지 않습니다.');
  await page.getByLabel('새 비밀번호 확인').fill('Password123');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(page.getByRole('alert')).toContainText('만료된 링크');
});

test('missing link can request another one', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByRole('alert')).toContainText('재설정 링크가 없습니다');
  await page.getByRole('link', { name: '새 링크 요청' }).click();
  await expect(page.getByRole('heading', { name: '비밀번호 재설정' })).toBeVisible();
});
