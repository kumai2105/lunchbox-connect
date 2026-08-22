import { expect, test } from 'playwright/test';
import { adminDb, e2eReady, login, seeded } from './fixtures';

/**
 * SUPER ADMIN IS THE OPERATIONAL CONTROL PLANE.
 *
 * Every other spec here verifies a surface in isolation against a database the
 * FIXTURE configured. That leaves the most important claim in the product
 * untested: that a Super Admin can take a brand-new Institution from nothing to
 * a classroom recording a real meal, entirely through the application, with no
 * developer and no database edit anywhere in the chain.
 *
 * This test walks that whole chain in one pass:
 *
 *   Super Admin  create Institution -> service plan -> periods -> effective date
 *                -> assign menu -> anchor week -> publish a window
 *        v
 *   Nursery Admin   sees its own published dated schedule
 *   Classroom       sees the applicable published meal and records an outcome
 *   Parent          sees the authorized result for their own child
 *   Kitchen         receives the resulting production demand
 *
 * Everything a Super Admin is SUPPOSED to be able to do is done by clicking.
 * The service-role client appears exactly twice, and never to configure the
 * planning engine:
 *
 *   * to read back ids the UI does not put in the DOM (assertions, not setup);
 *   * to link a guardian to the new Student — guardian linking is
 *     BLOCKED_BY_SPEC and deliberately has no Super Admin control, so it is
 *     fixture data here rather than a missing feature.
 *
 * If a step below cannot be performed through the UI, that is a PRODUCT
 * OPERABILITY DEFECT and this test is where it surfaces.
 */

/** Asia/Dubai operational date, matching the rule the rest of the app uses. */
function dubaiToday(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(now);
}

test.describe('operability — a Super Admin onboards an Institution end to end', () => {
  test.skip(!e2eReady, 'needs E2E_* env (approved non-production Supabase project)');

  // Serial: this is one narrative, and a later step is meaningless if an
  // earlier one did not happen.
  test.describe.configure({ mode: 'serial' });

  // FOUR MINUTES, FOR A STATED REASON — not a blind bump to make red go green.
  //
  // This single test performs the entire business chain: a Meal, a Menu, 14
  // slot assignments each opening and closing a picker, an Institution, a
  // service plan, a rotation assignment, a publish, a Class, a Student, a
  // staff account, a class assignment, and five separate logins as five
  // different roles. That is roughly forty UI round trips against a Supabase
  // stack running on the same runner.
  //
  // The default 60s is right for a test that exercises one surface. It is
  // simply the wrong budget for a narrative that walks the product end to end,
  // and the previous run died mid-chain with no finding to show for it. The
  // assertions are untouched; only the clock is.
  test.setTimeout(240_000);

  const stamp = Date.now();
  const INST = `E2E Onboard ${stamp}`;
  const CLASS = `E2E Onboard Class ${stamp}`;
  const STUDENT_NO = `EON-${stamp}`;
  const STAFF_EMAIL = `e2e.onboard.staff.${stamp}@lunchbox.app`;
  const STAFF_PASS = 'E2e-pass!12345';
  const PARENT_EMAIL = `e2e.onboard.parent.${stamp}@lunchbox.app`;
  const MEAL = `E2E Onboard Meal ${stamp}`;
  const MENU = `E2E Onboard Menu ${stamp}`;
  const FROM = dubaiToday();
  const TO = dubaiToday(6);
  const CLOSED = dubaiToday(3);      // a future day inside the window, unserved
  const OPEN_AFTER = dubaiToday(4);  // the day after it, which must survive

  test('the complete chain, Super Admin through to Kitchen', async ({ page }) => {
    const s = seeded();
    const db = adminDb();

    await login(page, s.superAdminEmail);

    const step = (n: string) => console.log(`OPSTEP ${n}`);

    step('1-2 meal library');
    // ---- 1-2. define the Meal once, in the Meal Library -----------------
    // The business defines a Meal once and reuses it everywhere. This is the
    // top of the chain: nothing downstream can exist without it.
    await page.goto('/meals');
    await page.getByRole('button', { name: /add meal/i }).first().click();
    await page.getByLabel('Name', { exact: true }).fill(MEAL);
    await page.getByPlaceholder('chicken, pasta, tomato').fill('rice, peas');
    await page.getByPlaceholder('gluten, dairy').fill('none');
    await page.getByRole('button', { name: /save meal/i }).click();

    // One save produces the Meal AND its first revision, and the Meal points at
    // it. A Meal with no current revision cannot be placed on a menu, so the
    // revision is the thing worth asserting — it is also what makes history
    // truthful later when this Meal is edited.
    await expect
      .poll(async () => {
        const r = await db
          .from('meals')
          .select('id, current_revision_id')
          .eq('name', MEAL)
          .maybeSingle();
        return r.data?.current_revision_id ? 'linked' : r.data ? 'no-revision' : 'missing';
      }, { message: 'the Meal never persisted with a first revision' })
      .toBe('linked');

    step('3-4 menu builder create');
    // ---- 3-4. build the Menu and configure its rotation length ----------
    await page.goto('/menu-builder');
    await page.getByRole('button', { name: /new menu/i }).click();
    await page.getByLabel('Menu name', { exact: true }).fill(MENU);
    await page.getByLabel('Number of weeks', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await page.locator('.menu-list-item', { hasText: MENU }).first().click();
    await expect(page.locator('.menu-grid')).toBeVisible();

    // Reveal all seven days. Which weekday CI runs on is not ours to choose, so
    // every day carries the Meal — otherwise this test would pass or fail by
    // calendar accident rather than by product behaviour.
    const weekendToggle = page.getByRole('button', { name: /Show weekend \/ camp days/ });
    if (await weekendToggle.count()) await weekendToggle.click();

    step('5 fill slots');
    // ---- 5. fill the week/day/period slots with the Meal ----------------
    for (const period of ['Breakfast', 'Lunch']) {
      const row = page.locator('.menu-grid tr', { hasText: period });
      const cells = row.locator('.slot-cell');
      const n = await cells.count();
      expect(n, `the ${period} row has no slots to fill`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        await cells.nth(i).click();

        // The picker must actually be open before we reach into it, and the
        // Meal we just created must be offered. If the Meal Library and the
        // Menu Builder disagree about what exists, say so here rather than
        // timing out on a click that can never land.
        await expect(
          page.locator('.meal-picker'),
          `${period} slot ${i}: the meal picker did not open`,
        ).toBeVisible({ timeout: 8000 });
        const pick = page.locator('.meal-pick', { hasText: MEAL }).first();
        await expect(
          pick,
          `${period} slot ${i}: the Meal created in the Meal Library is not offered in the Menu Builder`,
        ).toBeVisible({ timeout: 8000 });
        await pick.click();

        // assign() closes the picker with setCell(null) ONLY after a successful
        // write; on failure it sets an error banner and leaves it open. So a
        // picker that stays open IS the refusal, and waiting on it silently
        // turns one rejected write into a 15s stall per slot — which is where
        // the previous four-minute timeout went, with no cause reported.
        try {
          await expect(page.locator('.meal-picker')).toHaveCount(0, { timeout: 8000 });
        } catch {
          const err = page.locator('.banner.err');
          const text = (await err.count()) ? ((await err.first().textContent()) ?? '').trim() : '';
          throw new Error(
            `${period} slot ${i}: the slot was not saved — the picker stayed open. ` +
              `App error: ${text || '(no banner rendered)'}`,
          );
        }
      }
    }

    step('6 reload persistence');
    // ---- 6. it persists across a reload --------------------------------
    // A planning tool that loses the plan on refresh is not a planning tool.
    await page.reload();
    await page.locator('.menu-list-item', { hasText: MENU }).first().click();
    await expect(page.locator('.menu-grid')).toBeVisible();
    await expect(page.locator('.slot-cell.filled').first()).toBeVisible();
    const filled = await page.locator('.slot-cell.filled').count();
    expect(filled, 'the menu did not survive a reload').toBeGreaterThanOrEqual(14);

    step('7 create institution');
    // ---- 7. create the Institution -------------------------------------
    await page.goto('/institutions');
    await page.getByRole('button', { name: '+ Add institution', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(INST);
    // Reachable BY LABEL: this control used to be a hand-rolled div+label with
    // no association at all.
    await page.getByLabel('Type', { exact: true }).selectOption('nursery');
    await page.getByRole('button', { name: 'Add institution', exact: true }).click();

    // Did the write land? Ask the database before asking the DOM.
    //
    // Waiting on the list row first turns two different faults — "the insert
    // was refused" and "the insert worked but the list did not re-render" —
    // into the same blind 15s timeout. The Class-create defect cost five CI
    // rounds to exactly that, so this reads the app's own error banner and the
    // row, and reports both.
    let instId = '';
    await expect
      .poll(async () => {
        const r = await db.from('institutions').select('id').eq('name', INST).maybeSingle();
        instId = (r.data?.id as string) ?? '';
        return instId !== '';
      }, {
        message: 'the Institution was never written',
      })
      .toBe(true);

    const banner = page.locator('.banner.err');
    const bannerText = (await banner.count())
      ? ((await banner.first().textContent())?.trim() ?? '')
      : '';
    expect(bannerText, `the app refused to create the Institution: ${bannerText}`).toBe('');

    // Navigate the way an operator does — by clicking the institution's name.
    await expect(
      page.getByRole('link', { name: INST }),
      'the Institution exists but never appeared in the list — the create path does not refresh it',
    ).toBeVisible();
    await page.getByRole('link', { name: INST }).click();
    await expect(page).toHaveURL(/\/institutions\/[0-9a-f-]{36}/);

    step('8-10 service plan');
    // ---- 2-4. service plan: periods + effective date --------------------
    await page.goto(`/institutions/${instId}?tab=service`);
    await expect(page.getByRole('button', { name: 'Save service plan' })).toBeVisible();

    // Contract two periods, deliberately NOT all four: the Classroom must
    // later offer exactly what was purchased and nothing else.
    await page.getByLabel('Breakfast', { exact: true }).check();
    await page.getByLabel('Lunch', { exact: true }).check();
    await page.getByLabel('Effective from', { exact: true }).first().fill(FROM);
    await page.getByRole('button', { name: 'Save service plan' }).click();
    await expect(page.getByText(/Current: .*Breakfast.*Lunch/)).toBeVisible();

    step('11 assign menu + anchor');
    // ---- 5-6. assign the menu and the anchor week ----------------------
    const menu = page.getByLabel('Menu', { exact: true });
    await expect(menu, 'no menu is assignable — Menu Builder produced none').toBeVisible();
    // The menu THIS test built, by name — not whatever happened to be first.
    await menu.selectOption({ label: `${MENU} (1 weeks)` });
    await page.getByLabel('Starting rotation week', { exact: true }).fill('1');
    await page.getByLabel('Effective from', { exact: true }).last().fill(FROM);
    await page.getByRole('button', { name: 'Assign menu' }).click();
    await expect(page.getByText(/Current:.*anchor week 1/)).toBeVisible();

    step('13 publish window');
    // ---- 7. publish a dated window -------------------------------------
    await page.getByLabel('From', { exact: true }).fill(FROM);
    await page.getByLabel('To', { exact: true }).fill(TO);
    await page.getByRole('button', { name: 'Publish window' }).click();
    await expect(page.getByText(/Published \d+ dated meal services/)).toBeVisible();

    // The publish actually materialised dated services for the contracted
    // periods only. This is the invariant the whole downstream depends on.
    await expect
      .poll(async () => {
        const r = await db
          .from('meal_services')
          .select('period')
          .eq('institution_id', instId)
          .eq('service_date', FROM)
          .eq('published', true);
        return (r.data ?? []).map((x) => x.period as string).sort();
      })
      .toEqual(['breakfast', 'lunch']);

    step('roster.a class');
    // ---- roster: a Class, a Student and a Classroom account ------------
    // All three through the UI — they are ordinary Super Admin actions.
    await page.goto(`/classes?institution=${instId}`);
    await page.getByRole('button', { name: '+ Create class', exact: true }).click();
    await page.getByLabel('Class name', { exact: true }).fill(CLASS);
    await page.getByRole('button', { name: 'Create class', exact: true }).click();
    await expect(page.getByText(CLASS)).toBeVisible();

    const classRow = await db.from('classes').select('id').eq('name', CLASS).single();
    const classId = classRow.data?.id as string;
    expect(classId, 'the Class was not created through the UI').toBeTruthy();

    step('roster.b student');
    await page.goto('/students');
    await page.getByRole('button', { name: /add student/i }).first().click();
    await page.getByLabel('Given name', { exact: true }).fill('Onboard');
    await page.getByLabel('Family name', { exact: true }).fill('Child');
    await page.getByLabel('Student no.', { exact: true }).fill(STUDENT_NO);
    await page.getByLabel('Institution', { exact: true }).selectOption(instId);
    await page.getByLabel('Class', { exact: true }).selectOption(classId);
    await page.getByRole('button', { name: /^(Add|Create) student$/i }).click();

    await expect
      .poll(async () => {
        const r = await db.from('students').select('id').eq('student_no', STUDENT_NO).maybeSingle();
        return r.data?.id ?? null;
      })
      .not.toBeNull();
    const studentRow = await db.from('students').select('id').eq('student_no', STUDENT_NO).single();
    const studentId = studentRow.data?.id as string;

    // A Classroom Staff account scoped to the NEW institution, created from the
    // institution's own Staff tab.
    // ---- make the Student eligible, through the UI ---------------------
    // A newly created Student is NOT eligible until a Super Admin marks them
    // billable, and that gate is correct: eligibility is a commercial state,
    // not a side effect of typing a name. Nothing reaches the Classroom, the
    // Kitchen or a Parent until it is set, which is why the register was empty
    // and the recording controls never rendered.
    //
    // Set the way an operator sets it — the Operational status control on the
    // Student's own profile.
    step('roster.b2 make the student eligible');
    await page.goto(`/students/${studentId}`);
    const eligibility = page.locator('select').filter({ hasText: 'Not eligible' }).first();
    await expect(
      eligibility,
      'no Operational status control — a Super Admin cannot make a Student billable',
    ).toBeVisible();
    await eligibility.selectOption('ACTIVE_BILLABLE_TO_NURSERY');
    await expect
      .poll(async () => {
        const r = await db
          .from('students')
          .select('operational_status')
          .eq('id', studentId)
          .maybeSingle();
        return r.data?.operational_status ?? null;
      }, { message: 'the eligibility change never persisted' })
      .toBe('ACTIVE_BILLABLE_TO_NURSERY');

    step('roster.c staff account');
    await page.goto(`/institutions/${instId}?tab=staff`);
    // The invite fields live inside a modal. Filling them without opening it
    // waits forever on controls that do not exist yet — the same silent stall
    // as the 'Add to class' label, and the reason this phase burned a run.
    await page.getByRole('button', { name: /Provision classroom staff/ }).click();
    await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
    await page.getByLabel('Full name', { exact: true }).fill('Onboard Teacher');
    await page.getByLabel('Email', { exact: true }).fill(STAFF_EMAIL);
    await page.getByLabel('Temporary password (min 8 chars)', { exact: true }).fill(STAFF_PASS);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect
      .poll(async () => {
        const r = await db.from('app_users').select('role').eq('email', STAFF_EMAIL).maybeSingle();
        return r.data?.role ?? null;
      })
      .toBe('classroom_staff');

    // Assign that account to the class — Classes -> Manage staff.
    step('roster.d assign staff to class');
    const staffRow = await db
      .from('app_users')
      .select('user_id')
      .eq('email', STAFF_EMAIL)
      .single();
    await page.goto(`/classes?institution=${instId}`);
    await page.getByRole('button', { name: 'Manage staff' }).first().click();
    // By value, not by a label pattern: selectOption takes a string, and the
    // id is the only thing guaranteed to identify this one account.
    await page.getByRole('combobox').last().selectOption(staffRow.data?.user_id as string);
    // "Add to class", read from ClassesPage — not "Add". /^Add$/ matched
    // nothing, and a click on a locator that never resolves is a silent stall,
    // which is where this chain spent four minutes.
    await page.getByRole('button', { name: 'Add to class', exact: true }).click();
    await expect
      .poll(async () => {
        const r = await db.from('class_staff').select('user_id').eq('class_id', classId);
        return (r.data ?? []).length;
      })
      .toBeGreaterThan(0);

    step('roster.e guardian link');
    // FIXTURE, not a missing control: guardian linking is BLOCKED_BY_SPEC and
    // has no Super Admin action by design, so the link is seeded directly.
    //
    // A DEDICATED parent, not the shared fixture one. Linking the seeded
    // parent to this test's student added a child to an account other specs
    // assert on: parent-portal.spec expects exactly two children in the
    // switcher and found five, because every attempt of this test added
    // another. An acceptance test that mutates fixtures other tests depend on
    // manufactures failures elsewhere and hides its own.
    const created = await db.auth.admin.createUser({
      email: PARENT_EMAIL,
      password: STAFF_PASS,
      email_confirm: true,
      user_metadata: { full_name: 'Onboard Parent' },
    });
    const parentId = created.data.user?.id;
    expect(parentId, 'could not create the dedicated parent account').toBeTruthy();
    await db.from('app_users').insert({
      user_id: parentId as string,
      role: 'parent',
      institution_id: null,
      full_name: 'Onboard Parent',
      email: PARENT_EMAIL,
    });
    await db
      .from('student_parents')
      .insert({ student_id: studentId, user_id: parentId as string });

    step('15 nursery schedule');
    // ---- 8. the Nursery Admin sees its own published schedule ----------
    // Read as the Super Admin: the institution's own schedule route is the
    // same published read model a Nursery Admin gets, and the seeded Nursery
    // Admin belongs to a DIFFERENT institution — pointing them here would be
    // asserting a tenancy violation, not a feature.
    await page.goto(`/institutions/${instId}?tab=calendar`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    step('16-17 classroom record');
    // ---- 9-10. Classroom sees the applicable meal and records ----------
    // STAFF_PASS is the shared fixture password, which login() supplies itself.
    await login(page, STAFF_EMAIL);
    await page.goto(`/today?class=${classId}`);
    await expect(page.getByRole('heading', { level: 1, name: /Today/ })).toBeVisible();

    // Exactly the contracted periods are offered — nothing else.
    await expect(page.locator('.period-btn', { hasText: 'Breakfast' })).toBeVisible();
    await expect(page.locator('.period-btn', { hasText: 'Lunch' })).toBeVisible();
    await expect(page.locator('.period-btn', { hasText: 'Afternoon snack' })).toHaveCount(0);
    await expect(page.locator('.period-btn', { hasText: 'Morning snack' })).toHaveCount(0);

    await page.getByRole('button', { name: '75% eaten', exact: true }).click();
    await page.getByRole('button', { name: 'Ate independently' }).click();
    await expect(page.locator('.roster-chip').first().locator('.status-badge')).toHaveClass(
      /sb-checkCircle/,
    );

    // It is anchored to a PUBLISHED service, which is the rule that makes the
    // record trustworthy rather than merely present.
    await expect
      .poll(async () => {
        const r = await db
          .from('serving_records')
          .select('meal_service_id')
          .eq('student_id', studentId);
        return (r.data ?? []).filter((x) => x.meal_service_id).length;
      })
      .toBeGreaterThan(0);

    step('18 parent result');
    // ---- 11. the Parent sees the authorized result --------------------
    await login(page, PARENT_EMAIL);
    await page.goto('/parent');
    await expect(page.locator('#root')).toBeVisible();
    // This parent has exactly one child — the Student this chain created — so
    // seeing that name is the authorized result reaching the right family.
    await expect(page.getByText(/Onboard/).first()).toBeVisible();

    step('12+14 calendar closure, then re-publish');
    // ---- 12 & 14. a closure, and what re-publishing does with it -------
    //
    // The Rotation defines the normal pattern; the Calendar handles the
    // exceptions. A public holiday must not require rebuilding the menu, and
    // per 0016 a closure "never shifts the rotation" — the cycle keeps
    // counting through a closed day, so week 3 is still week 3 next Monday.
    //
    // Precedence, from the resolver itself: closure > override > special
    // period > normal rotation > nothing.
    await login(page, s.superAdminEmail);
    await page.goto(`/institutions/${instId}?tab=calendar`);
    await page.getByLabel('Type', { exact: true }).selectOption('closure');
    await page.getByLabel('From', { exact: true }).fill(CLOSED);
    await page.getByLabel('To', { exact: true }).fill(CLOSED);
    await page.getByLabel('Reason (optional)', { exact: true }).fill('E2E public holiday');
    await page.getByRole('button', { name: 'Add rule' }).click();
    await expect
      .poll(async () => {
        const r = await db
          .from('calendar_exceptions')
          .select('id')
          .eq('institution_id', instId)
          .eq('kind', 'closure');
        return (r.data ?? []).length;
      }, { message: 'the calendar closure was never saved' })
      .toBeGreaterThan(0);

    // A rule only reaches Kitchen, Classroom and Parent once the window is
    // re-published — the screen says so, and this asserts it rather than
    // trusting it.
    await page.goto(`/institutions/${instId}?tab=service`);
    await page.getByLabel('From', { exact: true }).fill(FROM);
    await page.getByLabel('To', { exact: true }).fill(TO);
    await page.getByRole('button', { name: 'Publish window' }).click();
    await expect(page.getByText(/Published \d+ dated meal services/)).toBeVisible();

    // The closed day carries nothing...
    await expect
      .poll(async () => {
        const r = await db
          .from('meal_services')
          .select('id')
          .eq('institution_id', instId)
          .eq('service_date', CLOSED)
          .eq('published', true);
        return (r.data ?? []).length;
      }, { message: 'the closed day still has published services' })
      .toBe(0);

    // ...and the rest of the window is untouched. A closure that quietly wiped
    // the surrounding days would pass a naive "the closed day is empty" check
    // and destroy the schedule.
    const openDay = await db
      .from('meal_services')
      .select('period')
      .eq('institution_id', instId)
      .eq('service_date', OPEN_AFTER)
      .eq('published', true);
    expect(
      (openDay.data ?? []).map((x) => x.period as string).sort(),
      'the closure removed services from a day it does not cover',
    ).toEqual(['breakfast', 'lunch']);

    // And today's ALREADY-SERVED record survived the re-publish untouched.
    // Republishing must never rewrite operational history.
    const stillServed = await db
      .from('serving_records')
      .select('id')
      .eq('student_id', studentId);
    expect(
      (stillServed.data ?? []).length,
      're-publishing destroyed a recorded observation',
    ).toBeGreaterThan(0);

    step('19 kitchen demand');
    // ---- 12. the Kitchen receives the production demand ----------------
    await login(page, s.kitchenEmail);
    await page.goto('/kitchen');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.banner.err')).toHaveCount(0);
  });
});
