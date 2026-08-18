import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

test.describe('classroom serving screen (docs/13 Decision 032 — fast tablet workflow)', () => {
  test.skip(!e2eReady, 'needs E2E_* env (live Supabase project)');

  test('teacher records a meal result which persists across reload', async ({ page }) => {
    const s = seeded();

    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);

    await expect(page.getByRole('heading', { name: /Today/ })).toBeVisible();

    // "Serving One" (E2E-101) is first in the assigned-class roster.
    await expect(page.locator('.focus-name')).toContainText('Serving One');

    // tap 75% eaten, then a behaviour — this auto-saves and advances to the
    // next unrecorded student (docs/13 Decision 032 §20 fast path).
    await page.getByRole('button', { name: '75% eaten' }).click();
    await page.getByRole('button', { name: 'Ate independently' }).click();

    // roster strip shows the completed badge for the student we just recorded
    const firstChip = page.locator('.roster-chip').first();
    await expect(firstChip.locator('.status-badge')).toHaveText('✅');

    // persisted: reload and jump back to that student via the roster strip
    await page.reload();
    await expect(page.locator('.roster-chip').first().locator('.status-badge')).toHaveText('✅');
    await page.locator('.roster-chip').first().click();
    await expect(page.locator('.plate-quarter.selected')).toContainText('75%');
  });

  test('low intake shows the exception-first reason selector', async ({ page }) => {
    const s = seeded();

    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);
    await expect(page.locator('.focus-name')).toContainText('Serving');

    // normal children never see a reason selector until intake is low
    await expect(page.locator('.chip-choice', { hasText: 'Not hungry' })).toHaveCount(0);

    await page.getByRole('button', { name: '0% eaten' }).click();
    await page.getByRole('button', { name: 'Refused' }).click();

    // now the low-intake reason selector appears (exception-first design)
    await expect(page.getByRole('button', { name: "Didn't like it" })).toBeVisible();
    await page.getByRole('button', { name: "Didn't like it" }).click();

    const firstChip = page.locator('.roster-chip').first();
    await expect(firstChip.locator('.status-badge')).toHaveText('🚫');
  });
});
