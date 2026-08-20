import { expect, test } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

/**
 * Nine approved role domains (docs/02). Every role signs in and lands on its
 * first nav page with the correct role chip.
 */
test.describe('login matrix — nine roles', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  const cases = [
    {
      role: 'super_admin',
      key: 'superAdminEmail',
      href: '/dashboard',
      nav: /Command center|Dashboard/,
    },
    { role: 'school_admin', key: 'schoolAdminEmail', href: '/dashboard', nav: /Dashboard/ },
    { role: 'operations_manager', key: 'operationsEmail', href: '/ops', nav: /Ops/ },
    { role: 'finance_owner', key: 'financeEmail', href: '/reports', nav: /Reports/ },
    { role: 'viewer', key: 'viewerEmail', href: '/reports', nav: /Reports/ },
    { role: 'parent', key: 'parentEmail', href: '/parent', nav: /My child/ },
    { role: 'classroom_staff', key: 'classroomEmail', href: '/today', nav: /Today/ },
    { role: 'kitchen', key: 'kitchenEmail', href: '/kitchen', nav: /Production/ },
    { role: 'driver', key: 'driverEmail', href: '/deliveries', nav: /My deliveries/ },
  ];

  for (const c of cases) {
    test(`${c.role} signs in and lands on their first page`, async ({ page }) => {
      await login(page, seeded()[c.key]);
      await expect(page).toHaveURL(new RegExp(`^${c.href}`));
      await expect(page.locator('.side-foot .u-role')).toHaveText(new RegExp(c.role, 'i'));
      await expect(page.locator('.nav a.active')).toHaveText(c.nav);
    });
  }

  test('role selector in account creation offers exactly the nine domains', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto('/users');
    await page
      .getByRole('button', { name: /Create account/ })
      .first()
      .click();

    const modal = page.locator('.modal').last();
    const roleOptions = await modal
      .getByText('Role', { exact: true })
      .locator('..')
      .locator('select option')
      .allTextContents();

    expect(roleOptions).toEqual([
      'SUPER_ADMIN',
      'SCHOOL_ADMIN',
      'OPERATIONS_MANAGER',
      'FINANCE_OWNER',
      'VIEWER',
      'PARENT',
      'CLASSROOM_STAFF',
      'KITCHEN',
      'DRIVER',
    ]);
  });
});
