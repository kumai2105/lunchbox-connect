import { expect, test, type Page } from 'playwright/test';
import { SEL, e2eReady, login, seeded } from './fixtures';

/**
 * TABLET AND MOBILE ACCEPTANCE.
 *
 * Every other spec in this suite runs at Playwright's default desktop viewport,
 * so until this file existed the tablet and mobile experiences were UNVERIFIED
 * — not broken, just never executed. Decision 032 calls the Classroom register
 * a "fast tablet workflow" and the Parent portal is a mobile-first design, so
 * the two surfaces the product description leans on hardest were the two with
 * no evidence at all behind them.
 *
 * These tests look for FUNCTIONAL defects, not aesthetics. A layout being ugly
 * at 390px is not a defect; a Save button you cannot reach, a control pushed
 * off-screen, or a page that scrolls sideways because something overflows its
 * container are. Each assertion below is something a real person would be
 * blocked by.
 */

const TABLET = { width: 820, height: 1180 }; // iPad Air portrait
const MOBILE = { width: 390, height: 844 }; // iPhone 14 class

/**
 * The page must not scroll horizontally. A sideways-scrolling app on a phone is
 * the classic symptom of a fixed width or an unwrapped table, and it makes
 * controls sitting at the right edge unreachable.
 *
 * A tolerance of 1px absorbs sub-pixel rounding in the layout engine, which is
 * not a defect and would otherwise make this flaky.
 */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1);
}

/** A control is useless if it is not in the viewport and cannot be brought into it. */
async function expectUsable(page: Page, locator: ReturnType<Page['locator']>, what: string) {
  await expect(locator, `${what} is not visible`).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `${what} has no box`).not.toBeNull();
  const vp = page.viewportSize();
  if (!box || !vp) return;
  // Horizontally within the viewport. Vertical position is fine anywhere —
  // scrolling down is normal; being cut off sideways is not.
  expect(box.x, `${what} starts off the left edge`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${what} extends past the right edge`).toBeLessThanOrEqual(
    vp.width + 1,
  );
  // Comfortably tappable. 24px is well under the 44px guideline and is set
  // deliberately low: this is a floor that catches genuinely unusable targets,
  // not a design review.
  expect(box.height, `${what} is too short to tap`).toBeGreaterThanOrEqual(24);
}

test.describe('tablet — the Classroom register is the workflow it claims to be', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('classroom staff can record a meal end to end on a tablet', async ({ page }) => {
    const s = seeded();
    await page.setViewportSize(TABLET);

    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);

    await expect(page.getByRole('heading', { level: 1, name: /Today/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // The roster strip is the navigation for the whole screen.
    await expectUsable(page, page.locator('.roster-chip').first(), 'first roster chip');

    // The period tabs must be reachable — without them a teacher cannot switch
    // between Breakfast and Lunch.
    await expectUsable(page, page.locator('.period-btn').first(), 'period tab');

    // The recording controls themselves: the percentage plate and a behaviour.
    await expectUsable(
      page,
      page.getByRole('button', { name: '75% eaten', exact: true }),
      '75% control',
    );
    await expectUsable(
      page,
      page.getByRole('button', { name: 'Absent', exact: true }),
      'Absent exception control',
    );

    // And the workflow actually completes: tap, save, advance.
    await page.getByRole('button', { name: '75% eaten', exact: true }).click();
    await page.getByRole('button', { name: 'Ate independently' }).click();
    await expect(page.locator('.roster-chip').first().locator('.status-badge')).toHaveClass(/sb-/);

    await expectNoHorizontalOverflow(page);
  });

  test('the Super Admin Menu Builder is operable on a tablet', async ({ page }) => {
    const s = seeded();
    await page.setViewportSize(TABLET);

    await login(page, s.superAdminEmail);
    await page.goto('/menu-builder');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('a Nursery Admin can read the published schedule on a tablet', async ({ page }) => {
    const s = seeded();
    await page.setViewportSize(TABLET);

    await login(page, s.schoolAdminEmail);
    await page.goto('/schedule');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

/**
 * SIGNING OUT MUST BE POSSIBLE ON THE DEVICE YOU SIGNED IN ON.
 *
 * The responsive pass above checked that screens render and controls are
 * reachable, and still missed this: below 901px the stylesheet collapsed the
 * sidebar to a 64px rail and put `.side-foot button` — the Log out control —
 * in the same `display: none` rule as the user's name and role. Those are
 * labels. That is the only way any staff or admin role can end a session,
 * because Layout renders no other and the avatar beside it is a plain div.
 *
 * So a Super Admin on a phone could sign in and never sign out. On a shared
 * classroom tablet that is not a cosmetic issue: the next person to pick the
 * device up inherits the previous person's session.
 *
 * Asserted per role rather than once, because the roles do not share a shell —
 * a Parent has its own Sign out on the profile screen and would have hidden
 * the staff regression behind a passing test.
 */
// Sign-out at small viewports moved to session.spec.ts.
//
// These tests asserted the control was PRESENT and, in one case, that the URL
// changed. That is not a sign-out: it says nothing about whether the stored
// session survived, whether a protected route is refused afterwards, or
// whether Back restores the screen. session.spec.ts proves the whole lifecycle
// for all nine roles and re-proves both shells at tablet and mobile, so
// keeping a weaker duplicate here would only add runtime and a second, laxer
// definition of the same guarantee.

test.describe('mobile — login and the Parent portal', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('the login screen is usable on a phone', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/login');

    // Same selectors the login helper uses, so this cannot drift from the
    // thing every other spec depends on.
    await expectUsable(page, page.locator(SEL.email), 'email field');
    await expectUsable(page, page.locator(SEL.password), 'password field');
    await expectUsable(
      page,
      page.getByRole('button', { name: /enter the platform/i }),
      'sign-in button',
    );
    await expectNoHorizontalOverflow(page);
  });

  test('a parent can reach their child, the menu and a meal detail on a phone', async ({
    page,
  }) => {
    const s = seeded();
    await page.setViewportSize(MOBILE);

    await login(page, s.parentEmail);
    await expect(page).toHaveURL(/\/parent/);
    await expectNoHorizontalOverflow(page);

    // The parent shell's navigation is the only way around the portal on a
    // phone; if it is off-screen the portal is a dead end.
    const nav = page.locator('.parent-nav-item').first();
    await expectUsable(page, nav, 'parent navigation');

    // Every parent surface must render without sideways scroll.
    for (const path of ['/parent', '/parent/menu', '/parent/insights', '/parent/profile']) {
      await page.goto(path);
      await expect(page.locator('#root')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('parent child switching works at phone width', async ({ page }) => {
    const s = seeded();
    await page.setViewportSize(MOBILE);

    await login(page, s.parentEmail);
    await page.goto('/parent');

    // The switcher only exists when the parent has more than one child. When it
    // does, it must be reachable — a parent who cannot switch children on the
    // device they actually use has lost half the portal.
    const switcher = page.locator('.child-switch, .child-tab, [data-child-switch]').first();
    if (await switcher.count()) {
      await expectUsable(page, switcher, 'child switcher');
    }
    await expectNoHorizontalOverflow(page);
  });
});
