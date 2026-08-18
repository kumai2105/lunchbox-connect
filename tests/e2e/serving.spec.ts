import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

test.describe('classroom serving screen', () => {
  test.skip(!e2eReady, 'needs E2E_* env (live Supabase project)');

  test('teacher records an outcome which persists across reload', async ({ page }) => {
    const s = seeded();

    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);

    await expect(page.getByRole('heading', { name: /Today/ })).toBeVisible();

    const row = page.locator('tr', { hasText: 'E2E-101' });
    await expect(row).toContainText('Serving One');

    // deterministic across re-runs: first move to a known state, then to the value we assert
    await row.locator('.outcome').selectOption('refused');
    await expect(row.locator('.save-state')).toContainText('✓ saved');

    await row.locator('.outcome').selectOption('full');

    // optimistic save state settles to saved
    await expect(row.locator('.save-state')).toContainText('✓ saved');

    // persisted: reload and the select still shows Full
    await page.reload();
    const reloadedRow = page.locator('tr', { hasText: 'E2E-101' });
    await expect(reloadedRow.locator('.outcome')).toHaveValue('full');
    await expect(reloadedRow.locator('.save-state')).toContainText('✓ saved');
  });
});
