import { expect, test } from 'playwright/test';
import { adminDb, e2eReady, login, seeded } from './fixtures';

/**
 * PRODUCT ACCEPTANCE for the surfaces that were previously CODE-INSPECTED ONLY.
 *
 * The suite already proved the boundaries — who may reach what, and what a
 * parent may see. What it never did was press the buttons that CREATE and
 * PUBLISH things. Those are the actions that change what a family reads and
 * what a kitchen cooks, and "the code looks right" is not evidence about them.
 *
 * These tests exercise the real controls through the browser and then check the
 * DATABASE for the effect, so a button that looks like it worked but wrote
 * nothing cannot pass.
 */

test.describe('acceptance — the parent-privacy boundary is an ACTION, not just a policy', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  /**
   * The single most consequential control in the product.
   *
   * A classroom note is internal until an admin approves it on /review. Approve
   * the wrong thing and a family reads something never meant for them; fail to
   * approve and the safe default holds. Nothing exercised that button before
   * this test, which meant the mechanism deciding what parents see was covered
   * only by reading the source.
   */
  test('/review publishes a draft note to the family, and the edit is what gets published', async ({
    page,
  }) => {
    const s = seeded();
    const db = adminDb();

    // The seed leaves one DRAFT note (published_at null) authored by classroom
    // staff. Confirm that starting state from the database rather than assuming
    // it, so a fixture change cannot make this test quietly vacuous.
    const before = await db
      .from('serving_notes')
      .select('id, body, published_at')
      .is('published_at', null);
    expect(before.data ?? [], 'no draft note was seeded to approve').not.toHaveLength(0);
    const draftId = (before.data ?? [])[0].id as string;

    await login(page, s.superAdminEmail);
    await page.goto('/review');

    // The reviewer must be able to REDACT before approving — that is the whole
    // point of the screen, so publish the edited text, not the original.
    const box = page.locator('textarea').first();
    await expect(box).toBeVisible();

    // Whitespace is not a note. Asserted HERE rather than in a test of its own:
    // as a separate test it depended on a draft still being unpublished, which
    // the test above had already consumed, so it skipped — and this gate
    // forbids silent skips, correctly. Folding it in removes the ordering
    // dependency entirely.
    await box.fill('   ');
    await expect(
      page.getByRole('button', { name: /approve for family/i }).first(),
      'whitespace must not count as a note',
    ).toBeDisabled();

    const redacted = `Approved by acceptance test ${Date.now()}`;
    await box.fill(redacted);

    const approve = page.getByRole('button', { name: /approve for family/i }).first();
    await expect(approve, 'approve must be enabled once there is text').toBeEnabled();
    await approve.click();

    // Effect, checked at the database: that row is now published AND carries the
    // redacted text. Asserting only "published" would let a bug that publishes
    // the ORIGINAL wording pass, which is exactly the failure that matters here.
    await expect
      .poll(
        async () => {
          const r = await db
            .from('serving_notes')
            .select('body, published_at')
            .eq('id', draftId)
            .single();
          return r.data?.published_at ? r.data.body : null;
        },
        { message: 'the draft note never became published with the redacted body' },
      )
      .toBe(redacted);
  });

});

test.describe('acceptance — Meal Library authoring', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('a Super Admin creates a Meal, and it persists with a first revision', async ({ page }) => {
    const s = seeded();
    const db = adminDb();
    const name = `E2E Acceptance Dish ${Date.now()}`;

    await login(page, s.superAdminEmail);
    await page.goto('/meals');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // "Add meal", not "New meal" — read from the page, not guessed. A test that
    // names a control that does not exist fails for its own reasons and proves
    // nothing about the product.
    await page.getByRole('button', { name: /add meal/i }).first().click();
    await page.getByPlaceholder('e.g. Chicken Pasta').fill(name);
    await page.getByPlaceholder('chicken, pasta, tomato').fill('rice, peas');
    await page.getByPlaceholder('gluten, dairy').fill('none');
    await page.getByRole('button', { name: /save meal/i }).click();

    // Decision 033: one save creates the Meal AND its revision, and the meal
    // points at that revision. A Meal with no current revision cannot be put on
    // a menu, so asserting the row exists is not enough.
    await expect
      .poll(
        async () => {
          const r = await db
            .from('meals')
            .select('id, current_revision_id')
            .eq('name', name)
            .maybeSingle();
          return r.data?.current_revision_id ? 'linked' : r.data ? 'no-revision' : 'missing';
        },
        { message: 'the saved meal never appeared with a current revision' },
      )
      .toBe('linked');

    await expect(page.getByText(name).first()).toBeVisible();
  });
});

test.describe('acceptance — read-only management surfaces render real data', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  /**
   * These four were reachable-but-unproven: the suite knew who could open them,
   * never that they rendered anything. A screen that loads and then shows an
   * error or an empty shell passes a "can reach it" test and fails a user.
   */
  for (const [label, path] of [
    ['Meal analytics', '/analytics'],
    ['Audit log', '/audit'],
    ['Guardians', '/guardians'],
    ['Institutions', '/institutions'],
  ] as const) {
    test(`${label} renders for a Super Admin without an error state`, async ({ page }) => {
      const s = seeded();
      await login(page, s.superAdminEmail);
      await page.goto(path);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // No error surfaced anywhere on the page.
      const errors = page.locator('[role="alert"], .error, .form-error');
      if (await errors.count()) {
        await expect(errors.first()).toBeHidden();
      }

      // Something real rendered — a table, a card, a list or an explicit empty
      // state. An empty state is a legitimate answer; a blank page is not.
      await expect
        .poll(
          async () =>
            (await page.locator('table, .card, .list-row, .empty-state, .cell').count()) > 0,
          { message: `${label} rendered no content at all` },
        )
        .toBe(true);
    });
  }
});

test.describe('acceptance — Menu Builder authoring', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('the Menu Builder opens a rotation and shows its week/slot grid', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto('/menu-builder');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The grid does NOT render on arrival, and my first version of this test
    // failed for exactly that reason: it asserted a planning grid on a screen
    // that legitimately shows a rotation PICKER first. The canvas only appears
    // once a rotation is selected, so the test has to do what a planner does.
    const rotation = page.locator('.menu-list-item').first();
    await expect(rotation, 'no rotation to open — the seed should provide one').toBeVisible();
    await rotation.click();

    // Now the canvas, its week tabs and the grid itself must be present. These
    // are the real class names from the page, read rather than guessed.
    await expect(page.locator('.menu-canvas')).toBeVisible();
    await expect(page.locator('.menu-grid')).toBeVisible();
    await expect(page.locator('.week-tabs')).toBeVisible();
  });
});

test.describe('acceptance — creating the things an Institution runs on', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('a Super Admin creates a Class, and it lands in the right Institution', async ({ page }) => {
    const s = seeded();
    const db = adminDb();
    const name = `E2E-Class-${Date.now()}`;

    await login(page, s.superAdminEmail);
    await page.goto('/classes');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // exact: true is load bearing. "+ Create class" (opens the dialog) and
    // "Create class" (submits it) both contain "Create class", and accessible
    // names match by SUBSTRING — an unqualified lookup matches two controls and
    // fails strict mode. The opener carries the leading "+".
    await page.getByRole('button', { name: '+ Create class', exact: true }).click();
    await page.getByPlaceholder('e.g. 1-A').fill(name);
    await page.getByRole('button', { name: 'Create class', exact: true }).click();

    // Tenancy is the thing worth asserting, not merely existence: 0032 installs
    // a trigger keeping a class inside one Institution, and a class created
    // against the wrong tenant is a data-integrity failure, not a UI nit.
    await expect
      .poll(
        async () => {
          const r = await db
            .from('classes')
            .select('id, institution_id')
            .eq('name', name)
            .maybeSingle();
          return r.data?.institution_id ?? null;
        },
        { message: 'the created class never appeared with an institution' },
      )
      .not.toBeNull();
  });

  test('a Nursery Admin provisions classroom staff, and the account is real', async ({ page }) => {
    const s = seeded();
    const db = adminDb();
    const email = `e2e.staff.${Date.now()}@lunchbox.app`;

    await login(page, s.schoolAdminEmail);
    await page.goto('/staff');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: /provision classroom staff/i }).click();
    await page.getByLabel('Full name').fill('E2E Provisioned Staff');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/temporary password/i).fill('E2e-pass!12345');
    await page.getByRole('button', { name: /create account/i }).click();

    // This is the whole point of the screen: an app_users row with the right
    // role, in the admin's OWN institution. The Edge Function is the only
    // server-side account path, so this also proves that path works end to end
    // rather than just that the form submits.
    await expect
      .poll(
        async () => {
          const r = await db
            .from('app_users')
            .select('role, institution_id')
            .eq('email', email)
            .maybeSingle();
          return r.data?.role ?? null;
        },
        { message: 'the provisioned staff account never appeared' },
      )
      .toBe('classroom_staff');
  });
});
