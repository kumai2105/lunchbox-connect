import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

test.describe('parent portal', () => {
  test.skip(!e2eReady, 'needs E2E_* env (live Supabase project)');

  test("parent sees their child's structured results, published notes only, and the published menu with meal detail", async ({
    page,
  }) => {
    const s = seeded();

    await login(page, s.parentEmail);
    await expect(page).toHaveURL(/\/parent/);

    // The hero names the child whose day this is.
    await expect(page.locator('.parent-child-name')).toContainText('Portal');

    // Today's meal cards derive from the same Classroom records the nurse
    // entered once (docs/13 Decision 032). Breakfast: 100% -> "Ate all",
    // recorded as "Ate independently"; the published dish name is shown.
    const breakfast = page.locator('.today-meal-card', { hasText: 'Breakfast' });
    await expect(breakfast).toContainText('E2E overnight oats');
    await expect(breakfast).toContainText('Ate all');
    await expect(breakfast).toContainText('Ate independently');

    // Lunch: 0% -> "Did not eat", refused, with a parent-safe reason (§3).
    const lunch = page.locator('.today-meal-card', { hasText: 'Lunch' });
    await expect(lunch).toContainText('Did not eat');
    await expect(lunch).toContainText('Refused');

    // Only the reviewed/published note is visible; the draft never is (AT-043).
    await expect(page.getByText('E2E published note')).toBeVisible();
    await expect(page.getByText('E2E draft')).toHaveCount(0);

    // Menu: published dishes only, with ingredient + allergen detail; the
    // unpublished draft service is invisible.
    await page.goto('/parent/menu');
    await expect(page.getByText('E2E overnight oats').first()).toBeVisible();
    await expect(page.getByText('oats, banana, milk').first()).toBeVisible();
    await expect(page.getByText('UNPUBLISHED-E2E secret')).toHaveCount(0);

    // Tapping a meal opens its detail (allergens are shown as pills).
    await page.getByText('E2E overnight oats').first().click();
    const modal = page.locator('.modal').last();
    await expect(modal).toContainText('Gluten');
    await expect(modal).toContainText('Dairy');
  });
});
