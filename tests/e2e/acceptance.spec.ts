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
    const redacted = `Approved by acceptance test ${Date.now()}`;
    const box = page.locator('textarea').first();
    await expect(box).toBeVisible();
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

  test('an empty note cannot be approved — the button stays disabled', async ({ page }) => {
    const s = seeded();
    const db = adminDb();

    // Give the screen something to show, authored the way the app authors it.
    const drafts = await db.from('serving_notes').select('id').is('published_at', null);
    test.skip((drafts.data ?? []).length === 0, 'no unpublished note left to assert against');

    await login(page, s.superAdminEmail);
    await page.goto('/review');

    const box = page.locator('textarea').first();
    await expect(box).toBeVisible();
    await box.fill('   '); // whitespace only
    await expect(
      page.getByRole('button', { name: /approve for family/i }).first(),
      'whitespace must not count as a note',
    ).toBeDisabled();
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

  test('the Menu Builder loads a rotation with its week/slot grid', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto('/menu-builder');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The grid is the instrument. If no slot control renders, the screen cannot
    // be used to plan anything, however healthy it looks.
    await expect
      .poll(async () => (await page.locator('.slot, .rotation-slot, table, select').count()) > 0, {
        message: 'the Menu Builder rendered no planning grid',
      })
      .toBe(true);
  });
});
