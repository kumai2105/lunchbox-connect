import { expect, test, type Page } from 'playwright/test';
import { e2eReady, login, seeded } from './fixtures';

/**
 * THE COMPLETE SESSION LIFECYCLE, FOR EVERY ACTIVE ROLE.
 *
 * The previous evidence proved a Log out control EXISTS for three of nine
 * roles, and proved the session actually ends for exactly one. Everything else
 * was inference from "they share the same shell" — which is the same reasoning
 * that missed the defect where `.side-foot button` was inside a `display:none`
 * rule and no staff role could sign out on a phone at all.
 *
 * Shared markup is not shared evidence. Every role below is signed in for real,
 * signed out for real, and then pushed at:
 *
 *   * the token store, because a Log out that leaves a session behind is not a
 *     log out — the next person on a shared classroom tablet inherits it;
 *   * a protected route, because the redirect is the actual security boundary;
 *   * a reload, because a client-side redirect that a refresh undoes is theatre;
 *   * the browser Back button, which is the one people actually press, and
 *     which restores a cached DOM without re-running the guard;
 *   * signing in again, because a log out that breaks the next login has just
 *     moved the problem.
 */

const DESKTOP = { width: 1280, height: 900 };
const TABLET = { width: 820, height: 1180 };
const MOBILE = { width: 390, height: 844 };

/** Every active role, with the shell it uses and the route that must be refused after sign-out. */
const ROLES = [
  { role: 'super_admin', key: 'superAdminEmail', shell: 'staff', protectedRoute: '/institutions' },
  { role: 'school_admin', key: 'schoolAdminEmail', shell: 'staff', protectedRoute: '/students' },
  { role: 'operations_manager', key: 'operationsEmail', shell: 'staff', protectedRoute: '/ops' },
  { role: 'finance_owner', key: 'financeEmail', shell: 'staff', protectedRoute: '/reports' },
  { role: 'viewer', key: 'viewerEmail', shell: 'staff', protectedRoute: '/reports' },
  { role: 'classroom_staff', key: 'classroomEmail', shell: 'staff', protectedRoute: '/today' },
  { role: 'kitchen', key: 'kitchenEmail', shell: 'staff', protectedRoute: '/kitchen' },
  { role: 'driver', key: 'driverEmail', shell: 'staff', protectedRoute: '/my-deliveries' },
  { role: 'parent', key: 'parentEmail', shell: 'parent', protectedRoute: '/parent/insights' },
] as const;

/**
 * Is a Supabase session still stored in this browser?
 *
 * supabase-js persists the session under a `sb-<ref>-auth-token` localStorage
 * key. Asserting on the store rather than on the UI is deliberate: a page can
 * render a logged-out shell while the token is still sitting there, and it is
 * the token, not the shell, that the next person inherits.
 */
async function storedSessionKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.includes('auth-token')) {
          const v = localStorage.getItem(k);
          // An empty or null entry is a cleared slot, not a live session.
          if (v && v !== 'null' && v.length > 2) keys.push(k);
        }
      }
    } catch {
      /* storage unavailable — reported as "none" rather than failing the probe */
    }
    return keys;
  });
}

/** Click the sign-out control for whichever shell this role uses. */
async function signOut(page: Page, shell: 'staff' | 'parent') {
  if (shell === 'parent') {
    await page.goto('/parent/profile');
    const btn = page.getByRole('button', { name: /sign out/i });
    await expect(btn, 'the Parent Sign out control is not reachable').toBeVisible();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    return;
  }
  const btn = page.getByRole('button', { name: /log out/i });
  await expect(btn, 'the Log out control is not reachable').toBeVisible();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}

/** The app is showing an unauthenticated state, whatever route we asked for. */
async function expectLoggedOut(page: Page, what: string) {
  await expect(page, `${what}: not on the login screen`).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(
    page.locator('input[autocomplete="email"]'),
    `${what}: the login form is not actually rendered`,
  ).toBeVisible();
}

test.describe('session lifecycle — every active role signs out completely', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  // Nine roles, each doing a full sign-in / sign-out / re-sign-in cycle plus
  // four post-logout probes. Generous, and stated rather than guessed at.
  test.setTimeout(120_000);

  for (const r of ROLES) {
    test(`${r.role}: log out ends the session and nothing restores it`, async ({ page }) => {
      const s = seeded();
      await page.setViewportSize(DESKTOP);
      await login(page, s[r.key]!);

      // A session exists to begin with — otherwise the rest proves nothing.
      expect(
        (await storedSessionKeys(page)).length,
        `${r.role}: no session was stored after signing in, so this test cannot prove sign-out`,
      ).toBeGreaterThan(0);

      await signOut(page, r.shell);
      await expectLoggedOut(page, `${r.role} after clicking sign out`);

      // 1. The token store is actually empty.
      await expect
        .poll(async () => (await storedSessionKeys(page)).length, {
          message: `${r.role}: a Supabase session survived sign-out — the next person on this device inherits it`,
          timeout: 10_000,
        })
        .toBe(0);

      // 2. A protected route is refused, not merely un-linked.
      await page.goto(r.protectedRoute);
      await expectLoggedOut(page, `${r.role} navigating to ${r.protectedRoute} after logout`);

      // 3. A reload does not resurrect it. A redirect that a refresh undoes is
      //    a rendering decision, not a boundary.
      await page.reload();
      await expectLoggedOut(page, `${r.role} after reloading post-logout`);

      // 4. Browser Back does not restore usable authenticated access. Back can
      //    serve a cached DOM without re-running any guard, so this asserts the
      //    app re-evaluates rather than repainting the old screen.
      await page.goBack();
      await page.waitForLoadState('domcontentloaded');
      const backUrl = new URL(page.url()).pathname;
      if (backUrl !== '/login') {
        await expectLoggedOut(page, `${r.role} after pressing Back post-logout`);
      }
      expect(
        (await storedSessionKeys(page)).length,
        `${r.role}: pressing Back restored a stored session`,
      ).toBe(0);

      // 5. And signing in again still works — a sign-out that breaks the next
      //    login has only moved the problem somewhere less visible.
      await login(page, s[r.key]!);
      expect(
        (await storedSessionKeys(page)).length,
        `${r.role}: could not sign in again after signing out`,
      ).toBeGreaterThan(0);
    });
  }
});

test.describe('session lifecycle — the small screens people actually use', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(120_000);

  // The defect that made this necessary was viewport-specific: the control was
  // present and working at desktop width and hidden below 900px. Both shells
  // are therefore re-proven at the sizes their own users hold.
  for (const vp of [
    { name: 'tablet', size: TABLET },
    { name: 'mobile', size: MOBILE },
  ]) {
    test(`a Super Admin signs out completely on ${vp.name}`, async ({ page }) => {
      const s = seeded();
      await page.setViewportSize(vp.size);
      await login(page, s.superAdminEmail!);
      await signOut(page, 'staff');
      await expectLoggedOut(page, `Super Admin on ${vp.name}`);
      await expect.poll(async () => (await storedSessionKeys(page)).length).toBe(0);
      await page.goto('/institutions');
      await expectLoggedOut(page, `Super Admin on ${vp.name} after a protected route`);
    });

    test(`Classroom staff sign out completely on ${vp.name}`, async ({ page }) => {
      const s = seeded();
      await page.setViewportSize(vp.size);
      await login(page, s.classroomEmail!);
      await signOut(page, 'staff');
      await expectLoggedOut(page, `Classroom staff on ${vp.name}`);
      await expect.poll(async () => (await storedSessionKeys(page)).length).toBe(0);
      // The shared-tablet case, stated plainly: the register must not come back.
      await page.goto('/today');
      await expectLoggedOut(page, `Classroom staff on ${vp.name} returning to the register`);
    });
  }

  test('a Parent signs out completely on mobile', async ({ page }) => {
    const s = seeded();
    await page.setViewportSize(MOBILE);
    await login(page, s.parentEmail!);
    await signOut(page, 'parent');
    await expectLoggedOut(page, 'Parent on mobile');
    await expect.poll(async () => (await storedSessionKeys(page)).length).toBe(0);
    await page.goto('/parent');
    await expectLoggedOut(page, 'Parent on mobile returning to the portal');
  });
});
