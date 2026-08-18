import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

test.describe('parent portal', () => {
  test.skip(!e2eReady, 'needs E2E_* env (live Supabase project)');

  test("parent sees their child, today's outcomes, published notes only, and the published menu with meal detail", async ({
    page,
  }) => {
    const s = seeded();

    await login(page, s.parentEmail);
    await expect(page).toHaveURL(/\/parent/);

    // child card + today's meal results (docs/13 Decision 032 — human-readable
    // consumption labels, e.g. 100% -> "Ate all", 0% -> "Did not eat")
    await expect(page.locator('.kid-card', { hasText: 'Portal Kid' })).toBeVisible();
    await expect(page.locator('.kid-card', { hasText: 'Portal Kid' })).toContainText(
      'Breakfast — Ate all',
    );

    // the published note is visible; the draft note is NOT (AT-043)
    await expect(page.locator('.kid-card')).toContainText('E2E published note');
    await expect(page.locator('.kid-card')).not.toContainText('E2E draft');

    await expect(page.locator('.kid-card')).toContainText('Lunch — Did not eat');

    // menu: published dishes only, with portion/ingredient/allergen detail
    await expect(page.getByText('E2E overnight oats')).toBeVisible();
    await expect(page.getByText('oats, banana, milk')).toBeVisible();
    await expect(page.getByText(/allergens: Gluten, Dairy/)).toBeVisible();
    await expect(page.getByText('UNPUBLISHED-E2E secret')).toHaveCount(0);
  });
});
