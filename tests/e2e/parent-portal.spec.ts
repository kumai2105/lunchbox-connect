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

    // child card + today's outcomes
    await expect(page.locator('.kid-card', { hasText: 'Portal Kid' })).toBeVisible();
    await expect(page.locator('.kid-card', { hasText: 'Portal Kid' })).toContainText(
      'Breakfast — full',
    );

    // the published note is visible; the draft note is NOT (AT-043)
    await expect(page.locator('.kid-card')).toContainText('E2E published note');
    await expect(page.locator('.kid-card')).not.toContainText('E2E draft');

    await expect(page.locator('.kid-card')).toContainText('Lunch — refused');

    // menu: published dishes only, with portion/ingredient/allergen detail
    await expect(page.getByText('E2E overnight oats')).toBeVisible();
    await expect(page.getByText('oats, banana, milk')).toBeVisible();
    await expect(page.getByText(/allergens: Gluten, Dairy/)).toBeVisible();
    await expect(page.getByText('UNPUBLISHED-E2E secret')).toHaveCount(0);
  });
});
