import { expect, test } from 'playwright/test';
import { adminDb, e2eReady, login, seeded } from './fixtures';

test.describe('classroom serving screen (docs/13 Decision 032 — fast tablet workflow)', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('teacher records a meal result which persists across reload', async ({ page }) => {
    const s = seeded();

    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);

    // Level 1 specifically. The Layout renders the page title twice — once as
    // the topbar breadcrumb <h2>, once as the page's own <h1> — so an
    // unqualified heading lookup matches two elements and fails strict mode.
    await expect(page.getByRole('heading', { level: 1, name: /Today/ })).toBeVisible();

    // §2: only periods with a PUBLISHED service are shown. The seed publishes
    // Breakfast and Lunch today, so those tabs exist and the register is live.
    await expect(page.locator('.period-btn', { hasText: 'Breakfast' })).toBeVisible();

    // The register opens focused on the FIRST student in the roster. Assert that
    // relationship rather than a student's name: every fixture student shares
    // this class, and the roster is ordered by family name, so "Second Child"
    // legitimately sorts ahead of "Serving One". Naming a specific student here
    // only encoded an assumption about sort order that the app never promised.
    await expect(page.locator('.roster-chip').first()).toHaveClass(/active/);
    await expect(page.locator('.focus-name')).not.toBeEmpty();

    // Fast path: tap 75% eaten, then a behaviour — auto-saves and advances.
    // exact: true throughout. Accessible-name matching is SUBSTRING by default,
    // so { name: '0% eaten' } also matches "50% eaten" and "100% eaten" and
    // fails strict mode. '75% eaten' happens to be unique, which is exactly why
    // this line passed while the 0% one below did not — the same latent bug
    // simply had no collision here.
    await page.getByRole('button', { name: '75% eaten', exact: true }).click();
    await page.getByRole('button', { name: 'Ate independently' }).click();

    // The recorded student's roster chip shows the "recorded ok" icon badge
    // (an Icon with the sb-checkCircle class, not a text glyph).
    const firstChip = page.locator('.roster-chip').first();
    await expect(firstChip.locator('.status-badge')).toHaveClass(/sb-checkCircle/);

    // Persisted: reload and re-open that student via the roster strip.
    await page.reload();
    await expect(page.locator('.roster-chip').first().locator('.status-badge')).toHaveClass(
      /sb-checkCircle/,
    );
    await page.locator('.roster-chip').first().click();
    await expect(page.locator('.plate-quarter.selected')).toContainText('75%');
  });

  test('low intake shows the exception-first reason selector', async ({ page }) => {
    const s = seeded();

    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);
    // As above: assert the register opened on the first roster entry, not on a
    // particular child's name.
    await expect(page.locator('.roster-chip').first()).toHaveClass(/active/);
    await expect(page.locator('.focus-name')).not.toBeEmpty();

    // Normal children never see a reason selector until intake is low.
    await expect(page.getByRole('button', { name: "Didn't like it" })).toHaveCount(0);

    await page.getByRole('button', { name: '0% eaten', exact: true }).click();
    await page.getByRole('button', { name: 'Refused' }).click();

    // Now the low-intake reason selector appears (exception-first design).
    await expect(page.getByRole('button', { name: "Didn't like it" })).toBeVisible();
    await page.getByRole('button', { name: "Didn't like it" }).click();

    const firstChip = page.locator('.roster-chip').first();
    await expect(firstChip.locator('.status-badge')).toHaveClass(/sb-xCircle/);
  });

  test('§6: Absent/Unwell/Asleep record in one tap without an eating behaviour', async ({
    page,
  }) => {
    const s = seeded();
    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);
    // Same as the tests above — the roster orders by family name, so naming a
    // student here asserts a sort order the app never promised. (I corrected
    // two of these three occurrences last pass and missed this one.)
    await expect(page.locator('.roster-chip').first()).toHaveClass(/active/);
    await expect(page.locator('.focus-name')).not.toBeEmpty();

    // The exception row is always available and needs no % or behaviour first.
    await expect(page.getByRole('button', { name: 'Absent', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unwell', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sleeping', exact: true })).toBeVisible();

    // Act on a student NOBODY ELSE IN THIS FILE has recorded. The suite runs
    // serially against one seeded database, so the first roster entry already
    // carries a result from the test above — the old assertion was reading a
    // badge that an earlier test had set, and could not tell whether this test
    // had changed anything at all. An unrecorded chip renders '·'.
    const fresh = page.locator('.roster-chip', { hasText: '·' }).first();
    await fresh.click();

    // One tap records it — no % and no behaviour first.
    await page.getByRole('button', { name: 'Absent', exact: true }).click();

    // The badge stops being the unrecorded dot and takes a state class. It is
    // NOT asserted to be any particular icon: saveException writes
    // served_status 'served' with behavior null, which the badge derivation
    // renders as checkCircle. Pinning the icon here would freeze a presentation
    // choice rather than test the rule.
    //
    // (The previous assertion, `not.toHaveText('')`, was inverted: a recorded
    // badge holds an SVG and therefore NO text, while an unrecorded one holds
    // '·'. It could only ever pass for a student who had not been recorded.)
    await expect(fresh.locator('.status-badge')).toHaveClass(/sb-/);

    // The substance of §6, asserted where no icon choice can blur it: the row
    // exists with the exception reason and with NO eating behaviour and NO
    // consumption figure attached to it.
    const db = adminDb();
    const { data } = await db
      .from('serving_records')
      .select('behavior, consumption_pct, low_intake_reason')
      .eq('class_id', s.classForServing)
      .eq('low_intake_reason', 'absent');
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const row of data ?? []) {
      expect(row.behavior).toBeNull();
      expect(row.consumption_pct).toBeNull();
    }
  });

  test('a period with NO published Meal is never offered for recording', async ({ page }) => {
    const s = seeded();

    // WHAT THIS TEST USED TO ASSUME, AND WHY IT WAS WRONG
    //
    // It navigated to `?period=afternoon_snack` and expected the register to
    // sit on that unpublished period showing "No published Meal is available".
    // TodayPage does neither, deliberately:
    //
    //   * it never reads `period` from the URL — the period is component state
    //     that starts at breakfast;
    //   * an effect actively keeps the selection on a published period
    //     ("never leave the register pointed at an unpublished slot");
    //   * that empty state is the DAY-level case — nothing published at all —
    //     not the per-period one.
    //
    // So the state the test demanded is unreachable BY DESIGN, and the test was
    // failing the app for refusing to enter it. What §2/§35 actually guarantees
    // is that an unpublished period is never OFFERED, which is the stronger
    // property: you cannot record against a meal that does not exist because
    // you can never select it.
    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);

    // The seed publishes Breakfast and Lunch today and deliberately nothing for
    // the afternoon snack.
    await expect(page.locator('.period-btn', { hasText: 'Breakfast' })).toBeVisible();
    await expect(page.locator('.period-btn', { hasText: 'Lunch' })).toBeVisible();

    // The negative condition: the unpublished period is absent from the bar.
    await expect(page.locator('.period-btn', { hasText: 'Afternoon snack' })).toHaveCount(0);

    // And nothing exists for it in the database either. The direct-write proof
    // lives in SQL, where it can attack the real boundary rather than a UI that
    // has already hidden the control: verify_correction_order.sql asserts that
    // recording a period with nothing published raises check_violation, and
    // verify_db_boundary.sql asserts a raw serving_records INSERT is revoked.
    const db = adminDb();
    const { data } = await db
      .from('serving_records')
      .select('id')
      .eq('class_id', s.classForServing)
      .eq('period', 'afternoon_snack');
    expect(data ?? []).toHaveLength(0);
  });
});
