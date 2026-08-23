import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

test.describe('parent portal', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

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

/**
 * Child switching must never show one child's data under another's name.
 *
 * The shell derives readiness from `loadedChildId === selectedChildId`, so the
 * immediate selection render — before any effect runs — shows the spinner
 * rather than the previous child's records. The invariant itself is unit-tested
 * in src/pages/parent/shared.test.ts; this drives the real UI.
 */
test.describe('Parent child switching', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test("switching children never paints the previous child's data", async ({ page }) => {
    const s = seeded();
    await login(page, s.parentEmail);
    await expect(page).toHaveURL(/\/parent/);

    // The fixture links TWO children to this Parent with deliberately opposite
    // outcomes, so there is no reason to skip and no ambiguity about whose data
    // is on screen. (This test used to skip when fewer than two were linked —
    // which was always — so it proved nothing.)
    const switcher = page.locator('.child-switch button');
    await expect(switcher).toHaveCount(2);

    // Child A: ate everything at breakfast. Child B: refused it.
    await expect(page.locator('.parent-child-name')).toContainText('Portal');
    await expect(page.getByText('Ate all').first()).toBeVisible();

    await switcher.nth(1).click();

    // The name and the data must change TOGETHER. Child B's screen must never
    // show child A's result, not even for one render.
    await expect(page.locator('.parent-child-name')).toContainText('Second');
    await expect(page.getByText('Refused').first()).toBeVisible();
    await expect(page.getByText('Ate all')).toHaveCount(0);

    // ...and back again, with A's data restored and B's gone.
    await switcher.nth(0).click();
    await expect(page.locator('.parent-child-name')).toContainText('Portal');
    await expect(page.getByText('Ate all').first()).toBeVisible();
  });

  test('a delayed response for the previous child cannot overwrite the current one', async ({
    page,
  }) => {
    const s = seeded();
    await login(page, s.parentEmail);
    const switcher = page.locator('.child-switch button');
    await expect(switcher).toHaveCount(2);

    // Delay every serving_records read so child A's response is still in flight
    // when child B is selected. The request guard must discard it.
    await page.route('**/rest/v1/serving_records*', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });

    await switcher.nth(1).click(); // B, while A's slow read is outstanding
    await page.waitForTimeout(2500); // long enough for A's response to land

    await expect(page.locator('.parent-child-name')).toContainText('Second');
    await expect(page.getByText('Ate all')).toHaveCount(0);
  });
});
