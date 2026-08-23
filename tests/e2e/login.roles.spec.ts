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
    // The parent shell's own bottom-nav label for its first tab.
    { role: 'parent', key: 'parentEmail', href: '/parent', nav: /Home/ },
    { role: 'classroom_staff', key: 'classroomEmail', href: '/today', nav: /Today/ },
    { role: 'kitchen', key: 'kitchenEmail', href: '/kitchen', nav: /Production/ },
    { role: 'driver', key: 'driverEmail', href: '/deliveries', nav: /My deliveries/ },
  ];

  for (const c of cases) {
    test(`${c.role} signs in and lands on their first page`, async ({ page }) => {
      await login(page, seeded()[c.key]);
      // Assert on the PATHNAME. toHaveURL() matches a RegExp against the whole
      // URL, so `^/dashboard` could never match "http://127.0.0.1:4173/dashboard"
      // — the same trap that made login() wait out its full timeout on every
      // role. A predicate over url.pathname keeps the anchor honest, and still
      // fails if a role lands on somebody else's first page.
      await expect
        .poll(() => new URL(page.url()).pathname, {
          message: `${c.role} should land on ${c.href}`,
        })
        .toMatch(new RegExp(`^${c.href}`));

      if (c.role === 'parent') {
        // The Parent portal is a SEPARATE shell by design — ParentShell says so
        // outright: "mobile-first: bottom navigation, no administrative
        // chrome". It has no sidebar, so `.side-foot .u-role` and `.nav a.active`
        // do not exist there and never could. Asserting them for this role only
        // encoded an assumption that all nine roles share the admin frame.
        // Assert the parent shell's own equivalent instead.
        await expect(page.locator('.parent-nav')).toBeVisible();
        await expect(page.locator('.parent-nav-item.active')).toHaveText(c.nav);
      } else {
        await expect(page.locator('.side-foot .u-role')).toHaveText(new RegExp(c.role, 'i'));
        await expect(page.locator('.nav a.active')).toHaveText(c.nav);
      }
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

    // Readable labels, not the database's enum values — this list is read by a
    // person choosing a role, and the stored value is unchanged behind it.
    expect(roleOptions).toEqual([
      'Super Admin',
      'Institution Admin',
      'Operations Manager',
      'Finance / Owner',
      'Viewer',
      'Parent',
      'Classroom staff',
      'Kitchen',
      'Driver',
    ]);
  });
});
