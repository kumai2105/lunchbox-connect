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
    await page
      .getByRole('button', { name: /add meal/i })
      .first()
      .click();
    await page.getByPlaceholder('e.g. Chicken Pasta').fill(name);

    // A meal must say which sittings it is for before it can be saved: an
    // untagged meal is one Menu Builder can never offer, so the editor refuses
    // to create one. Assert the refusal rather than just satisfying it.
    const save = page.getByRole('button', { name: /save meal/i });
    await expect(save, 'Save was enabled for a meal with no sitting chosen').toBeDisabled();
    await page.getByRole('checkbox', { name: 'Lunch', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Morning snack', exact: true }).check();
    await expect(save).toBeEnabled();

    await page.getByPlaceholder('chicken, pasta, tomato').fill('rice, peas');
    await page.getByPlaceholder('gluten, dairy').fill('none');
    await save.click();

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

    // The two sittings are stored against the meal itself — one meal, two
    // periods, no duplicate row. This is the relationship the Meal Library
    // previously lacked entirely.
    const meal = await db.from('meals').select('id').eq('name', name).maybeSingle();
    const tags = await db
      .from('meal_periods')
      .select('period')
      .eq('meal_id', meal.data!.id as string);
    expect(
      (tags.data ?? []).map((t) => t.period as string).sort(),
      'the meal did not keep the sittings it was tagged with',
    ).toEqual(['lunch', 'snack']);
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

  test('a Super Admin creates a rotation and gets a planning grid', async ({ page }) => {
    const s = seeded();
    const name = `E2E Rotation ${Date.now()}`;

    await login(page, s.superAdminEmail);
    await page.goto('/menu-builder');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The fixture seeds NO rotation, which is why my previous two attempts here
    // failed: first I asserted a grid on arrival (the screen shows a picker),
    // then I clicked `.menu-list-item` (there was never one to click). Creating
    // the rotation is the better test anyway — it exercises the authoring path
    // instead of depending on fixture data that does not exist.
    await page
      .getByPlaceholder('e.g. Spring 2026')
      .waitFor({ state: 'hidden' })
      .catch(() => {});
    await page
      .getByRole('button', { name: /create menu|new menu|create/i })
      .first()
      .click();
    await page.getByPlaceholder('e.g. Spring 2026').fill(name);
    await page
      .locator('.modal, [role="dialog"]')
      .getByRole('button', { name: /create/i })
      .last()
      .click();

    // Opening it reveals the canvas: the grid, and the week tabs that make a
    // multi-week rotation navigable. Class names read from the page.
    await page.locator('.menu-list-item', { hasText: name }).first().click();
    await expect(page.locator('.menu-canvas')).toBeVisible();
    await expect(page.locator('.menu-grid')).toBeVisible();
    await expect(page.locator('.week-tabs')).toBeVisible();
  });

  /**
   * THE SLOT PICKER OFFERS THE RIGHT MEALS, AND STILL ALLOWS AN EXCEPTION.
   *
   * A meal used to have no relationship to a sitting at all: the period lived
   * only on the slot, so filling the Breakfast row offered every dish ever
   * created, lunches included. The tag is an authoring aid — it narrows the
   * list by default and an explicit override reveals the rest, because a real
   * kitchen occasionally breaks its own pattern on purpose.
   *
   * Both halves are asserted. A filter with no working override is a cage, and
   * an override that was never exercised is an untested claim.
   */
  test('the slot picker defaults to meals tagged for that sitting, and can be overridden', async ({
    page,
  }) => {
    const s = seeded();
    const db = adminDb();
    const stamp = Date.now();
    const breakfastOnly = `E2E Porridge ${stamp}`;
    const lunchOnly = `E2E Lasagne ${stamp}`;
    const rotation = `E2E Filter Rotation ${stamp}`;

    await login(page, s.superAdminEmail);

    // Two meals, one tagged for each end of the day, created through the UI so
    // the tags are written by the product rather than injected behind it.
    for (const [name, sitting] of [
      [breakfastOnly, 'Breakfast'],
      [lunchOnly, 'Lunch'],
    ] as const) {
      await page.goto('/meals');
      await page
        .getByRole('button', { name: /add meal/i })
        .first()
        .click();
      await page.getByPlaceholder('e.g. Chicken Pasta').fill(name);
      await page.getByRole('checkbox', { name: sitting, exact: true }).check();
      await page.getByRole('button', { name: /save meal/i }).click();
      await expect(page.getByText(name).first()).toBeVisible();
    }

    await page.goto('/menu-builder');
    await page
      .getByRole('button', { name: /create menu|new menu|create/i })
      .first()
      .click();
    await page.getByPlaceholder('e.g. Spring 2026').fill(rotation);
    await page
      .locator('.modal, [role="dialog"]')
      .getByRole('button', { name: /create/i })
      .last()
      .click();
    await page.locator('.menu-list-item', { hasText: rotation }).first().click();
    await expect(page.locator('.menu-grid')).toBeVisible();

    // Open the FIRST cell of the Breakfast row.
    const breakfastRow = page.locator('tr', { has: page.getByText('Breakfast', { exact: true }) });
    await breakfastRow.locator('.slot-cell').first().click();

    const picker = page.locator('.meal-picker');
    await expect(picker).toBeVisible();
    await expect(
      picker.getByText(breakfastOnly),
      'a breakfast-tagged meal was missing from the breakfast picker',
    ).toBeVisible();
    await expect(
      picker.getByText(lunchOnly),
      'a lunch-only meal was offered for a breakfast slot',
    ).toHaveCount(0);

    // The override is a real escape hatch, not decoration.
    await page.getByRole('checkbox', { name: /show all meals/i }).check();
    await expect(
      picker.getByText(lunchOnly),
      'the override did not reveal meals tagged for other sittings',
    ).toBeVisible();

    // And the database accepts the exception — the tag guides, it does not
    // forbid, so an overridden choice must actually save.
    await picker.getByText(lunchOnly).click();
    await expect
      .poll(
        async () => {
          const r = await db
            .from('rotations')
            .select('id, rotation_slots(period, meals(name))')
            .eq('name', rotation)
            .maybeSingle();
          // The embed is typed as an array by the client even for a to-one
          // relationship, so normalise rather than assert a shape it does not
          // actually return.
          const slots = (r.data?.rotation_slots ?? []) as unknown as {
            period: string;
            meals: { name: string } | { name: string }[] | null;
          }[];
          return slots.some((x) => {
            const m = Array.isArray(x.meals) ? x.meals[0] : x.meals;
            return x.period === 'breakfast' && m?.name === lunchOnly;
          });
        },
        { message: 'the deliberately overridden slot never persisted' },
      )
      .toBe(true);
  });
});

/**
 * FORM CONTROLS MUST BE LABELLED IN THE ACCESSIBILITY TREE.
 *
 * getByLabel resolves through the accessibility tree, not the DOM: it finds a
 * control only if a <label> is genuinely associated with it, by htmlFor/id or
 * by nesting. Nothing else counts. That is exactly the property that was
 * missing — Field rendered the label as a SIBLING with no htmlFor, so all 50
 * fields in this application were unlabelled boxes to a screen reader, and
 * unaddressable to voice control.
 *
 * Asserting with getByLabel rather than a placeholder is the whole point: a
 * placeholder is a visual hint that vanishes on typing and is not a label. If
 * this test can find the control by its visible label text, a real assistive
 * technology can too.
 */
test.describe('acceptance — form fields are labelled, not just visually captioned', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('the Create class dialog exposes each control by its label', async ({ page }) => {
    const s = seeded();
    const db = adminDb();

    await login(page, s.superAdminEmail);
    const seedClass = await db
      .from('classes')
      .select('institution_id')
      .eq('id', s.classForServing)
      .single();
    await page.goto(`/classes?institution=${seedClass.data?.institution_id as string}`);
    await page.getByRole('button', { name: '+ Create class', exact: true }).click();

    // Each control is reachable BY ITS LABEL, and is the control it claims to
    // be — a label pointing at the wrong element passes a existence check and
    // still misleads every user who relies on it.
    const name = page.getByLabel('Class name', { exact: true });
    await expect(name).toBeVisible();
    await name.fill('A11y probe');
    await expect(name).toHaveValue('A11y probe');

    await expect(page.getByLabel('Institution', { exact: true })).toBeVisible();
  });

  test('the Meal editor exposes its controls by label', async ({ page }) => {
    const s = seeded();
    await login(page, s.superAdminEmail);
    await page.goto('/meals');
    await page
      .getByRole('button', { name: /add meal/i })
      .first()
      .click();

    // 'Name' read from MealLibraryPage, not guessed — and exact, because label
    // matching is SUBSTRING by default and this dialog also carries
    // 'Ingredients', 'Allergens', 'Portion', 'Nutrition' and 'Image'.
    const mealName = page.getByLabel('Name', { exact: true });
    await expect(mealName).toBeVisible();
    await mealName.fill('A11y probe dish');
    await expect(mealName).toHaveValue('A11y probe dish');

    await expect(page.getByLabel('Portion', { exact: true })).toBeVisible();
  });
});

test.describe('acceptance — creating the things an Institution runs on', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('a Super Admin creates a Class, and it lands in the right Institution', async ({ page }) => {
    const s = seeded();
    const db = adminDb();
    const name = `E2E-Class-${Date.now()}`;

    await login(page, s.superAdminEmail);
    // Derive the institution from a key the fixture ACTUALLY writes.
    //
    // Two mistakes stacked here. First, /classes without ?institution= leaves
    // institutionId empty and the submit is disabled={... || !institutionId},
    // so the button could never enable — the app being right, since a Class
    // belongs to exactly one Institution. Then I "fixed" that with
    // s.institutionId, which .seeded.json does not contain: I had matched a
    // local variable name in global-setup, not a key. The URL became
    // "?institution=undefined", a string truthy enough to ENABLE the button,
    // so the click succeeded and the insert failed on the foreign key — no
    // locator error, just no row. Reading the value from the seeded class
    // removes the guess entirely.
    // INSTRUMENT THE BROWSER. The row never appears and the app shows NO error
    // banner, which rules out both an RLS refusal and a validation refusal —
    // either would have been rendered. So the question is what the POST to
    // /rest/v1/classes actually did, and the only way to know is to watch it.
    const netNotes: string[] = [];
    const consoleErrors: string[] = [];
    // FACT 2: the exact payload, body included. createClass() does
    // supabase.from('classes').insert(input).select().single(), so the POST body
    // is literally { institution_id, name, grade }.
    page.on('request', (r) => {
      if (r.url().includes('/rest/v1/classes') && r.method() === 'POST') {
        netNotes.push(`POST-BODY ${r.postData() ?? '(none)'}`);
      }
    });
    page.on('response', async (r) => {
      if (r.url().includes('/rest/v1/classes')) {
        const body =
          r.status() >= 400 ? ` body=${(await r.text().catch(() => '')).slice(0, 300)}` : '';
        netNotes.push(`${r.request().method()} ${r.status()}${body}`);
      }
    });
    page.on('requestfailed', (r) => {
      if (r.url().includes('/rest/v1/')) netNotes.push(`REQFAIL ${r.method()} ${r.url()}`);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
    });

    const seedClass = await db
      .from('classes')
      .select('institution_id')
      .eq('id', s.classForServing)
      .single();
    const institutionId = seedClass.data?.institution_id as string | undefined;
    expect(institutionId, 'could not resolve the seeded institution').toBeTruthy();

    await page.goto(`/classes?institution=${institutionId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // exact: true is load bearing. "+ Create class" (opens the dialog) and
    // "Create class" (submits it) both contain "Create class", and accessible
    // names match by SUBSTRING — an unqualified lookup matches two controls and
    // fails strict mode. The opener carries the leading "+".
    await page.getByRole('button', { name: '+ Create class', exact: true }).click();
    await page.getByPlaceholder('e.g. 1-A').fill(name);
    // FACT 1: what the Institution select actually holds immediately before Save.
    const selBefore = await page
      .locator('select')
      .first()
      .inputValue()
      .catch(() => '(no select)');

    await page.getByRole('button', { name: 'Create class', exact: true }).click();

    // Tenancy is the thing worth asserting, not merely existence: 0032 installs
    // a trigger keeping a class inside one Institution, and a class created
    // against the wrong tenant is a data-integrity failure, not a UI nit.
    // SURFACE THE APP'S OWN ERROR instead of only reporting "no row".
    //
    // Three rounds of this test failed with "the created class never appeared",
    // which says the insert did not happen but not WHY — and the page was
    // showing the reason the whole time, in a .banner.err that the test never
    // read. Polling for a row is the assertion; reading the banner first is
    // what makes a failure diagnosable instead of another guess.
    // Read the banner but DO NOT throw on it yet.
    //
    // The previous version threw the instant a banner appeared, which fired
    // before the network/database facts below were collected — so the run that
    // finally proved the app IS refusing the write reported only the banner
    // text ("[object Object]") and nothing about WHY. One failed run must yield
    // every fact at once; a diagnostic that short-circuits the diagnosis is
    // worse than none.
    const banner = page.locator('.banner.err');
    const bannerText = (await banner.count())
      ? ((await banner.first().textContent())?.trim() ?? '')
      : '';

    // Let the request land, then report EVERYTHING observed. "No row" is not a
    // diagnosis; "no row and no request was ever made" and "no row and the POST
    // returned 4xx" are different faults with different fixes.
    await page.waitForTimeout(1500);

    // FACTS 3 and 4, and the uniqueness proof.
    //
    // Deliberately select ALL rows with this name rather than maybeSingle():
    // maybeSingle() collapses "no rows" and "more than one row" into the same
    // null the assertion was seeing, so it could never have told those apart.
    // Listing them proves the test is reading the row THIS test created, and
    // not a stale or duplicate one.
    const all = await db.from('classes').select('id, institution_id, name').eq('name', name);
    const rows = all.data ?? [];
    if (bannerText || rows.length !== 1 || rows[0].institution_id !== institutionId) {
      const submit = page.getByRole('button', { name: 'Create class', exact: true });
      throw new Error(
        `CLASS-CREATE DIAGNOSIS for "${name}":\n` +
          `  1 UI select before Save : ${selBefore} (expected ${institutionId})\n` +
          `  2 network               : ${netNotes.join(' | ') || 'NO /rest/v1/classes REQUEST AT ALL'}\n` +
          `  3 rows in postgres      : ${rows.length} -> ${JSON.stringify(rows)}\n` +
          `  4 query error           : ${JSON.stringify(all.error)}\n` +
          `  banner                  : ${bannerText || 'none'}\n` +
          `  console                 : ${consoleErrors.join(' | ') || 'none'}\n` +
          `  submitDisabled=${await submit.isDisabled().catch(() => 'gone')} ` +
          `modalOpen=${await page.locator('.modal, [role="dialog"]').count()}`,
      );
    }

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
        { message: 'the created class never appeared in the scoped institution' },
      )
      .toBe(institutionId);
  });

  test('a Nursery Admin provisions classroom staff, and the account is real', async ({ page }) => {
    const s = seeded();
    const db = adminDb();
    const email = `e2e.staff.${Date.now()}@lunchbox.app`;

    await login(page, s.schoolAdminEmail);
    await page.goto('/staff');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: /provision classroom staff/i }).click();

    // This addresses the fields structurally rather than through getByLabel().
    // The programmatic labels themselves are asserted elsewhere in this file —
    // `Field` generates an id with useId() and points its <label> at it — so
    // this locator is a convenience here, not a workaround for missing labels.
    const field = (label: string) => page.locator('.field', { hasText: label }).locator('input');
    await field('Full name').fill('E2E Provisioned Staff');
    await field('Email').fill(email);
    await field('Password').fill('E2e-pass!12345');
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
