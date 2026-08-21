/**
 * E2E global setup — idempotent seeding of an APPROVED NON-PRODUCTION
 * (disposable) Supabase project on the CURRENT architecture. It seeds with a
 * service-role key that bypasses RLS and writes rows, so it must never point
 * at production: `assertNotProduction()` below refuses the known production
 * project outright, and CI fails the job before this file even runs.
 *
 * BLOCKED_BY_ENVIRONMENT when E2E_* vars are absent (the suite just skips) —
 * which is the current state until an approved non-production target exists.
 * All rows are namespaced (E2E …).
 *
 * The seed models the real chain, not the retired one:
 *   Meal (library) → Meal Revision → published, dated Meal Service
 *   → class_staff assignment → Classroom Meal Record (linked to its service)
 *   → Parent result.
 *
 * It no longer touches the legacy `menus` table, `classes.teacher_id`, or
 * institution kind 'other' — all retired. Served observations carry their
 * meal_service_id, as the 0029 integrity rule now requires.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASS = process.env.E2E_PASSWORD ?? 'E2e-pass!12345';
const ELIGIBLE = 'ACTIVE_BILLABLE_TO_NURSERY';
const HERE = path.dirname(fileURLToPath(import.meta.url));

// RELEASE BLOCKER GUARD (item 8): this seeder holds a service-role key that
// bypasses RLS and WRITES rows. It must never run against the production
// Supabase project. We match on the actual project ref in the URL, not on any
// human-set naming/label, so a mislabelled but production-pointing URL is still
// refused. Keep this list conservative — the only safe target is an approved
// throwaway/non-prod project.
const PRODUCTION_PROJECT_REFS = ['llnofriwvnerntrbpehc'];

function assertNotProduction(url: string): void {
  for (const ref of PRODUCTION_PROJECT_REFS) {
    if (url.includes(ref)) {
      throw new Error(
        `[e2e] REFUSING to seed the production Supabase project (matched ref "${ref}" in ` +
          `E2E_SUPABASE_URL). E2E seeding writes rows with a service-role key and must only ` +
          `run against an approved non-production project. Aborting.`,
      );
    }
  }
}

// Canonical operational (Asia/Dubai) date — the same rule the app and database
// use (src/lib/format.ts operationalDateFor / app_operational_date()). GST is
// UTC+4 with no DST, so the operational calendar date is the date part of the
// instant shifted +4h read in UTC. Using this (instead of a raw UTC slice)
// keeps the seeded "today" identical to what the DB and frontend compute, even
// between 20:00–24:00 UTC when a naive UTC date is already a day behind Dubai.
const UAE_UTC_OFFSET_HOURS = 4;
function operationalDateFor(instant: Date): string {
  return new Date(instant.getTime() + UAE_UTC_OFFSET_HOURS * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Fixture operations must not fail silently.
 *
 * The seeder previously discarded the `error` of nearly every insert, so a
 * fixture that never actually landed produced specs failing later for reasons
 * that had nothing to do with the defect under test. Every write now goes
 * through this.
 */
function must<T>(what: string, res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`[e2e] fixture step failed — ${what}: ${res.error.message}`);
  if (res.data === null || res.data === undefined) {
    throw new Error(`[e2e] fixture step returned no row — ${what}`);
  }
  return res.data;
}

/** Same, for writes that return no row. */
function mustOk(what: string, res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(`[e2e] fixture step failed — ${what}: ${res.error.message}`);
}

/**
 * A READ whose result later steps depend on. Unlike `must`, a null row is a
 * legitimate answer here ("this fixture account does not exist yet") — only an
 * ERROR is fatal, and it must not be swallowed.
 */
function mustQuery<T>(what: string, res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`[e2e] fixture query failed — ${what}: ${res.error.message}`);
  return res.data;
}

// Get-or-create a Meal + its revision by name; returns the revision id.
async function ensureMeal(
  db: SupabaseClient,
  name: string,
  rev: {
    allergens?: string[];
    ingredients?: string[];
    portion?: string | null;
    nutrition?: Record<string, unknown>;
  },
): Promise<string> {
  const existingMeal = mustQuery(
    `look up meal ${name}`,
    await db.from('meals').select('id').eq('name', name).maybeSingle(),
  ) as { id: string } | null;
  let mealId = existingMeal?.id;
  if (!mealId) {
    const createdMeal = must(
      `create meal ${name}`,
      await db.from('meals').insert({ name }).select('id').single(),
    ) as { id: string };
    mealId = createdMeal.id;
  }

  const existingRev = mustQuery(
    `look up revision 1 of ${name}`,
    await db
      .from('meal_revisions')
      .select('id')
      .eq('meal_id', mealId)
      .eq('revision_no', 1)
      .maybeSingle(),
  ) as { id: string } | null;
  let revId = existingRev?.id;
  if (!revId) {
    const createdRev = must(
      `create revision 1 of ${name}`,
      await db
        .from('meal_revisions')
        .insert({
          meal_id: mealId,
          revision_no: 1,
          name,
          allergens: rev.allergens ?? [],
          ingredients: rev.ingredients ?? [],
          portion: rev.portion ?? null,
          nutrition: rev.nutrition ?? {},
        })
        .select('id')
        .single(),
    ) as { id: string };
    revId = createdRev.id;
  }

  mustOk(
    `point meal ${name} at its current revision`,
    await db.from('meals').update({ current_revision_id: revId }).eq('id', mealId),
  );
  return revId;
}

export default async function globalSetup(): Promise<void> {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
  // The anon key is part of readiness, not an optional extra: the browser
  // bundle under test is built from it, so without it the page would talk to a
  // placeholder host while the fixtures seeded a real project — every spec
  // would then fail for the wrong reason. Missing vars mean the suite is
  // BLOCKED_BY_ENVIRONMENT and skips honestly.
  if (!url || !serviceKey || !anonKey) {
    console.warn(
      '[e2e] E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY / E2E_SUPABASE_ANON_KEY missing — full suite SKIPPED.',
    );
    return;
  }

  // Hard production guard (item 8) — before any client is built or any row is
  // written. Throws (fails the run) rather than skipping: a production URL here
  // is a misconfiguration to surface loudly, not to swallow.
  assertNotProduction(url);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Canonical Asia/Dubai operational dates (item 7). `tomorrow` is derived from
  // the same operational instant so the today/tomorrow boundary is computed by
  // one rule, not two.
  const now = new Date();
  const today = operationalDateFor(now);
  const tomorrow = operationalDateFor(new Date(now.getTime() + 86400000));

  // Deterministic boundary assertion (item 7): today and tomorrow must be
  // exactly one operational day apart, and both must be canonical YYYY-MM-DD.
  // This catches a regression to raw-UTC date math (which drifts by a day near
  // UTC midnight relative to the DB's Asia/Dubai app_operational_date()).
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO_DATE.test(today) || !ISO_DATE.test(tomorrow)) {
    throw new Error(`[e2e] non-canonical operational date: today=${today} tomorrow=${tomorrow}`);
  }
  const dayGapMs =
    Date.parse(`${tomorrow}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  if (dayGapMs !== 86400000) {
    throw new Error(
      `[e2e] operational today/tomorrow are not exactly one day apart ` +
        `(today=${today} tomorrow=${tomorrow}); date rule is inconsistent.`,
    );
  }

  // ---- institution (nursery — 'other' is retired) + class -------------------
  const institution = must(
    'create E2E Nursery',
    await db
      .from('institutions')
      .upsert({ name: 'E2E Nursery', kind: 'nursery' }, { onConflict: 'name' })
      .select('id')
      .single(),
  );
  const institutionId = (institution as { id: string }).id;

  const klass = must(
    'create class E2E 1-A',
    await db
      .from('classes')
      .upsert(
        { institution_id: institutionId, name: 'E2E 1-A', grade: '1' },
        { onConflict: 'institution_id,name' },
      )
      .select('id')
      .single(),
  );
  const classId = (klass as { id: string }).id;

  // ---- Kitchen ENTITY (item 5) ---------------------------------------------
  // A Kitchen account is scoped to a Kitchen, not to an Institution (docs/13
  // Decision 031). The fixture previously created the account with a NULL
  // kitchen_id, so the Kitchen role had no scope at all and its screens could
  // not be exercised honestly.
  const kitchen = must(
    'create E2E Kitchen entity',
    await db
      .from('kitchens')
      .upsert({ name: 'E2E Kitchen', active: true }, { onConflict: 'name' })
      .select('id')
      .single(),
  );
  const kitchenId = (kitchen as { id: string }).id;

  // ---- nine approved role domains ------------------------------------------
  const accounts = [
    { role: 'super_admin', email: 'e2e.super-admin@lunchbox.app' },
    { role: 'school_admin', email: 'e2e.school-admin@lunchbox.app' },
    { role: 'operations_manager', email: 'e2e.operations@lunchbox.app' },
    { role: 'finance_owner', email: 'e2e.finance@lunchbox.app' },
    { role: 'viewer', email: 'e2e.viewer@lunchbox.app' },
    { role: 'parent', email: 'e2e.parent@lunchbox.app' },
    { role: 'classroom_staff', email: 'e2e.classroom@lunchbox.app' },
    { role: 'kitchen', email: 'e2e.kitchen@lunchbox.app' },
    { role: 'driver', email: 'e2e.driver@lunchbox.app' },
  ];

  // Only the genuinely INSTITUTION-SCOPED roles carry institution_id.
  // Operations Manager, Finance/Owner, Viewer and Driver are NOT
  // institution-scoped in the approved model — anchoring them to one out of
  // convenience made the fixture disagree with the RBAC it is meant to prove.
  // Kitchen is scoped to a Kitchen entity instead.
  const INSTITUTION_SCOPED = ['school_admin', 'classroom_staff'];
  const expectedScope = (role: string) => ({
    institution_id: INSTITUTION_SCOPED.includes(role) ? institutionId : null,
    kitchen_id: role === 'kitchen' ? kitchenId : null,
  });

  for (const account of accounts) {
    const existing = mustQuery(
      `look up fixture account ${account.email}`,
      await db
        .from('app_users')
        .select('user_id, role, institution_id, kitchen_id')
        .eq('email', account.email)
        .maybeSingle(),
    ) as {
      user_id: string;
      role: string;
      institution_id: string | null;
      kitchen_id: string | null;
    } | null;

    const want = expectedScope(account.role);

    if (existing) {
      // RECONCILE rather than skip. A fixture account left behind by an older
      // seed can carry the wrong role or scope (the Kitchen account, for
      // instance, used to be created with no kitchen_id at all). Skipping it
      // because "a row exists" is how a suite ends up asserting against a
      // malformed actor and failing for the wrong reason.
      //
      // Only ever touches the namespaced e2e.*@lunchbox.app accounts this file
      // owns — never a real account.
      if (!account.email.startsWith('e2e.')) {
        throw new Error(`[e2e] refusing to modify a non-fixture account: ${account.email}`);
      }
      const drifted =
        existing.role !== account.role ||
        existing.institution_id !== want.institution_id ||
        existing.kitchen_id !== want.kitchen_id;
      if (drifted) {
        console.warn(
          `[e2e] reconciling fixture account ${account.email}: ` +
            `role ${existing.role}->${account.role}, ` +
            `institution ${existing.institution_id}->${want.institution_id}, ` +
            `kitchen ${existing.kitchen_id}->${want.kitchen_id}`,
        );
        mustOk(
          `reconcile fixture account ${account.email}`,
          await db
            .from('app_users')
            .update({ role: account.role, ...want })
            .eq('user_id', existing.user_id),
        );
      }
      continue;
    }

    const created = await db.auth.admin.createUser({
      email: account.email,
      password: PASS,
      email_confirm: true,
      user_metadata: { full_name: account.role.replace('_', ' ').toUpperCase() },
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `[e2e] fixture step failed — create auth user ${account.email}: ${created.error?.message ?? 'no user returned'}`,
      );
    }

    mustOk(
      `create app_users row for ${account.email}`,
      await db.from('app_users').insert({
        user_id: created.data.user.id,
        role: account.role,
        ...want,
        full_name: account.role.replace('_', ' '),
        email: account.email,
      }),
    );
  }

  const users = mustQuery(
    'read back fixture accounts',
    await db.from('app_users').select('user_id, role, email'),
  ) as Array<{ user_id: string; role: string; email: string }> | null;
  const byEmail = (email: string) => {
    const row = (users ?? []).find((u) => u.email === email);
    if (!row) throw new Error(`[e2e] fixture account missing after seeding: ${email}`);
    return row;
  };
  const classroomId = byEmail('e2e.classroom@lunchbox.app').user_id;
  const parentId = byEmail('e2e.parent@lunchbox.app').user_id;

  // classroom-staff assignment via class_staff (the retired teacher_id is gone)
  mustOk(
    'assign classroom staff to the E2E class',
    await db
      .from('class_staff')
      .upsert({ class_id: classId, user_id: classroomId }, { onConflict: 'class_id,user_id' }),
  );

  // ---- students (operational_status is the eligibility gate) ----------------
  const students = [
    { student_no: 'E2E-001', given_name: 'Status', family_name: 'Case', class_id: null, status: null },
    { student_no: 'E2E-101', given_name: 'Serving', family_name: 'One', class_id: classId, status: ELIGIBLE },
    { student_no: 'E2E-102', given_name: 'Serving', family_name: 'Two', class_id: classId, status: ELIGIBLE },
    { student_no: 'E2E-201', given_name: 'Portal', family_name: 'Kid', class_id: classId, status: ELIGIBLE },
    // A SECOND authorized child for the same Parent, deliberately different in
    // every way the portal renders: name, meal outcomes, and the meal served.
    // The child-switch regression cannot be honest with only one child — it
    // would skip, which is how that browser test came to prove nothing.
    { student_no: 'E2E-202', given_name: 'Second', family_name: 'Child', class_id: classId, status: ELIGIBLE },
  ];
  /**
   * Returns the student's ID — the ROW's id, not the response envelope.
   *
   * This previously returned the PostgREST `{ data, error }` response and every
   * caller then read `.id` off it, which is `undefined`. Those undefined ids
   * flowed into `student_parents`, `serving_records` and `.seeded.json`, so the
   * guardian link and the parent-portal records were seeded against nothing.
   * `tests/e2e` was outside every tsconfig, so a green typecheck never saw it;
   * `pnpm typecheck` now includes this file.
   */
  const upsertStudent = async (s: (typeof students)[number]): Promise<string> => {
    const row = must(
      `upsert student ${s.student_no}`,
      await db
        .from('students')
        .upsert(
          {
            student_no: s.student_no,
            institution_id: institutionId,
            given_name: s.given_name,
            family_name: s.family_name,
            class_id: s.class_id,
            operational_status: s.status,
            medical_notes: s.student_no === 'E2E-201' ? [{ id: 'n1', text: 'Dairy' }] : [],
          },
          { onConflict: 'student_no' },
        )
        .select('id')
        .single(),
    ) as { id: string };
    if (!row.id) throw new Error(`[e2e] student ${s.student_no} upserted without an id`);
    return row.id;
  };

  const statusKid = await upsertStudent(students[0]!);
  const servingOne = await upsertStudent(students[1]!);
  await upsertStudent(students[2]!);
  const portalKid = await upsertStudent(students[3]!);
  const portalKidB = await upsertStudent(students[4]!);

  mustOk(
    'link the E2E parent to the portal child',
    await db
      .from('student_parents')
      .upsert({ student_id: portalKid, user_id: parentId }, { onConflict: 'user_id,student_id' }),
  );
  mustOk(
    'link the E2E parent to the SECOND portal child',
    await db
      .from('student_parents')
      .upsert({ student_id: portalKidB, user_id: parentId }, { onConflict: 'user_id,student_id' }),
  );

  // ---- Meal library + dated, published Meal Services for TODAY --------------
  const oatsRev = await ensureMeal(db, 'E2E overnight oats', {
    ingredients: ['oats', 'banana', 'milk'],
    allergens: ['Gluten', 'Dairy'],
    portion: '115 g',
    nutrition: { kcal: 185 },
  });
  const wrapRev = await ensureMeal(db, 'E2E wrap', {
    ingredients: ['tortilla', 'chicken'],
    allergens: ['Gluten'],
    portion: '130 g',
    nutrition: { kcal: 310 },
  });
  const secretRev = await ensureMeal(db, 'UNPUBLISHED-E2E secret', {});

  const svc = async (
    period: string,
    revId: string,
    date: string,
    published: boolean,
  ): Promise<string> => {
    const service = must(
      `publish meal service ${period} on ${date}`,
      await db
        .from('meal_services')
        .upsert(
          {
            institution_id: institutionId,
            service_date: date,
            period,
            meal_revision_id: revId,
            published,
            published_at: published ? new Date().toISOString() : null,
          },
          { onConflict: 'institution_id,service_date,period' },
        )
        .select('id')
        .single(),
    ) as { id: string };
    return service.id;
  };

  const breakfastServiceId = await svc('breakfast', oatsRev, today, true);
  const lunchServiceId = await svc('lunch', wrapRev, today, true);
  // A draft service tomorrow — must stay invisible to Parent/Kitchen.
  await svc('lunch', secretRev, tomorrow, false);

  // ---- today's meal results for the portal child, LINKED to their service ---
  // (0029: a served observation must carry its meal_service_id.)
  const results: Array<Record<string, unknown>> = [
    {
      student_id: portalKid,
      class_id: classId,
      period: 'breakfast',
      served_status: 'served',
      consumption_pct: 100,
      behavior: 'ate_independently',
      low_intake_reason: null,
      meal_service_id: breakfastServiceId,
      recorded_by: classroomId,
      serving_date: today,
    },
    {
      student_id: portalKid,
      class_id: classId,
      period: 'lunch',
      served_status: 'served',
      consumption_pct: 0,
      behavior: 'refused',
      low_intake_reason: 'did_not_like_it',
      meal_service_id: lunchServiceId,
      recorded_by: classroomId,
      serving_date: today,
    },
  ];
  // Child B's outcomes are deliberately the OPPOSITE of child A's, on a
  // different meal, so a spec can tell instantly whose data is on screen.
  results.push({
    student_id: portalKidB,
    class_id: classId,
    period: 'breakfast',
    served_status: 'served',
    consumption_pct: 0,
    behavior: 'refused',
    low_intake_reason: 'did_not_like_it',
    meal_service_id: breakfastServiceId,
    recorded_by: classroomId,
    serving_date: today,
  });

  for (const row of results) {
    mustOk(
      `seed classroom meal record (${String(row.period)})`,
      await db.from('serving_records').upsert(row, { onConflict: 'student_id,serving_date,period' }),
    );
  }

  const recId = async (period: string): Promise<string> => {
    const row = must(
      `read back the seeded ${period} classroom record`,
      await db
        .from('serving_records')
        .select('id')
        .eq('student_id', portalKid)
        .eq('serving_date', today)
        .eq('period', period)
        .single(),
    ) as { id: string };
    return row.id;
  };
  const breakfastRecId = await recId('breakfast');
  const lunchRecId = await recId('lunch');

  mustOk(
    'seed serving notes (one published, one draft)',
    await db.from('serving_notes').upsert(
    [
      // created_by is NOT NULL with no default (0002). The seeder writes with
      // the service-role key, where auth.uid() is null, so it has to name the
      // author explicitly — the classroom staff member who would really have
      // written these notes.
      {
        serving_record_id: breakfastRecId,
        body: 'E2E published note',
        published_at: new Date().toISOString(),
        created_by: classroomId,
      },
      {
        serving_record_id: lunchRecId,
        body: 'E2E draft — must stay invisible',
        published_at: null,
        created_by: classroomId,
      },
      ],
      { onConflict: 'serving_record_id' },
    ),
  );

  // ---- deterministic references for the specs ------------------------------
  const refs: Record<string, string> = {
    institutionId,
    classId,
    superAdminEmail: accounts[0]!.email,
    schoolAdminEmail: accounts[1]!.email,
    operationsEmail: accounts[2]!.email,
    financeEmail: accounts[3]!.email,
    viewerEmail: accounts[4]!.email,
    parentEmail: accounts[5]!.email,
    classroomEmail: accounts[6]!.email,
    kitchenEmail: accounts[7]!.email,
    driverEmail: accounts[8]!.email,
    statusKid: statusKid,
    servingOne: servingOne,
    classForServing: classId,
    portalKid: portalKid,
    portalKidB: portalKidB,
    breakfastServiceId,
    lunchServiceId,
  };
  fs.writeFileSync(path.join(HERE, '.seeded.json'), JSON.stringify(refs, null, 2), 'utf8');
}
