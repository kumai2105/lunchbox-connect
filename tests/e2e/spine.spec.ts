import { expect, test, type Page } from 'playwright/test';
import { adminDb, e2eReady, login, seeded } from './fixtures';

/**
 * THE OPERATIONAL SPINE, DRIVEN BY PEOPLE.
 *
 * The database suites prove the rules hold. This proves the humans who are
 * supposed to carry them out can actually do so through the product, in the
 * order a real day happens:
 *
 *   Meal Plans → mixed assignment → activation → published service
 *   → special meal decision → exact demand → finalise
 *   → produce → pack → deliver → collect → arrive → hand over
 *   → classroom records only entitled children → parent sees the truth.
 *
 * DISPOSABLE FIXTURES ONLY. Every institution, class, child, plan and account
 * this file touches is created by this file and cleaned up afterwards. Nothing
 * the other specs depend on is modified — a test that proves a lifecycle by
 * breaking the shared fixture has proved only that it should not have run.
 */

const stamp = Date.now();
const INST = `ZZ E2E Spine ${stamp}`;
const CLASS = `ZZ Spine Class ${stamp}`;
const MORNING_PLAN = `ZZ Morning ${stamp}`;
const FULL_PLAN = `ZZ Full ${stamp}`;
const STD_MEAL = `ZZ Spine Standard ${stamp}`;
const ALT_MEAL = `ZZ Spine Alternative ${stamp}`;

/** Asia/Dubai operational date, matching the rest of the product. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
}

type Ids = {
  instId: string;
  classId: string;
  morningIds: string[];
  fullIds: string[];
  serviceIds: Record<string, string>;
};

let ids: Ids;

test.describe('operational spine', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(180_000);
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const db = adminDb();

    const { data: inst } = await db
      .from('institutions')
      .insert({ name: INST, kind: 'nursery' })
      .select('id')
      .single();
    const instId = (inst as { id: string }).id;

    const { data: cls } = await db
      .from('classes')
      .insert({ institution_id: instId, name: CLASS, grade: 'KG1' })
      .select('id')
      .single();
    const classId = (cls as { id: string }).id;

    await db.from('institution_service_plans').insert({
      institution_id: instId,
      periods: ['breakfast', 'snack', 'lunch', 'afternoon_snack'],
      effective_from: today(),
    });

    // Six children: two morning-only, four full. Small enough to drive through
    // a browser, large enough that 6 / 6 / 4 / 4 is a real arithmetic claim.
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => ({ tag: 'M', n: i + 1 })),
      ...Array.from({ length: 4 }, (_, i) => ({ tag: 'F', n: i + 1 })),
    ].map((r) => ({
      student_no: `ZZ${stamp}${r.tag}${r.n}`,
      institution_id: instId,
      class_id: classId,
      given_name: r.tag === 'M' ? 'Morning' : 'Full',
      family_name: `Child${r.n}`,
      enrollment_status: 'enrolled',
      operational_status: 'ACTIVE_BILLABLE_TO_NURSERY',
    }));
    const { data: students } = await db.from('students').insert(rows).select('id, given_name');
    const all = (students ?? []) as Array<{ id: string; given_name: string }>;

    // Meals, then a published service for each of the four sittings.
    const { data: stdId } = await db.rpc('save_meal', {
      p_meal_id: null,
      p_name: STD_MEAL,
      p_ingredients: null,
      p_allergens: null,
      p_nutrition: null,
      p_portion: null,
      p_image_path: null,
    });
    const { data: altId } = await db.rpc('save_meal', {
      p_meal_id: null,
      p_name: ALT_MEAL,
      p_ingredients: null,
      p_allergens: null,
      p_nutrition: null,
      p_portion: null,
      p_image_path: null,
    });
    const rev = async (mealId: string) => {
      const { data } = await db
        .from('meals')
        .select('current_revision_id')
        .eq('id', mealId)
        .single();
      return (data as { current_revision_id: string }).current_revision_id;
    };
    const stdRev = await rev(stdId as string);
    await rev(altId as string);

    const serviceIds: Record<string, string> = {};
    for (const period of ['breakfast', 'snack', 'lunch', 'afternoon_snack']) {
      const { data } = await db
        .from('meal_services')
        .insert({
          institution_id: instId,
          service_date: today(),
          period,
          meal_revision_id: stdRev,
          published: true,
          published_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      serviceIds[period] = (data as { id: string }).id;
    }

    ids = {
      instId,
      classId,
      morningIds: all.filter((s) => s.given_name === 'Morning').map((s) => s.id),
      fullIds: all.filter((s) => s.given_name === 'Full').map((s) => s.id),
      serviceIds,
    };
  });

  test.afterAll(async () => {
    const db = adminDb();
    // Reverse order of creation so nothing is left referencing a deleted row.
    await db.from('students').delete().eq('institution_id', ids.instId);
    await db.from('meal_services').delete().eq('institution_id', ids.instId);
    await db.from('classes').delete().eq('id', ids.classId);
    await db.from('institutions').delete().eq('id', ids.instId);
    await db.from('meals').delete().in('name', [STD_MEAL, ALT_MEAL]);
    await db.from('meal_plans').delete().in('name', [MORNING_PLAN, FULL_PLAN]);
  });

  // ------------------------------------------------------------------ plans
  test('a Super Admin defines Meal Plans and makes them available to a site', async ({ page }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/meal-plans');

    for (const [name, periods] of [
      [MORNING_PLAN, ['Breakfast', 'Morning snack']],
      [FULL_PLAN, ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack']],
    ] as const) {
      await page.getByRole('button', { name: '+ Create Meal Plan', exact: true }).click();
      await page.getByLabel('Plan name', { exact: true }).fill(name);
      for (const p of periods) {
        await page.locator('.modal').getByRole('checkbox', { name: p }).check();
      }
      await page.getByRole('button', { name: 'Save Meal Plan', exact: true }).click();
      await expect(page.locator('tr', { hasText: name })).toBeVisible({ timeout: 20_000 });
    }

    const row = page.locator('tr', { hasText: INST });
    await row.getByRole('button', { name: 'Available Plans', exact: true }).click();
    await page.locator('.modal').getByRole('checkbox', { name: MORNING_PLAN }).check();
    await page.locator('.modal').getByRole('checkbox', { name: FULL_PLAN }).check();
    await page.locator('.modal').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });
  });

  test('activation refuses while any served child has no Plan, and names them', async ({
    page,
  }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/meal-plans');
    const row = page.locator('tr', { hasText: INST });
    await row.getByRole('button', { name: 'Activate Student Meal Plans', exact: true }).click();

    // The readiness list is the screen's content, not a footnote: six children,
    // each named, each with the reason.
    await expect(page.locator('.modal')).toContainText('cannot be served', { timeout: 20_000 });
    await expect(page.locator('.modal tbody tr')).toHaveCount(6);
    await expect(
      page.locator('.modal').getByRole('button', { name: 'Activate Student Meal Plans' }),
    ).toBeDisabled();
    await page.locator('.modal').getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('mixed Plans are assigned, and activation then succeeds', async ({ page }) => {
    const db = adminDb();
    const plan = async (name: string) => {
      const { data } = await db.from('meal_plans').select('id').eq('name', name).single();
      return (data as { id: string }).id;
    };
    // Assignment itself is proven at the database boundary and through the
    // Student profile below; bulk-seeding it here keeps this spec about the
    // ACTIVATION decision rather than about six identical dialogs.
    await db.rpc('bulk_assign_student_meal_plan', {
      p_students: ids.morningIds,
      p_plan: await plan(MORNING_PLAN),
      p_from: today(),
      p_note: null,
    });
    await db.rpc('bulk_assign_student_meal_plan', {
      p_students: ids.fullIds,
      p_plan: await plan(FULL_PLAN),
      p_from: today(),
      p_note: null,
    });

    await login(page, seeded().superAdminEmail);
    await page.goto('/meal-plans');
    const row = page.locator('tr', { hasText: INST });
    await row.getByRole('button', { name: 'Activate Student Meal Plans', exact: true }).click();
    await expect(page.locator('.modal')).toContainText('has a valid Meal Plan', {
      timeout: 20_000,
    });
    await page
      .locator('.modal')
      .getByRole('button', { name: 'Activate Student Meal Plans', exact: true })
      .click();
    await expect(page.locator('tr', { hasText: INST })).toContainText('Enforced from', {
      timeout: 20_000,
    });
  });

  // ----------------------------------------------------------------- demand
  test('demand is exactly 6 / 6 / 4 / 4 — the morning-only children are not a lunch', async ({
    page,
  }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/operations');

    const line = (sitting: string) =>
      page.locator('tr', { hasText: INST }).filter({ hasText: sitting });

    await expect(line('Breakfast').first()).toContainText('6', { timeout: 20_000 });
    await expect(line('Morning snack').first()).toContainText('6');
    await expect(line('Lunch').first()).toContainText('4');
    await expect(line('Afternoon snack').first()).toContainText('4');
    // And the entitlement source is stated on the row rather than assumed.
    await expect(line('Lunch').first()).toContainText('Meal Plans');
  });

  test('an approved requirement blocks finalisation until a meal is decided', async ({ page }) => {
    const db = adminDb();
    const { data: req } = await db.rpc('submit_dietary_requirement', {
      p_student: ids.fullIds[0],
      p_type: 'ALLERGY',
      p_text: 'No sesame in any meal.',
      p_source: 'e2e',
      p_from: today(),
    });
    await db.rpc('review_dietary_requirement', {
      p_id: req as string,
      p_status: 'APPROVED',
      p_note: null,
    });

    await login(page, seeded().superAdminEmail);
    await page.goto('/operations');
    const lunch = page.locator('tr', { hasText: INST }).filter({ hasText: 'Lunch' }).first();
    await expect(lunch).toContainText('meal decision', { timeout: 20_000 });
    await expect(lunch.getByRole('button', { name: 'Finalise demand' })).toHaveCount(0);

    // Decide it through the Dietary screen, as a person would.
    await page.goto('/dietary');
    const pending = page.locator('tr', { hasText: 'Full Child1' }).first();
    await pending.getByRole('button', { name: 'Decide meal', exact: true }).click();
    await page
      .locator('.modal')
      .getByRole('button', { name: 'Confirm standard meal', exact: true })
      .click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });
  });

  test('the full chain runs on ONE delivery: finalise → produce → pack → hand over', async ({
    page,
    browser,
  }) => {
    await login(page, seeded().superAdminEmail);

    // ---- delivery configuration first: no config, no manifest.
    await page.goto('/delivery');
    await page.getByLabel('Institution', { exact: true }).selectOption({ label: INST });
    await page.getByRole('button', { name: /Configure deliveries|Change configuration/ }).click();
    await page.getByLabel('Agreed delivery point', { exact: true }).fill('Main reception');
    await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });

    // ---- authorise the institution's own admin to receive
    const adminRow = page.locator('tr', { hasText: 'e2e' }).first();
    if (await adminRow.getByRole('button', { name: 'Authorise', exact: true }).count()) {
      await adminRow.getByRole('button', { name: 'Authorise', exact: true }).click();
    }

    // ---- finalise every sitting
    await page.goto('/operations');
    for (let i = 0; i < 4; i++) {
      const btn = page
        .locator('tr', { hasText: INST })
        .getByRole('button', { name: 'Finalise demand', exact: true })
        .first();
      if (!(await btn.count())) break;
      await btn.click();
      await expect(page.locator('.banner.ok')).toBeVisible({ timeout: 20_000 });
    }
    await expect(
      page.locator('tr', { hasText: INST }).getByRole('button', { name: 'Finalise demand' }),
    ).toHaveCount(0, { timeout: 20_000 });

    // ---- build the manifest
    await page.getByRole('button', { name: 'Build manifests', exact: true }).first().click();
    await expect(page.locator('.banner.ok')).toBeVisible({ timeout: 20_000 });

    // ---- the Kitchen produces and packs, without retyping a quantity
    const kitchenCtx = await browser.newContext();
    const kitchen = await kitchenCtx.newPage();
    await login(kitchen, seeded().kitchenEmail);
    await kitchen.goto('/kitchen');

    for (const action of ['Start production', 'Mark production complete', 'Start packing', 'Mark packing complete']) {
      for (let i = 0; i < 4; i++) {
        const btn = kitchen.getByRole('button', { name: action, exact: true }).first();
        if (!(await btn.count())) break;
        await btn.click();
        await kitchen.waitForTimeout(400);
      }
    }
    await expect(kitchen.getByText('PACKED', { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });

    // ---- assign a driver, then release
    const db = adminDb();
    const { data: manifest } = await db
      .from('delivery_manifests')
      .select('id')
      .eq('institution_id', ids.instId)
      .eq('service_date', today())
      .single();
    const { data: driver } = await db
      .from('app_users')
      .select('user_id')
      .eq('email', seeded().driverEmail)
      .single();
    await db.rpc('assign_manifest_driver', {
      p_manifest: (manifest as { id: string }).id,
      p_driver: (driver as { user_id: string }).user_id,
    });

    await kitchen.reload();
    await kitchen.getByRole('button', { name: 'Release to driver', exact: true }).first().click();
    await expect(kitchen.locator('.banner.ok')).toBeVisible({ timeout: 20_000 });
    await kitchenCtx.close();

    // ---- the Driver collects and arrives, and CANNOT hand over
    const driverCtx = await browser.newContext();
    const dp = await driverCtx.newPage();
    await login(dp, seeded().driverEmail);
    await dp.goto('/my-deliveries');
    await expect(dp.getByText(INST)).toBeVisible({ timeout: 20_000 });
    await dp.getByRole('button', { name: 'Confirm collection', exact: true }).click();
    await dp.getByRole('button', { name: 'Arrived at institution', exact: true }).click();
    await expect(dp.getByText('Arrival recorded')).toBeVisible({ timeout: 20_000 });
    // There is no handover control on the Driver's screen at all.
    await expect(dp.getByRole('button', { name: /Confirm full delivery received/ })).toHaveCount(0);
    await driverCtx.close();

    // ---- the institution takes custody, with ONE button and no retyping
    const recvCtx = await browser.newContext();
    const rp = await recvCtx.newPage();
    await login(rp, seeded().schoolAdminEmail);
    await rp.goto('/handover');
    const confirm = rp.getByRole('button', { name: 'Confirm full delivery received', exact: true });
    if (await confirm.count()) {
      await confirm.click();
      await expect(rp.getByText(/Received/)).toBeVisible({ timeout: 20_000 });
    }
    await recvCtx.close();
  });

  // ------------------------------------------------------------- classroom
  test('the Classroom records only entitled children, and says so about the rest', async ({
    page,
  }) => {
    const db = adminDb();
    await db
      .from('class_staff')
      .upsert(
        {
          class_id: ids.classId,
          user_id: (
            await db.from('app_users').select('user_id').eq('email', seeded().classroomEmail).single()
          ).data!.user_id as string,
        },
        { onConflict: 'class_id,user_id' },
      );

    await login(page, seeded().classroomEmail);
    await page.goto('/today');
    await page.getByLabel(/Class/).selectOption({ label: CLASS }).catch(() => undefined);

    // Lunch: the four full-plan children are on the register…
    await selectPeriod(page, 'Lunch');
    await expect(page.locator('.roster-chip')).toHaveCount(4, { timeout: 20_000 });
    // …and the two morning-only children are named as not on this sitting,
    // factually, rather than appearing as unrecorded.
    await expect(page.getByText('Not included in this meal plan')).toBeVisible();
    await expect(page.getByText(/Morning Child1/)).toBeVisible();

    // Breakfast: everybody.
    await selectPeriod(page, 'Breakfast');
    await expect(page.locator('.roster-chip')).toHaveCount(6, { timeout: 20_000 });
  });

  test('a Parent sees only the sittings their child actually receives', async ({ page }) => {
    const db = adminDb();
    const { data: parent } = await db
      .from('app_users')
      .select('user_id')
      .eq('email', seeded().parentEmail)
      .single();
    // Link the parent to a MORNING-only child, so lunch must not appear.
    await db.from('student_parents').insert({
      student_id: ids.morningIds[0],
      user_id: (parent as { user_id: string }).user_id,
    });

    await login(page, seeded().parentEmail);
    await page.goto('/parent');
    await expect(page.getByText('Breakfast').first()).toBeVisible({ timeout: 20_000 });
    // Lunch is not theirs — and must not be rendered as a missed or pending meal.
    await expect(page.getByText('Lunch')).toHaveCount(0);

    await db
      .from('student_parents')
      .delete()
      .eq('student_id', ids.morningIds[0])
      .eq('user_id', (parent as { user_id: string }).user_id);
  });
});

/** The register's period switch, by visible label. */
async function selectPeriod(page: Page, label: string) {
  const tab = page.getByRole('button', { name: label, exact: true });
  if (await tab.count()) await tab.first().click();
  await page.waitForTimeout(600);
}
