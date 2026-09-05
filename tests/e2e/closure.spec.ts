import { expect, test, type Page } from 'playwright/test';
import {
  PASS,
  adminDb,
  e2eReady,
  login,
  removeInstitutionDay,
  seeded,
  settled,
  signedInDb,
} from './fixtures';

/**
 * OPERABILITY CLOSURE — the actions a person must be able to TAKE.
 *
 * `spine.spec.ts` proves one delivery a day works end to end. This proves the
 * six operations an independent inspection found were possible only from
 * outside the product: bulk Plan assignment, naming a Driver, working an issue
 * to a close, correcting a record, an Institution managing its own receivers,
 * and a two-run delivery day.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: the action under test is performed
 * THROUGH THE INTERFACE. Fixture creation may use the service key or a
 * signed-in RPC — building a day is not a business action — but the moment the
 * test reaches the step it is named after, it clicks. A direct RPC there would
 * prove the database rule for a second time and prove nothing at all about
 * whether the business can operate.
 *
 * DISPOSABLE FIXTURES ONLY. Two institutions, one class, five children, four
 * accounts, all created here and all removed afterwards.
 */

const stamp = Date.now();
const INST = `ZZ E2E Closure ${stamp}`;
const OTHER_INST = `ZZ E2E Closure Other ${stamp}`;
const CLASS = `ZZ Closure Class ${stamp}`;
const MORNING_PLAN = `ZZ C Morning ${stamp}`;
const FULL_PLAN = `ZZ C Full ${stamp}`;
const STD_MEAL = `ZZ Closure Standard ${stamp}`;

const ADMIN_EMAIL = `zz.closure.admin.${stamp}@lunchboxconnect.com`;
const ADMIN_NAME = `ZZ Closure Admin ${stamp}`;
const STAFF_EMAIL = `zz.closure.staff.${stamp}@lunchboxconnect.com`;
const STAFF_NAME = `ZZ Closure Staff ${stamp}`;
const OTHER_ADMIN_EMAIL = `zz.closure.other.${stamp}@lunchboxconnect.com`;
const OTHER_ADMIN_NAME = `ZZ Closure Other Admin ${stamp}`;
const OTHER_STAFF_EMAIL = `zz.closure.otherstaff.${stamp}@lunchboxconnect.com`;
const OTHER_STAFF_NAME = `ZZ Closure Other Staff ${stamp}`;
const PARENT_EMAIL = `zz.closure.parent.${stamp}@lunchboxconnect.com`;
const PARENT_NAME = `ZZ Closure Parent ${stamp}`;
/**
 * Two Drivers of this spec's own, not the shared fixture's.
 *
 * "The second Driver does not see it" is only a claim about THIS run if the
 * accounts making it carry no other work. The seeded Driver is used by
 * spine.spec.ts for a different institution's delivery on the same day.
 */
const DRIVER_A_EMAIL = `zz.closure.driver.a.${stamp}@lunchboxconnect.com`;
const DRIVER_A_NAME = `ZZ Closure Driver A ${stamp}`;
const DRIVER_B_EMAIL = `zz.closure.driver.b.${stamp}@lunchboxconnect.com`;
const DRIVER_B_NAME = `ZZ Closure Driver B ${stamp}`;

/** Asia/Dubai operational date, matching the rest of the product. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
}

type Ids = {
  instId: string;
  otherInstId: string;
  classId: string;
  morningIds: string[];
  fullIds: string[];
  accountIds: string[];
};

let ids: Ids;

function must<T>(what: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`fixture: ${what} failed — ${res.error.message}`);
  if (res.data === null) throw new Error(`fixture: ${what} returned no row`);
  return res.data;
}

test.describe('operability closure', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  // Bounded, because a bounded budget is what makes a failure REPORTABLE.
  // With no action timeout a single dead click used to eat four minutes and
  // the job's step cap killed the run before the reporter said which click it
  // was. playwright.config.ts now caps actions at 15s; this caps the test.
  test.setTimeout(150_000);
  // One day, lived in order, by several people. Retrying restarts halfway
  // through a day that has already been half lived, so the retry fails on
  // something the first attempt did.
  test.describe.configure({ mode: 'serial', retries: 0 });

  test.beforeAll(async () => {
    const db = adminDb();
    const sa = await signedInDb(seeded().superAdminEmail);

    const instId = must<{ id: string }>(
      'create institution',
      await db.from('institutions').insert({ name: INST, kind: 'nursery' }).select('id').single(),
    ).id;
    const otherInstId = must<{ id: string }>(
      'create the second institution',
      await db
        .from('institutions')
        .insert({ name: OTHER_INST, kind: 'nursery' })
        .select('id')
        .single(),
    ).id;

    const classId = must<{ id: string }>(
      'create class',
      await db
        .from('classes')
        .insert({ institution_id: instId, name: CLASS, grade: 'KG1' })
        .select('id')
        .single(),
    ).id;

    for (const id of [instId, otherInstId]) {
      must<Array<{ id: string }>>(
        'set the service plan',
        await db
          .from('institution_service_plans')
          .insert({
            institution_id: id,
            periods: ['breakfast', 'snack', 'lunch', 'afternoon_snack'],
            effective_from: today(),
          })
          .select('id'),
      );
    }

    // Five children: two morning-only, three full. 5 / 5 / 3 / 3 is a real
    // arithmetic claim and small enough to click through.
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => ({ tag: 'M', n: i + 1 })),
      ...Array.from({ length: 3 }, (_, i) => ({ tag: 'F', n: i + 1 })),
    ].map((r) => ({
      student_no: `ZC${stamp}${r.tag}${r.n}`,
      institution_id: instId,
      class_id: classId,
      given_name: r.tag === 'M' ? 'Morningkid' : 'Fullkid',
      family_name: `Closure${r.n}`,
      enrollment_status: 'enrolled',
      operational_status: 'ACTIVE_BILLABLE_TO_NURSERY',
    }));
    const all = must<Array<{ id: string; given_name: string }>>(
      'create children',
      await db.from('students').insert(rows).select('id, given_name'),
    );

    const mealId = must<string>(
      'create the standard meal',
      await sa.rpc('save_meal', {
        p_meal_id: null,
        p_name: STD_MEAL,
        p_ingredients: null,
        p_allergens: null,
        p_nutrition: null,
        p_portion: null,
        p_image_path: null,
        p_nutrition_status: 'NOT_APPROVED',
        p_periods: null,
      }),
    );
    const stdRev = must<{ current_revision_id: string | null }>(
      'read the meal revision',
      await db.from('meals').select('current_revision_id').eq('id', mealId).single(),
    ).current_revision_id as string;

    for (const period of ['breakfast', 'snack', 'lunch', 'afternoon_snack']) {
      must<{ id: string }>(
        `publish the ${period} service`,
        await db
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
          .single(),
      );
    }

    // The Plans themselves, and their availability at this site. Defining a
    // Plan is proved in spine.spec.ts; here it is setup for the ASSIGNMENT.
    const planId = async (name: string, periods: string[]) =>
      must<string>(
        `create plan ${name}`,
        await sa.rpc('save_meal_plan', { p_plan_id: null, p_name: name, p_periods: periods }),
      );
    const morningId = await planId(MORNING_PLAN, ['breakfast', 'snack']);
    const fullId = await planId(FULL_PLAN, ['breakfast', 'snack', 'lunch', 'afternoon_snack']);
    const avail = await sa.rpc('set_institution_meal_plans', {
      p_inst: instId,
      p_plans: [morningId, fullId],
    });
    if (avail.error) throw new Error(`fixture: make the Plans available — ${avail.error.message}`);

    const account = async (
      email: string,
      name: string,
      role: string,
      institution: string | null,
    ) => {
      const created = await db.auth.admin.createUser({
        email,
        password: PASS,
        email_confirm: true,
      });
      if (created.error || !created.data.user) {
        throw new Error(
          `fixture: create ${email} — ${created.error?.message ?? 'no user returned'}`,
        );
      }
      const userId = created.data.user.id;
      must<Array<{ user_id: string }>>(
        `create the app_users row for ${email}`,
        await db
          .from('app_users')
          .insert({
            user_id: userId,
            role,
            institution_id: institution,
            full_name: name,
            email,
          })
          .select('user_id'),
      );
      return userId;
    };

    const adminId = await account(ADMIN_EMAIL, ADMIN_NAME, 'school_admin', instId);
    const staffId = await account(STAFF_EMAIL, STAFF_NAME, 'classroom_staff', instId);
    const otherAdminId = await account(
      OTHER_ADMIN_EMAIL,
      OTHER_ADMIN_NAME,
      'school_admin',
      otherInstId,
    );
    const otherStaffId = await account(
      OTHER_STAFF_EMAIL,
      OTHER_STAFF_NAME,
      'classroom_staff',
      otherInstId,
    );
    const parentId = await account(PARENT_EMAIL, PARENT_NAME, 'parent', null);
    const driverAId = await account(DRIVER_A_EMAIL, DRIVER_A_NAME, 'driver', null);
    const driverBId = await account(DRIVER_B_EMAIL, DRIVER_B_NAME, 'driver', null);

    must<Array<{ class_id: string }>>(
      'assign the Classroom account to this class',
      await db
        .from('class_staff')
        .insert({ class_id: classId, user_id: staffId })
        .select('class_id'),
    );
    // A Parent exists because a child does. This one is linked so the portal is
    // real, and so "a Parent is never eligible to receive" is a claim about
    // somebody the institution can actually see.
    must<Array<{ student_id: string }>>(
      'link the parent to a child',
      await db
        .from('student_parents')
        .insert({ student_id: all[0].id, user_id: parentId })
        .select('student_id'),
    );

    ids = {
      instId,
      otherInstId,
      classId,
      morningIds: all.filter((s) => s.given_name === 'Morningkid').map((s) => s.id),
      fullIds: all.filter((s) => s.given_name === 'Fullkid').map((s) => s.id),
      accountIds: [adminId, staffId, otherAdminId, otherStaffId, parentId, driverAId, driverBId],
    };
  });

  test.afterAll(async () => {
    const db = adminDb();
    if (!ids) return;
    // The internal Kitchen issue carries no institution, so it is not reached
    // by the institution sweep. Removed by its own text.
    await db.from('operational_issues').delete().ilike('description', 'ZZ closure:%');
    await removeInstitutionDay(db, [ids.instId, ids.otherInstId]);
    await db.from('meals').delete().eq('name', STD_MEAL);
    await db.from('meal_plans').delete().in('name', [MORNING_PLAN, FULL_PLAN]);
    await db.from('app_users').delete().in('user_id', ids.accountIds);
    for (const id of ids.accountIds) await db.auth.admin.deleteUser(id);
  });

  // ------------------------------------------------------- bulk assignment
  test('a Super Admin assigns Meal Plans to many Students at once, by clicking', async ({
    page,
  }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/meal-plans');
    await settled(page);

    const row = page.locator('tr', { hasText: INST });
    const modal = page.locator('.modal');

    // ---- the two morning-only children
    await row.getByRole('button', { name: 'Assign Plans', exact: true }).click();
    await expect(modal).toContainText('one atomic operation', { timeout: 20_000 });
    // Every child starts with no Plan, and the filter says so rather than
    // making the operator read five rows to find out.
    await modal.getByLabel('Show', { exact: true }).selectOption({ label: 'Missing a Plan (5)' });
    await expect(modal.locator('tbody tr')).toHaveCount(5);
    for (const n of [1, 2]) {
      await modal.getByRole('checkbox', { name: `Morningkid Closure${n}`, exact: true }).check();
    }
    await modal.getByLabel('Meal Plan to assign', { exact: true }).selectOption({
      label: MORNING_PLAN,
    });
    // The review line is the last thing before the commit, and it is specific.
    await expect(modal).toContainText(`2 Students → ${MORNING_PLAN} from ${today()}`);
    await modal.getByRole('button', { name: 'Bulk Assign', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText('2 Students assigned.')).toBeVisible({ timeout: 20_000 });

    // ---- the three full-plan children, selected all at once
    await row.getByRole('button', { name: 'Assign Plans', exact: true }).click();
    await modal.getByLabel('Show', { exact: true }).selectOption({ label: 'Missing a Plan (3)' });
    await expect(modal.locator('tbody tr')).toHaveCount(3);
    await modal.getByRole('checkbox', { name: 'Select every Student shown' }).check();
    await modal.getByLabel('Meal Plan to assign', { exact: true }).selectOption({
      label: FULL_PLAN,
    });
    await modal.getByRole('button', { name: 'Bulk Assign', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText('3 Students assigned.')).toBeVisible({ timeout: 20_000 });

    // ---- it persists, and the screen can now answer "who is on what"
    await page.reload();
    await settled(page);
    await page
      .locator('tr', { hasText: INST })
      .getByRole('button', { name: 'Assign Plans' })
      .click();
    await expect(modal.locator('option', { hasText: 'Missing a Plan (0)' })).toHaveCount(1);
    await modal
      .getByLabel('Show', { exact: true })
      .selectOption({ label: `On ${MORNING_PLAN} (2)` });
    await expect(modal.locator('tbody tr')).toHaveCount(2);
    await modal.getByLabel('Show', { exact: true }).selectOption({ label: `On ${FULL_PLAN} (3)` });
    await expect(modal.locator('tbody tr')).toHaveCount(3);
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();

    // TWO atomic operations, not five single assignments. This spec never calls
    // bulk_assign_student_meal_plan; the audit rows can only have come from the
    // screen above, and there being exactly two of them proves the bulk path
    // rather than a loop of one-at-a-time saves.
    const sa = await signedInDb(seeded().superAdminEmail);
    const planIds = must<Array<{ id: string }>>(
      "find this spec's plans",
      await sa.from('meal_plans').select('id').in('name', [MORNING_PLAN, FULL_PLAN]),
    ).map((p) => p.id);
    const audit = must<Array<{ id: string }>>(
      'read the bulk-assignment audit',
      await sa
        .from('audit_log')
        .select('id')
        .eq('action', 'student.meal_plan_bulk_assigned')
        .in('entity_id', planIds),
    );
    expect(audit.length).toBe(2);
  });

  test('entitlement is activated, and demand is exactly 5 / 5 / 3 / 3', async ({ page }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/meal-plans');
    await settled(page);
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

    await page.goto('/operations');
    await settled(page);
    const line = (sitting: string) =>
      page.locator('tr', { hasText: INST }).filter({ hasText: sitting }).first();
    await expect(line('Breakfast')).toContainText('5', { timeout: 20_000 });
    await expect(line('Morning snack')).toContainText('5');
    await expect(line('Lunch')).toContainText('3');
    await expect(line('Afternoon snack')).toContainText('3');
    await expect(line('Lunch')).toContainText('Meal Plans');
  });

  // ---------------------------------------------------------- two delivery runs
  test('TWO delivery runs are configured, and each sitting travels on exactly one', async ({
    page,
  }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/delivery');
    await settled(page);
    await page.getByLabel('Institution', { exact: true }).selectOption({ label: INST });
    await page.getByRole('button', { name: /Configure deliveries|Change configuration/ }).click();

    const modal = page.locator('.modal');
    await modal.getByLabel('Agreed delivery point', { exact: true }).fill('Main reception');
    await modal.getByLabel('Deliveries per day', { exact: true }).selectOption({ label: 'Two' });
    // Morning food on the morning run, midday food on the midday run.
    await modal.getByLabel('Breakfast run', { exact: true }).selectOption({ label: 'Run 1' });
    await modal.getByLabel('Morning snack run', { exact: true }).selectOption({ label: 'Run 1' });
    await modal.getByLabel('Lunch run', { exact: true }).selectOption({ label: 'Run 2' });
    await modal.getByLabel('Afternoon snack run', { exact: true }).selectOption({ label: 'Run 2' });
    await modal.getByRole('button', { name: 'Save configuration', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Two deliveries a day')).toBeVisible({ timeout: 20_000 });

    // ---- finalise all four sittings, then build
    await page.goto('/operations');
    await settled(page);
    const required = page.locator('.card').filter({ hasText: 'Required today' });
    const instRows = required.locator('tr', { hasText: INST });
    await expect(instRows).toHaveCount(4, { timeout: 20_000 });
    for (let done = 1; done <= 4; done++) {
      const btn = instRows.getByRole('button', { name: 'Finalise demand', exact: true }).first();
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await btn.click();
      await expect(instRows.filter({ hasText: 'Finalised' })).toHaveCount(done, {
        timeout: 20_000,
      });
    }

    const build = page.getByRole('button', { name: 'Build manifests', exact: true }).first();
    await expect(build).toBeVisible({ timeout: 20_000 });
    await build.click();
    await expect(page.getByText('Delivery manifests built.')).toBeVisible({ timeout: 20_000 });

    // ---- two manifests, and the arithmetic is unchanged by the split
    const sa = await signedInDb(seeded().superAdminEmail);
    const manifests = must<Array<{ id: string; run_number: number }>>(
      'read the manifests',
      await sa
        .from('delivery_manifests')
        .select('id, run_number')
        .eq('institution_id', ids.instId)
        .eq('service_date', today())
        .order('run_number'),
    );
    expect(manifests.map((m) => m.run_number)).toEqual([1, 2]);

    const lines = must<Array<{ manifest_id: string; period: string; total_quantity: number }>>(
      'read the manifest lines',
      await sa
        .from('manifest_lines')
        .select('manifest_id, period, total_quantity')
        .in(
          'manifest_id',
          manifests.map((m) => m.id),
        ),
    );
    // Every serviced sitting on exactly one run, none on both, none missing.
    expect(lines.map((l) => l.period).sort()).toEqual([
      'afternoon_snack',
      'breakfast',
      'lunch',
      'snack',
    ]);
    const runOf = (period: string) =>
      manifests.find((m) => m.id === lines.find((l) => l.period === period)!.manifest_id)!
        .run_number;
    expect(runOf('breakfast')).toBe(1);
    expect(runOf('snack')).toBe(1);
    expect(runOf('lunch')).toBe(2);
    expect(runOf('afternoon_snack')).toBe(2);
    // And the totals are the entitlement, unchanged: transport grouping moved
    // no child onto or off any sitting.
    const qty = (period: string) => lines.find((l) => l.period === period)!.total_quantity;
    expect([qty('breakfast'), qty('snack'), qty('lunch'), qty('afternoon_snack')]).toEqual([
      5, 5, 3, 3,
    ]);
  });

  // ------------------------------------------------- the institution's receivers
  test('an Institution Admin manages its own receivers from a page it can reach', async ({
    page,
  }) => {
    await login(page, ADMIN_EMAIL);
    // Reached by normal navigation, not by knowing a URL: the sidebar entry
    // this role has is the way in.
    await page.getByRole('link', { name: "Today's delivery" }).click();
    await settled(page);

    const card = page.locator('.card').filter({ hasText: 'Who may receive a delivery' });
    await expect(card).toBeVisible({ timeout: 20_000 });

    // Eligibility is the institution's own Admin and Classroom Staff, and
    // nobody else — not the Parent, and not another site's staff.
    await expect(card.getByText(STAFF_NAME)).toBeVisible();
    await expect(card.getByText(ADMIN_NAME)).toBeVisible();
    await expect(card.getByText(PARENT_NAME)).toHaveCount(0);
    await expect(card.getByText(OTHER_STAFF_NAME)).toHaveCount(0);
    await expect(card.getByText(OTHER_ADMIN_NAME)).toHaveCount(0);

    const staffRow = card.locator('tr', { hasText: STAFF_NAME });
    await staffRow.getByRole('button', { name: 'Authorise', exact: true }).click();
    await expect(page.getByText('Authorised to receive deliveries.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(staffRow.getByRole('button', { name: 'Remove authorisation' })).toBeVisible();

    // Removing it is a real action too, not a one-way door.
    await staffRow.getByRole('button', { name: 'Remove authorisation', exact: true }).click();
    await expect(page.getByText('Receiver authorisation removed.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(staffRow.getByRole('button', { name: 'Authorise', exact: true })).toBeVisible();

    await staffRow.getByRole('button', { name: 'Authorise', exact: true }).click();
    await expect(page.getByText('Authorised to receive deliveries.')).toBeVisible({
      timeout: 20_000,
    });

    // ---- and this authority does NOT extend to the delivery arrangement
    await page.goto('/delivery');
    await settled(page);
    await expect(page.getByRole('button', { name: /Configure deliveries/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Change configuration/ })).toHaveCount(0);
    await expect(page.getByText('This is set by LunchBox')).toBeVisible({ timeout: 20_000 });
    // They can still READ what was agreed — that is the point of the screen.
    await expect(page.getByText('Two deliveries a day')).toBeVisible();
  });

  // ------------------------------------------------------- driver assignment
  test('a dispatcher names the Driver through the product, and only that Driver sees the run', async ({
    page,
    browser,
  }) => {
    await login(page, seeded().kitchenEmail);
    await page.goto('/kitchen');
    await settled(page);

    // A problem in the kitchen, raised before anything is cooked. It is used
    // below to prove the INTERNAL issue lifecycle.
    const firstRow = page.locator('tr').filter({ hasText: 'Report issue' }).first();
    await firstRow.getByRole('button', { name: 'Report issue', exact: true }).click();
    await page
      .locator('.modal')
      .getByLabel('What happened', { exact: true })
      .fill('ZZ closure: one oven was down for forty minutes');
    await page.locator('.modal').getByRole('button', { name: 'Report issue', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });

    // ---- produce and pack all four sittings
    //
    // The count is asserted before the loop rather than assumed: the Kitchen's
    // production table shows every site finalised for this date, so a loop that
    // clicked "the first button" while another spec's demand was also waiting
    // would advance THEIR day. Four is this institution's four.
    // ---- the production line says WHICH SITE it is for.
    //
    // Finding 17, closed by 0055. `final_demand` carries institution_id and the
    // Kitchen cannot read `institutions`, so the name has to be projected — the
    // same defect, one screen along, that left the Dispatch row blank. With two
    // sites serving Lunch the rows are otherwise identical, and the actions
    // beside them are the ones that must not touch the wrong site's food.
    const prodCard = page.locator('.card').filter({ hasText: 'exact Final Demand' });
    await expect(prodCard.getByText(INST).first()).toBeVisible({ timeout: 20_000 });

    // Since 0055 each action names the SITE and the SITTING it belongs to, so
    // this scopes to THIS institution by name rather than trusting that no
    // other site is mid-production. The hazard above is now closed by the
    // selector itself, not by a count that happened to be right.
    const mine = (action: string) => page.getByRole('button', { name: `${action} — ${INST}` });

    await expect(mine('Start production')).toHaveCount(4, { timeout: 20_000 });
    for (const action of [
      'Start production',
      'Mark production complete',
      'Start packing',
      'Mark packing complete',
    ]) {
      for (let remaining = 4; remaining >= 1; remaining--) {
        const btn = mine(action).first();
        await expect(btn).toBeVisible({ timeout: 20_000 });
        await btn.click();
        await expect(mine(action)).toHaveCount(remaining - 1, { timeout: 20_000 });
      }
    }

    const dispatch = page.locator('.card').filter({ hasText: 'name a driver, then release' });

    // ---- the run says where it is GOING.
    //
    // It did not until 0054. The Kitchen may read every manifest and may not
    // read `institutions`, and PostgREST returns an unreadable embed as null,
    // so the site was blank on the Dispatch row and blank on the label the
    // packing bench prints. Asserted here as a fact about the screen, and
    // relied on below by the Driver selector's own label.
    await expect(dispatch.getByText(INST).first()).toBeVisible({ timeout: 20_000 });

    // ---- the prerequisite is stated BEFORE the click, not discovered after it
    await expect(dispatch.getByText('Assign a Driver before releasing').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(dispatch.getByRole('button', { name: 'Release to driver' })).toHaveCount(0);

    // ---- name the Driver, by clicking, on both runs
    for (const run of [1, 2]) {
      const row = dispatch.locator('tr').filter({
        has: page.getByLabel(`Driver for ${INST} run ${run}`, { exact: true }),
      });
      await expect(row).toHaveCount(1, { timeout: 20_000 });
      await row.locator('select').selectOption({ label: DRIVER_A_NAME });
      await row.getByRole('button', { name: 'Assign driver', exact: true }).click();
      await expect(page.getByText('Driver assigned.')).toBeVisible({ timeout: 20_000 });
    }
    // It persists across a reload, and the screen says who is carrying it.
    await page.reload();
    await settled(page);
    await expect(dispatch.getByText(DRIVER_A_NAME).first()).toBeVisible({ timeout: 20_000 });
    await expect(dispatch.getByText('Assign a Driver before releasing')).toHaveCount(0);

    // ---- release RUN 1 ONLY. Run 2 stays in the yard.
    const run1 = dispatch.locator('tr').filter({
      has: page.getByLabel(`Driver for ${INST} run 1`, { exact: true }),
    });
    await expect(run1).toHaveCount(1, { timeout: 20_000 });

    // ---- the label the bench prints carries the destination.
    //
    // Before the release, deliberately: the packing bench labels a crate while
    // it is still in the yard, and once a manifest is RELEASED the driver
    // selector is correctly gone — so the row this locator is built from stops
    // existing. That is the product behaving properly, and the test has to
    // follow the same order the work does.
    await run1.getByRole('button', { name: 'View / print labels', exact: true }).click();
    await expect(page.locator('.modal')).toContainText(INST, { timeout: 20_000 });
    // Scoped to the footer: the dialog has a Close BUTTON there, and the modal
    // chrome has an X carrying aria-label="Close", so both share the accessible
    // name. The footer one is what a person clicks.
    await page.locator('.modal-foot').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });

    await run1.getByRole('button', { name: 'Release to driver', exact: true }).click();
    await expect(page.getByText('Released to the driver.')).toBeVisible({ timeout: 20_000 });

    // ---- the named Driver sees the work; the other Driver sees none of it
    const bCtx = await browser.newContext();
    const bp = await bCtx.newPage();
    await login(bp, DRIVER_B_EMAIL);
    await bp.goto('/my-deliveries');
    await settled(bp);
    await expect(bp.getByText('No deliveries are assigned to you.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(bp.getByText(INST)).toHaveCount(0);
    await bCtx.close();

    // ---- and nobody outside LunchBox can name a Driver at all
    for (const email of [ADMIN_EMAIL, PARENT_EMAIL]) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await login(p, email);
      await p.goto('/kitchen');
      // The route gate sends them to their own first page rather than showing
      // a dispatch screen they may not act on.
      await expect(p).not.toHaveURL(/\/kitchen$/, { timeout: 20_000 });
      await expect(p.getByRole('button', { name: /Assign driver|Change driver/ })).toHaveCount(0);
      await ctx.close();
    }
  });

  test('run 1 completes handover independently of run 2', async ({ page, browser }) => {
    // ---- the Driver carries run 1
    await login(page, DRIVER_A_EMAIL);
    await page.goto('/my-deliveries');
    await settled(page);
    await expect(page.getByText(INST).first()).toBeVisible({ timeout: 20_000 });
    const collect = page.getByRole('button', { name: 'Confirm collection', exact: true });
    await expect(collect).toBeVisible({ timeout: 20_000 });
    await collect.click();
    const arrive = page.getByRole('button', { name: 'Arrived at institution', exact: true });
    await expect(arrive).toBeVisible({ timeout: 20_000 });
    await arrive.click();
    await expect(page.locator('.banner.ok')).toHaveText('Arrival recorded.', { timeout: 20_000 });

    // ---- the authorised Classroom Staff member takes custody — and reports a
    // shortage at the same time, which is the ONE path that records both.
    const ctx = await browser.newContext();
    const rp = await ctx.newPage();
    await login(rp, STAFF_EMAIL);
    await rp.goto('/handover');
    await settled(rp);
    const report = rp.getByRole('button', { name: 'Report delivery issue', exact: true });
    await expect(report).toBeVisible({ timeout: 20_000 });
    await report.click();
    await rp
      .locator('.modal')
      .getByLabel('What kind of issue', { exact: true })
      .selectOption({ label: 'Missing Item' });
    await rp
      .locator('.modal')
      .getByLabel('What happened', { exact: true })
      .fill('ZZ closure: two breakfast packs short');
    await rp.locator('.modal').getByRole('button', { name: 'Accept delivery with issue' }).click();
    await expect(rp.getByText('HANDED OVER').first()).toBeVisible({ timeout: 20_000 });
    await ctx.close();

    // ---- run 2 is untouched by any of that
    const sa = await signedInDb(seeded().superAdminEmail);
    const states = must<Array<{ run_number: number; state: string }>>(
      'read both manifest states',
      await sa
        .from('delivery_manifests')
        .select('run_number, state')
        .eq('institution_id', ids.instId)
        .eq('service_date', today())
        .order('run_number'),
    );
    expect(states).toEqual([
      { run_number: 1, state: 'HANDED_OVER' },
      { run_number: 2, state: 'READY_FOR_DISPATCH' },
    ]);
  });

  // ---------------------------------------------------------- issue lifecycle
  test('a delivery issue is actioned, acknowledged and closed — each step by its own party', async ({
    page,
    browser,
  }) => {
    // ---- LunchBox actions it, and must say what was done
    await login(page, seeded().superAdminEmail);
    await page.goto('/operations');
    await settled(page);
    // Scoped by the hint: "Issues" alone also matches the Reconciliation
    // card, which carries an Issues COLUMN.
    const issues = page.locator('.card').filter({ hasText: 'Open → actioned' });
    const row = issues.locator('tr', { hasText: 'two breakfast packs short' });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText('OPEN');
    // An open issue is not closeable — the control is not offered at all.
    await expect(row.getByRole('button', { name: 'Close issue' })).toHaveCount(0);

    await row.getByRole('button', { name: 'Action issue', exact: true }).click();
    const modal = page.locator('.modal');
    // The note is required, and the dialog says so instead of failing later.
    await expect(modal.getByRole('button', { name: 'Action issue', exact: true })).toBeDisabled();
    await modal
      .getByLabel('What was done about it', { exact: true })
      .fill('Two breakfast packs redelivered at 08:55');
    await modal.getByRole('button', { name: 'Action issue', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });
    await expect(
      page.getByText('Issue actioned. The institution can now acknowledge it.'),
    ).toBeVisible({ timeout: 20_000 });

    // ---- the institution acknowledges, on its own screen
    const ctx = await browser.newContext();
    const ip = await ctx.newPage();
    await login(ip, ADMIN_EMAIL);
    await ip.goto('/handover');
    await settled(ip);
    const theirs = ip.locator('tr', { hasText: 'two breakfast packs short' });
    await expect(theirs).toContainText('Two breakfast packs redelivered at 08:55', {
      timeout: 20_000,
    });
    await theirs.getByRole('button', { name: 'Acknowledge resolution', exact: true }).click();
    await ip.locator('.modal').getByRole('button', { name: 'Acknowledge resolution' }).click();
    await expect(ip.getByText('LunchBox has been told you are satisfied')).toBeVisible({
      timeout: 20_000,
    });
    await expect(ip.locator('tr', { hasText: 'two breakfast packs short' })).toContainText(
      'INSTITUTION ACKNOWLEDGED',
      { timeout: 20_000 },
    );
    // Acknowledging is not closing: the institution is never offered that.
    await expect(
      ip.locator('tr', { hasText: 'two breakfast packs short' }).getByRole('button', {
        name: 'Close issue',
      }),
    ).toHaveCount(0);
    await ctx.close();

    // ---- another institution can neither see nor touch it
    const otherCtx = await browser.newContext();
    const op = await otherCtx.newPage();
    await login(op, OTHER_ADMIN_EMAIL);
    await op.goto('/handover');
    await settled(op);
    await expect(op.getByText('two breakfast packs short')).toHaveCount(0);
    await otherCtx.close();

    // ---- LunchBox closes it
    await page.goto('/operations');
    await settled(page);
    const settledRow = issues.locator('tr', { hasText: 'two breakfast packs short' });
    await expect(settledRow).toContainText('INSTITUTION ACKNOWLEDGED', { timeout: 20_000 });
    await settledRow.getByRole('button', { name: 'Close issue', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Close issue', exact: true }).click();
    await expect(page.getByText('Issue closed.')).toBeVisible({ timeout: 20_000 });
    await expect(issues.locator('tr', { hasText: 'two breakfast packs short' })).toContainText(
      'CLOSED',
      { timeout: 20_000 },
    );
    // A closed issue offers no further action.
    await expect(
      issues
        .locator('tr', { hasText: 'two breakfast packs short' })
        .getByRole('button', { name: /Action issue|Close issue/ }),
    ).toHaveCount(0);
  });

  test('an internal Kitchen issue never reaches the institution, and closes once actioned', async ({
    page,
    browser,
  }) => {
    // ---- the institution cannot see it
    const ctx = await browser.newContext();
    const ip = await ctx.newPage();
    await login(ip, ADMIN_EMAIL);
    await ip.goto('/handover');
    await settled(ip);
    await expect(ip.getByText('one oven was down')).toHaveCount(0);
    await ctx.close();

    // ---- and an OPEN issue cannot be jumped straight to closed, even by
    // LunchBox and even from outside the screen. The interface never offers
    // it; this asks the database directly, which is the boundary that counts.
    const sa = await signedInDb(seeded().superAdminEmail);
    const internal = must<Array<{ id: string }>>(
      'find the internal issue',
      await sa
        .from('operational_issues')
        .select('id')
        .eq('stage', 'PRODUCTION')
        .ilike('description', '%one oven was down%'),
    );
    expect(internal.length).toBe(1);
    const jumped = await sa.rpc('advance_operational_issue', {
      p_id: internal[0].id,
      p_status: 'CLOSED',
      p_resolution: 'skipping the middle',
    });
    expect(jumped.error?.message ?? '').toContain('Action this issue before closing it');

    // ---- the Kitchen works it on its own screen: action, then close
    await login(page, seeded().kitchenEmail);
    await page.goto('/kitchen');
    await settled(page);
    const kitchenIssues = page.locator('.card').filter({ hasText: 'what was raised for this day' });
    const row = kitchenIssues.locator('tr', { hasText: 'one oven was down' });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Action issue', exact: true }).click();
    await page
      .locator('.modal')
      .getByLabel('What was done about it', { exact: true })
      .fill('Second oven used; nothing left the kitchen late');
    await page.locator('.modal').getByRole('button', { name: 'Action issue', exact: true }).click();
    await expect(page.getByText('Issue actioned.')).toBeVisible({ timeout: 20_000 });

    const actioned = kitchenIssues.locator('tr', { hasText: 'one oven was down' });
    await expect(actioned).toContainText('LUNCHBOX ACTIONED', { timeout: 20_000 });
    await actioned.getByRole('button', { name: 'Close issue', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Close issue', exact: true }).click();
    await expect(page.getByText('Issue closed.')).toBeVisible({ timeout: 20_000 });
    await expect(kitchenIssues.locator('tr', { hasText: 'one oven was down' })).toContainText(
      'CLOSED',
      {
        timeout: 20_000,
      },
    );
  });

  // --------------------------------------------------------------- correction
  test('a Super Admin corrects an allow-listed record, and the original survives', async ({
    page,
    browser,
  }) => {
    await login(page, seeded().superAdminEmail);
    await page.goto('/operations');
    await settled(page);

    // ---- the delivery point of a manifest
    const deliveries = page
      .locator('.card')
      .filter({ hasText: 'Manifests derive from finalised demand' });
    const manifestRow = deliveries.locator('tr', { hasText: 'Main reception' }).first();
    await expect(manifestRow).toBeVisible({ timeout: 20_000 });
    await manifestRow.getByRole('button', { name: 'Correct record', exact: true }).click();

    const modal = page.locator('.modal');
    await expect(modal).toContainText('kept in Audit');
    // A reason is required, and so is an actual change.
    await expect(modal.getByRole('button', { name: 'Correct record', exact: true })).toBeDisabled();
    await modal
      .getByLabel('Delivery point — corrected value', { exact: true })
      .fill('Side gate, kitchen entrance');
    await expect(modal.getByRole('button', { name: 'Correct record', exact: true })).toBeDisabled();
    await modal
      .getByLabel('Reason (required)', { exact: true })
      .fill('Reception closed for building work');
    await modal.getByRole('button', { name: 'Correct record', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('The previous value is preserved in Audit')).toBeVisible({
      timeout: 20_000,
    });
    await expect(deliveries.getByText('Side gate, kitchen entrance').first()).toBeVisible({
      timeout: 20_000,
    });

    // ---- and the original is genuinely still readable
    const sa = await signedInDb(seeded().superAdminEmail);
    const audit = must<Array<{ previous_value: Record<string, string>; reason: string }>>(
      'read the correction audit',
      await sa
        .from('audit_log')
        .select('previous_value, reason')
        .eq('action', 'record.corrected')
        // audit_log stamps `occurred_at`, not created_at — it records when the
        // thing HAPPENED, which is the question an audit answers.
        .order('occurred_at', { ascending: false })
        .limit(5),
    );
    const mine = audit.find((a) => a.previous_value?.delivery_point === 'Main reception');
    expect(mine?.reason).toBe('Reception closed for building work');

    // ---- an unsupported field is refused. The screen offers exactly three
    // corrections and no field picker, so this asks the database what would
    // happen if something else tried.
    const refused = await sa.rpc('correct_operational_record', {
      p_entity: 'delivery_manifests',
      p_id: must<Array<{ id: string }>>(
        'find a manifest',
        await sa.from('delivery_manifests').select('id').eq('institution_id', ids.instId).limit(1),
      )[0].id,
      p_field: 'state',
      p_value: 'PREPARING',
      p_reason: 'rewinding the day',
    });
    expect(refused.error?.message ?? '').toContain('not correctable');

    // ---- and correction is not an authority the institution holds
    const ctx = await browser.newContext();
    const ip = await ctx.newPage();
    await login(ip, ADMIN_EMAIL);
    await ip.goto('/operations');
    await expect(ip).not.toHaveURL(/\/operations$/, { timeout: 20_000 });
    await expect(ip.getByRole('button', { name: 'Correct record' })).toHaveCount(0);
    await ctx.close();
  });

  // ------------------------------------------------------- the legacy URL
  test('the old /deliveries URL lands on the screen that role actually works in', async ({
    browser,
  }) => {
    const cases: Array<[string, RegExp]> = [
      [seeded().superAdminEmail, /\/operations$/],
      [DRIVER_A_EMAIL, /\/my-deliveries$/],
      [ADMIN_EMAIL, /\/handover$/],
      [STAFF_EMAIL, /\/handover$/],
    ];
    for (const [email, destination] of cases) {
      const ctx = await browser.newContext();
      const p: Page = await ctx.newPage();
      await login(p, email);
      await p.goto('/deliveries');
      await expect(p).toHaveURL(destination, { timeout: 20_000 });
      // And nowhere in the product does it still claim delivery is unbuilt.
      await expect(p.getByText('not built')).toHaveCount(0);
      await ctx.close();
    }
  });
});
