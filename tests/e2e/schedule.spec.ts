import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

/**
 * Founder-approved addition: the Nursery/School Admin's READ-ONLY view of what
 * is published for their own institution.
 *
 * The database boundary is proven in tests/sql/verify_rls_cross_portal.sql
 * (own institution only, drafts invisible, raw planning closed). These specs
 * cover the surface: the page is reachable, shows the published meal, and
 * offers no authoring control anywhere.
 */
test.describe('Institution published schedule (read-only)', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('a Nursery Admin sees their published menu for today and this week', async ({ page }) => {
    const s = seeded();
    await login(page, s.schoolAdminEmail);

    await page.goto('/schedule');
    await expect(page).toHaveURL(/\/schedule/);
    await expect(page.getByText('Published menu')).toBeVisible();

    // The fixture publishes breakfast + lunch for TODAY at this institution.
    await expect(page.getByText('E2E overnight oats').first()).toBeVisible();
    await expect(page.getByText('E2E wrap').first()).toBeVisible();

    // The draft service seeded for tomorrow must never appear.
    await expect(page.getByText('UNPUBLISHED-E2E secret')).toHaveCount(0);
  });

  test('the schedule offers no authoring control at all', async ({ page }) => {
    const s = seeded();
    await login(page, s.schoolAdminEmail);
    await page.goto('/schedule');
    await expect(page.getByText('Published menu')).toBeVisible();

    // Menu authorship stays with the Super Admin: nothing here creates, edits
    // or publishes, and the Menu Builder route remains closed to this role.
    for (const label of [/publish/i, /save/i, /edit/i, /\+ add/i, /delete/i]) {
      await expect(page.getByRole('button', { name: label })).toHaveCount(0);
    }
    await page.goto('/menu-builder');
    await expect(page).not.toHaveURL(/menu-builder/);
  });

  test('no other role can reach the institution schedule', async ({ page }) => {
    const s = seeded();
    await login(page, s.classroomEmail);
    await page.goto('/schedule');
    await expect(page).not.toHaveURL(/\/schedule/);
  });
});
