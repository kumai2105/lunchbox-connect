import { test, expect } from 'playwright/test';

/**
 * Live-boundary acceptance specs (runbook step 9).
 *
 * These require a real Supabase project, seeded users, and the frontend
 * running against it — set:
 *   PLAYWRIGHT_BASE_URL  (default http://localhost:5173)
 *   E2E_EMAIL_SUPER, E2E_PASSWORD_SUPER, E2E_EMAIL_PARENT, E2E_PASSWORD_PARENT
 * then `pnpm test:e2e`. Until then they are BLOCKED_BY_ENVIRONMENT and skip.
 */

const enabled = Boolean(process.env.E2E_EMAIL_SUPER && process.env.E2E_EMAIL_PARENT);
const describe = enabled ? test.describe : test.describe.skip;

describe('AT-030 / AT-031 — RLS isolation', () => {
  test('parent cannot navigate to staff pages', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', process.env.E2E_EMAIL_PARENT!);
    await page.fill('input[type=password]', process.env.E2E_PASSWORD_PARENT!);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/parent/);

    await page.goto('/users');
    await expect(page).toHaveURL(/\/parent/);
    await page.goto('/status');
    await expect(page).toHaveURL(/\/parent/);
  });

  test('super admin can open the command center', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', process.env.E2E_EMAIL_SUPER!);
    await page.fill('input[type=password]', process.env.E2E_PASSWORD_SUPER!);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Institutions — serving today')).toBeVisible();
    await page.goto('/users');
    await expect(page.getByText('Users & roles')).toBeVisible();
  });

  test('serving screen only exposes the staff member institution', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', process.env.E2E_EMAIL_SUPER!);
    await page.fill('input[type=password]', process.env.E2E_PASSWORD_SUPER!);
    await page.click('button[type=submit]');
    await page.goto('/today');
    await expect(page.getByText('Select a class…')).toBeVisible();
  });
});
