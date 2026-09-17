import { expect, test } from '@playwright/test';

for (const timezoneId of ['UTC', 'America/Los_Angeles']) {
  test(`KST date utilities are stable in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    await page.goto('/login');
    const result = await page.evaluate(async () => {
      const dateTime = await import('/src/app/utils/dateTimeFormat.ts');
      const dateInput = await import('/src/app/utils/dateInputValue.ts');
      return {
        zoned: dateTime.formatDateTimeKst('2026-09-15T15:30:00Z'),
        naive: dateTime.formatDateTimeKst('2026-09-16T00:30'),
        timestampDate: dateInput.toDateInputValue('2026-09-15T15:30:00Z'),
        dateOnly: dateInput.toDateInputValue('2026-09-15'),
      };
    });
    expect(result).toEqual({
      zoned: '2026-09-16 00:30',
      naive: '2026-09-16 00:30',
      timestampDate: '2026-09-16',
      dateOnly: '2026-09-15',
    });
    await context.close();
  });
}
