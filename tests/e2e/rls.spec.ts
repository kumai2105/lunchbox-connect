import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

/**
 * Live-boundary acceptance (AT-030 / AT-031). The route gate is a convenience;
 * RLS is the real boundary and re-checks every read server-side. These drive
 * the seeded non-production project via the shared fixtures.
 */
test.describe('AT-030 / AT-031 — role isolation', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('parent cannot navigate to staff/admin pages', async ({ page }) => {
    const s = seeded();
    await login(page, s.parentEmail);
    await expect(page).toHaveURL(/\/parent/);

    // A parent is bounced off every admin route back into their portal.
    await page.goto('/users');
    await expect(page).toHaveURL(/\/parent/);
    await page.goto('/status');
    await expect(page).toHaveURL(/\/parent/);
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/parent/);
  });

  test('super admin can open the command center and users', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Institutions — serving today')).toBeVisible();
    await page.goto('/users');
    // Level 1: the Layout repeats every page title as a topbar <h2>, so a bare
    // text lookup matches both it and the page's own <h1> and fails strict mode.
    await expect(page.getByRole('heading', { level: 1, name: 'Users & roles' })).toBeVisible();
  });

  test('a Nursery Admin can reach the institution-scoped Staff screen (§4)', async ({ page }) => {
    const s = seeded();
    await login(page, s.schoolAdminEmail);
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/staff/);
    // Provisioning is available to the Nursery Admin for their own institution.
    await expect(page.getByRole('button', { name: /Provision classroom staff/ })).toBeVisible();
  });

  test('serving screen opens on a class picker for the staff institution', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto('/today');
    // The placeholder is an <option> inside a closed <select>. Playwright does
    // not consider options visible — they have no layout box until the select
    // is opened — so toBeVisible() on it could never pass. Assert the picker
    // itself is on screen and that it leads with the placeholder, which is what
    // "opens on a class picker" actually means.
    const picker = page.getByRole('combobox').first();
    await expect(picker).toBeVisible();
    await expect(picker.locator('option').first()).toHaveText('Select a class…');
  });
});
