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
  receiverId: string;
  staffId: string;
  guardianId: string;
};

/**
 * The Authorized Delivery Receiver must be one of THIS institution's own
 * active Admins or Classroom Staff — that is the rule in 0052, and it is the
 * point of the capability. The shared fixture's Institution Admin belongs to a
 * different site and is therefore correctly ineligible here, so this spec
 * creates an Admin of its own rather than skipping the handover it exists to
 * prove.
 */
const RECEIVER_EMAIL = `zz.spine.receiver.${stamp}@lunchboxconnect.com`;
// The receivers table shows a person's NAME, not their address.
const RECEIVER_NAME = `ZZ Spine Receiver ${stamp}`;

/**
 * Classroom Staff of THIS institution, for the same reason as the receiver:
 * class_staff refuses a staff member from another institution (0032/0043), so
 * the shared fixture's Classroom account cannot be assigned to this spec's
 * class. It is not a defect — it is the tenant boundary doing its job.
 */
const STAFF_EMAIL = `zz.spine.staff.${stamp}@lunchboxconnect.com`;
const STAFF_NAME = `ZZ Spine Staff ${stamp}`;

/**
 * A guardian of THIS spec's morning-only child, and of nobody else.
 *
 * The shared fixture's Parent already has a child at another institution, so
 * linking a second one made the portal show a child switcher and open on the
 * wrong child — the screen was right about a child this test was not asking
 * about. A guardian account exists because there is a child; this one has
 * exactly the child whose entitlement is the subject.
 */
const GUARDIAN_EMAIL = `zz.spine.guardian.${stamp}@lunchboxconnect.com`;
const GUARDIAN_NAME = `ZZ Spine Guardian ${stamp}`;

let ids: Ids;

/**
 * Every fixture insert is checked. An unchecked one fails silently and the
 * symptom surfaces later, in another test, as "cannot read properties of
 * null" — cause and evidence end up in different files.
 */
function must<T>(what: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`fixture: ${what} failed — ${res.error.message}`);
  if (res.data === null) throw new Error(`fixture: ${what} returned no row`);
  return res.data;
}

test.describe('operational spine', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');
  test.setTimeout(180_000);
  // Serial AND unretried. These tests share one day's state on purpose — the
  // chain is the subject — so a retry restarts in the middle of a day that has
  // already been half lived: demand finalised, a manifest built, custody taken.
  // The retry then fails on something the first attempt did, which is how a
  // real defect gets reported as "Cannot coerce the result to a single JSON
  // object" three screens away from its cause.
  test.describe.configure({ mode: 'serial', retries: 0 });

  test.beforeAll(async () => {
    const db = adminDb();
    const sa = await signedInDb(seeded().superAdminEmail);

    const instId = must<{ id: string }>(
      'create institution',
      await db.from('institutions').insert({ name: INST, kind: 'nursery' }).select('id').single(),
    ).id;

    const classId = must<{ id: string }>(
      'create class',
      await db
        .from('classes')
        .insert({ institution_id: instId, name: CLASS, grade: 'KG1' })
        .select('id')
        .single(),
    ).id;

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
    const all = must<Array<{ id: string; given_name: string }>>(
      'create children',
      await db.from('students').insert(rows).select('id, given_name'),
    );

    // Meals, then a published service for each of the four sittings.
    //
    // save_meal() is gated on app_is_super_admin(), so it is called as one —
    // see signedInDb(). Called through adminDb() it would raise, PostgREST
    // would hand the error back in `error` rather than throw, and the null id
    // would surface two calls later as "cannot read properties of null".
    const makeMeal = async (name: string) => {
      const mealId = must<string>(
        `create meal ${name}`,
        await sa.rpc('save_meal', {
          p_meal_id: null,
          p_name: name,
          p_ingredients: null,
          p_allergens: null,
          p_nutrition: null,
          p_portion: null,
          p_image_path: null,
          p_nutrition_status: 'NOT_APPROVED',
          p_periods: null,
        }),
      );
      return must<{ current_revision_id: string | null }>(
        `read the revision of ${name}`,
        await db.from('meals').select('current_revision_id').eq('id', mealId).single(),
      ).current_revision_id as string;
    };
    const stdRev = await makeMeal(STD_MEAL);
    await makeMeal(ALT_MEAL);

    const serviceIds: Record<string, string> = {};
    for (const period of ['breakfast', 'snack', 'lunch', 'afternoon_snack']) {
      serviceIds[period] = must<{ id: string }>(
        `publish ${period} service`,
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
      ).id;
    }

    // This institution's own Admin — the only kind of person eligible to
    // receive a delivery here.
    const receiver = await db.auth.admin.createUser({
      email: RECEIVER_EMAIL,
      password: PASS,
      email_confirm: true,
    });
    if (receiver.error || !receiver.data.user) {
      throw new Error(
        `fixture: create the receiver account — ${receiver.error?.message ?? 'no user returned'}`,
      );
    }
    const receiverId = receiver.data.user.id;
    must<Array<{ user_id: string }>>(
      'create the receiver app_users row',
      await db
        .from('app_users')
        .insert({
          user_id: receiverId,
          role: 'school_admin',
          institution_id: instId,
          full_name: RECEIVER_NAME,
          email: RECEIVER_EMAIL,
        })
        .select('user_id'),
    );

    const staffAccount = await db.auth.admin.createUser({
      email: STAFF_EMAIL,
      password: PASS,
      email_confirm: true,
    });
    if (staffAccount.error || !staffAccount.data.user) {
      throw new Error(
        `fixture: create the Classroom account — ${staffAccount.error?.message ?? 'no user returned'}`,
      );
    }
    const staffId = staffAccount.data.user.id;
    must<Array<{ user_id: string }>>(
      'create the Classroom app_users row',
      await db
        .from('app_users')
        .insert({
          user_id: staffId,
          role: 'classroom_staff',
          institution_id: instId,
          full_name: STAFF_NAME,
          email: STAFF_EMAIL,
        })
        .select('user_id'),
    );
    must<Array<{ class_id: string }>>(
      'assign the Classroom account to this class',
      await db
        .from('class_staff')
        .insert({ class_id: classId, user_id: staffId })
        .select('class_id'),
    );

    const guardian = await db.auth.admin.createUser({
      email: GUARDIAN_EMAIL,
      password: PASS,
      email_confirm: true,
    });
    if (guardian.error || !guardian.data.user) {
      throw new Error(
        `fixture: create the guardian account — ${guardian.error?.message ?? 'no user returned'}`,
      );
    }
    const guardianId = guardian.data.user.id;
    must<Array<{ user_id: string }>>(
      'create the guardian app_users row',
      await db
        .from('app_users')
        .insert({
          user_id: guardianId,
          role: 'parent',
          full_name: GUARDIAN_NAME,
          email: GUARDIAN_EMAIL,
        })
        .select('user_id'),
    );
    const morningFirst = all.filter((s) => s.given_name === 'Morning')[0];
    must<Array<{ student_id: string }>>(
      'link the guardian to the morning-only child',
      await db
        .from('student_parents')
        .insert({ student_id: morningFirst.id, user_id: guardianId })
        .select('student_id'),
    );

    ids = {
      instId,
      classId,
      morningIds: all.filter((s) => s.given_name === 'Morning').map((s) => s.id),
      fullIds: all.filter((s) => s.given_name === 'Full').map((s) => s.id),
      serviceIds,
      receiverId,
      staffId,
      guardianId,
    };
  });

  test.afterAll(async () => {
    const db = adminDb();
    // Cleanup must not mask a setup failure: if beforeAll threw, `ids` was
    // never assigned, and the only thing an unguarded teardown adds is a
    // second, unrelated error on top of the real one.
    if (!ids) return;
    // Reverse order of creation so nothing is left referencing a deleted row.
    //
    // This used to end at `delete from institutions`, which is REFUSED once a
    // day has actually been lived: delivery_manifests.institution_id is
    // `on delete restrict`. PostgREST returns the refusal in `error` rather
    // than throwing, so the teardown looked like it worked and the institution
    // survived into the next spec.
    await removeInstitutionDay(db, [ids.instId]);
    await db.from('meals').delete().in('name', [STD_MEAL, ALT_MEAL]);
    await db.from('meal_plans').delete().in('name', [MORNING_PLAN, FULL_PLAN]);
    await db
      .from('app_users')
      .delete()
      .in('user_id', [ids.receiverId, ids.staffId, ids.guardianId]);
    await db.auth.admin.deleteUser(ids.receiverId);
    await db.auth.admin.deleteUser(ids.staffId);
    await db.auth.admin.deleteUser(ids.guardianId);
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
    await login(page, seeded().superAdminEmail);
    await page.goto('/meal-plans');
    await settled(page);

    // Assigned through the BULK screen, because that is how a real site is
    // onboarded and because it is now a screen. This used to call
    // bulk_assign_student_meal_plan directly, which proved the rule a second
    // time and proved nothing about whether anyone could reach it — and for a
    // whole release, nobody could.
    const modal = page.locator('.modal');
    const assign = async (names: string[], planName: string) => {
      await page
        .locator('tr', { hasText: INST })
        .getByRole('button', { name: 'Assign Plans', exact: true })
        .click();
      await expect(modal).toContainText('one atomic operation', { timeout: 20_000 });
      for (const name of names) {
        await modal.getByRole('checkbox', { name, exact: true }).check();
      }
      await modal
        .getByLabel('Meal Plan to assign', { exact: true })
        .selectOption({ label: planName });
      await modal.getByRole('button', { name: 'Bulk Assign', exact: true }).click();
      await expect(page.locator('.modal')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText(`${names.length} Students assigned.`)).toBeVisible({
        timeout: 20_000,
      });
    };
    await assign(['Morning Child1', 'Morning Child2'], MORNING_PLAN);
    await assign(
      ['Full Child1', 'Full Child2', 'Full Child3', 'Full Child4'],
      FULL_PLAN,
    );

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
    // Both of these are gated — submission on managing the institution, review
    // on being a Super Admin — so both go through a signed-in account.
    const sa = await signedInDb(seeded().superAdminEmail);
    const req = must<string>(
      'submit the dietary requirement',
      await sa.rpc('submit_dietary_requirement', {
        p_student: ids.fullIds[0],
        p_type: 'ALLERGY',
        p_text: 'No sesame in any meal.',
        p_source: 'e2e',
        p_from: today(),
      }),
    );
    const review = await sa.rpc('review_dietary_requirement', {
      p_id: req,
      p_status: 'APPROVED',
      p_note: null,
    });
    if (review.error) throw new Error(`fixture: approve the requirement — ${review.error.message}`);

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
    await settled(page);
    await page.getByLabel('Institution', { exact: true }).selectOption({ label: INST });
    await page.getByRole('button', { name: /Configure deliveries|Change configuration/ }).click();
    await page.getByLabel('Agreed delivery point', { exact: true }).fill('Main reception');
    await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });

    // ---- authorise this institution's own Admin to receive. Not optional:
    // without it nobody can take custody, and a conditional click would let
    // the handover below be skipped rather than proved.
    const adminRow = page.locator('tr', { hasText: RECEIVER_NAME }).first();
    await expect(adminRow.getByRole('button', { name: 'Authorise', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await adminRow.getByRole('button', { name: 'Authorise', exact: true }).click();

    // ---- an approved requirement needs a decision for EVERY entitled sitting,
    // and this child holds the full Plan, so that is four. The previous test
    // made the first one; nothing can be finalised until the rest are made.
    //
    // The loop is driven from OPERATIONS, not from Dietary, and each round
    // starts with a fresh page. Dietary loads the day's services first and each
    // service's outstanding decisions second, and its "nothing outstanding"
    // empty state is also what an unloaded screen looks like — so neither its
    // buttons nor its empty state can be read as a settled fact. Operations
    // has one load and an unambiguous shape: four rows for this institution,
    // each either finalisable or carrying an outstanding-decision pill.
    const required = page.locator('.card').filter({ hasText: 'Required today' });
    const instRows = required.locator('tr', { hasText: INST });
    const decisions = page
      .locator('.card')
      .filter({ hasText: 'Meal decisions blocking production' });

    for (let round = 0; round < 6; round++) {
      await page.goto('/operations');
      await settled(page);
      await expect(instRows).toHaveCount(4, { timeout: 20_000 });
      const blocked = instRows.filter({ hasText: 'meal decision' });
      if ((await blocked.count()) === 0) break;

      // Operations has just said a decision is outstanding, so Dietary must be
      // able to offer it. If it cannot, the two views disagree about the same
      // fact and that is a defect worth failing on, not waiting out.
      await page.goto('/dietary');
      await settled(page);
      const decide = decisions.getByRole('button', { name: 'Decide meal', exact: true }).first();
      await expect(decide).toBeVisible({ timeout: 20_000 });
      await decide.click();
      await page
        .locator('.modal')
        .getByRole('button', { name: 'Confirm standard meal', exact: true })
        .click();
      await expect(page.locator('.modal')).toHaveCount(0, { timeout: 20_000 });
    }

    // ---- finalise every sitting
    await page.goto('/operations');
    await settled(page);
    await expect(instRows).toHaveCount(4, { timeout: 20_000 });
    await expect(instRows.filter({ hasText: 'meal decision' })).toHaveCount(0, { timeout: 20_000 });

    // Four sittings, four rounds, and each round waits for the count of
    // FINALISED rows to reach it. No count() guard: "no button" is also what an
    // unloaded table and a half-rendered one look like, so a loop that exits on
    // it can finalise nothing and still reach the next line.
    for (let done = 1; done <= 4; done++) {
      const btn = instRows.getByRole('button', { name: 'Finalise demand', exact: true }).first();
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await btn.click();
      await expect(instRows.filter({ hasText: 'Finalised' })).toHaveCount(done, {
        timeout: 20_000,
      });
    }

    // ---- build the manifest
    const build = page.getByRole('button', { name: 'Build manifests', exact: true }).first();
    await expect(build).toBeVisible({ timeout: 20_000 });
    await build.click();
    await expect(page.locator('.banner.ok')).toBeVisible({ timeout: 20_000 });

    // ---- the Kitchen produces and packs, without retyping a quantity
    const kitchenCtx = await browser.newContext();
    const kitchen = await kitchenCtx.newPage();
    await login(kitchen, seeded().kitchenEmail);
    await kitchen.goto('/kitchen');
    await settled(kitchen);
    // Scoped to THIS institution: since 0055 every production action names the
    // site it belongs to, so a second site finalised for the same date cannot
    // be advanced by this spec.
    const mine = (action: string) =>
      kitchen.getByRole('button', { name: `${action} — ${INST}` });
    await expect(mine('Start production').first()).toBeVisible({ timeout: 20_000 });

    // One sitting at a time, four sittings, four steps — and each click waits
    // for the number of remaining buttons to drop by one rather than for a
    // fixed 400ms. A sleep is a guess about how fast a machine is; this is a
    // statement about what the Kitchen has actually done.
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
    await expect(kitchen.getByText('PACKED', { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });

    // ---- name the driver on the Dispatch row, then release
    //
    // Through the screen, not through assign_manifest_driver. The Kitchen is
    // the role that dispatches, so if the Kitchen cannot name a driver here the
    // delivery cannot leave — which was true until this release.
    // Scoped to THIS institution's row, not to the Dispatch card.
    //
    // The Kitchen's Dispatch table lists every site finalised for the date, so
    // "the notice is on screen" and "the notice is on MY run" are different
    // claims — and the first one passed while another spec's institution still
    // had a manifest for today, then failed strict mode when there were two.
    const dispatch = kitchen.locator('.card').filter({ hasText: 'name a driver, then release' });
    const run1 = dispatch.locator('tr').filter({
      has: kitchen.getByLabel(`Driver for ${INST} run 1`, { exact: true }),
    });
    await expect(run1).toHaveCount(1, { timeout: 20_000 });
    await expect(run1.getByText('Assign a Driver before releasing')).toBeVisible();
    await run1.locator('select').selectOption({ label: 'driver' });
    await run1.getByRole('button', { name: 'Assign driver', exact: true }).click();
    await expect(kitchen.getByText('Driver assigned.')).toBeVisible({ timeout: 20_000 });

    await run1.getByRole('button', { name: 'Release to driver', exact: true }).click();
    await expect(kitchen.getByText('Released to the driver.')).toBeVisible({ timeout: 20_000 });
    await kitchenCtx.close();

    // ---- the Driver collects and arrives, and CANNOT hand over
    const driverCtx = await browser.newContext();
    const dp = await driverCtx.newPage();
    await login(dp, seeded().driverEmail);
    await dp.goto('/my-deliveries');
    await expect(dp.getByText(INST)).toBeVisible({ timeout: 20_000 });
    await dp.getByRole('button', { name: 'Confirm collection', exact: true }).click();
    await dp.getByRole('button', { name: 'Arrived at institution', exact: true }).click();
    // Two banners say "Arrival recorded" — the success message and the standing
    // note about who completes the handover — so a bare text match is
    // ambiguous. Assert each one, which also proves the Driver is TOLD that
    // custody is not theirs to transfer.
    await expect(dp.locator('.banner.ok')).toHaveText('Arrival recorded.', { timeout: 20_000 });
    await expect(dp.locator('.banner.info')).toContainText(
      'The institution completes the handover',
      { timeout: 20_000 },
    );
    // There is no handover control on the Driver's screen at all.
    await expect(dp.getByRole('button', { name: /Confirm full delivery received/ })).toHaveCount(0);
    await driverCtx.close();

    // ---- the institution takes custody, with ONE button and no retyping
    const recvCtx = await browser.newContext();
    const rp = await recvCtx.newPage();
    await login(rp, RECEIVER_EMAIL);
    await rp.goto('/handover');
    await settled(rp);
    const confirm = rp
      .getByRole('button', { name: 'Confirm full delivery received', exact: true })
      .first();
    await expect(confirm).toBeVisible({ timeout: 20_000 });
    await confirm.click();
    // Two success banners appear, not one: the action's own acknowledgement and
    // the standing record of when custody passed. Name each, and the state pill
    // as well — scoping to `.banner.ok` was only a different way of matching two
    // things at once.
    await expect(rp.getByText('Delivery received. Thank you.')).toBeVisible({ timeout: 20_000 });
    await expect(rp.getByText(/Received at \d\d:\d\d/)).toBeVisible({ timeout: 20_000 });
    await expect(rp.getByText('HANDED OVER').first()).toBeVisible({ timeout: 20_000 });
    await recvCtx.close();
  });

  // ------------------------------------------------------------- classroom
  test('the Classroom records only entitled children, and says so about the rest', async ({
    page,
  }) => {
    await login(page, STAFF_EMAIL);
    await page.goto('/today');
    // The register opens on a class, and the chooser is a bare <select> with no
    // label — getByLabel(/Class/) matched nothing, the selection was skipped,
    // and the page stayed on "choose a class to open the register". Zero chips
    // is what that looks like. Drive the control that is actually there.
    await page.locator('.filters select').selectOption({ label: CLASS });
    await expect(page.locator('.roster-chip').first()).toBeVisible({ timeout: 20_000 });

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
    // This spec's own guardian, linked to its morning-only child and to no one
    // else. Borrowing the shared fixture's Parent added a SECOND child to an
    // account that already had one elsewhere, so the portal opened on the other
    // child and reported that child's sittings perfectly correctly.
    await login(page, GUARDIAN_EMAIL);
    await page.goto('/parent');
    await settled(page);
    // Exactly the two sittings this child receives, named, in order. A bare
    // getByText('Lunch') would also match the product's own name in the header
    // — "LunchBox Connect" contains it — so the claim is made against the meal
    // cards themselves.
    await expect(page.locator('.today-meal-card')).toHaveCount(2, { timeout: 20_000 });
    await expect(page.locator('.tmc-period')).toHaveText(['Breakfast', 'Morning snack']);
  });
});

/** The register's period switch, by visible label. */
async function selectPeriod(page: Page, label: string) {
  // Required, not optional. A sitting this institution serves must be offered;
  // silently skipping the click would leave the previous period on screen and
  // assert the wrong register's numbers.
  const tab = page.getByRole('button', { name: label, exact: true }).first();
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
}
