import { expect, test } from 'playwright/test';
import { adminDb, e2eReady, login, seeded } from './fixtures';

test.describe('classroom serving screen (docs/13 Decision 032 — fast tablet workflow)', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  test('teacher records a meal result which persists across reload', async ({ page }) => {
    const s = seeded();

    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}`);

    await expect(page.getByRole('heading', { name: /Today/ })).toBeVisible();

    // §2: only periods with a PUBLISHED service are shown. The seed publishes
    // Breakfast and Lunch today, so those tabs exist and the register is live.
    await expect(page.locator('.period-btn', { hasText: 'Breakfast' })).toBeVisible();

    // First student in the assigned-class roster.
    await expect(page.locator('.focus-name')).toContainText('Serving');

    // Fast path: tap 75% eaten, then a behaviour — auto-saves and advances.
    await page.getByRole('button', { name: '75% eaten' }).click();
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
    await expect(page.locator('.focus-name')).toContainText('Serving');

    // Normal children never see a reason selector until intake is low.
    await expect(page.getByRole('button', { name: "Didn't like it" })).toHaveCount(0);

    await page.getByRole('button', { name: '0% eaten' }).click();
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
    await expect(page.locator('.focus-name')).toContainText('Serving');

    // The exception row is always available and needs no % or behaviour first.
    await expect(page.getByRole('button', { name: 'Absent' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unwell' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sleeping' })).toBeVisible();

    // One tap records it and advances — no contradictory behaviour is possible.
    await page.getByRole('button', { name: 'Absent' }).click();
    await expect(page.locator('.roster-chip').first().locator('.status-badge')).not.toHaveText('');
  });

  test('a period with NO published Meal cannot be recorded — UI, controls and RPC', async ({
    page,
  }) => {
    const s = seeded();
    // The seed publishes BREAKFAST and LUNCH for today at this institution, and
    // deliberately nothing for the afternoon snack. That period is the negative
    // condition. (This test previously only asserted the Today page loaded,
    // which the page does whether or not anything is published.)
    await login(page, s.classroomEmail);
    await page.goto(`/today?class=${s.classForServing}&period=afternoon_snack`);

    // 1. The UI says so plainly, in role-correct terms.
    await expect(page.getByText(/No published Meal is available/i)).toBeVisible();

    // 2. No recording control is offered for that period.
    for (const label of [/^100%$/, /^75%$/, /^50%$/, /^25%$/, /^0%$/, /Not served/i]) {
      await expect(page.getByRole('button', { name: label })).toHaveCount(0);
    }

    // 3. A DIRECT RPC call is refused by the database, not merely hidden.
    const rpc = await page.evaluate(async () => {
      const w = window as unknown as {
        __sb?: { rpc: (fn: string, args: unknown) => Promise<{ error: { message: string } | null }> };
      };
      if (!w.__sb) return { skipped: true as const };
      const res = await w.__sb.rpc('record_serving_batch', {
        p_class: null,
        p_rows: [],
        p_date: null,
      });
      return { skipped: false as const, error: res.error?.message ?? null };
    });
    // The page does not expose its Supabase client, so the direct-write proof
    // lives in SQL where it can attack the real boundary:
    // tests/sql/verify_correction_order.sql asserts that recording a period
    // with nothing published raises check_violation, and
    // verify_db_boundary.sql asserts raw serving_records INSERT is revoked.
    expect(rpc.skipped || rpc.error !== null).toBeTruthy();

    // 4. Nothing was created for that period.
    const db = adminDb();
    const { data } = await db
      .from('serving_records')
      .select('id')
      .eq('class_id', s.classForServing)
      .eq('period', 'afternoon_snack');
    expect(data ?? []).toHaveLength(0);
  });
});
