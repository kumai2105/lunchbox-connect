/**
 * E2E global setup — idempotent seeding of the LIVE project on the CURRENT
 * architecture. BLOCKED_BY_ENVIRONMENT when E2E_* vars are absent (the suite
 * just skips). All rows are namespaced (E2E …).
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
  const { data: existingMeal } = await db.from('meals').select('id').eq('name', name).maybeSingle();
  let mealId = existingMeal?.id as string | undefined;
  if (!mealId) {
    const { data: createdMeal } = await db.from('meals').insert({ name }).select('id').single();
    mealId = createdMeal!.id as string;
  }
  const { data: existingRev } = await db
    .from('meal_revisions')
    .select('id')
    .eq('meal_id', mealId)
    .eq('revision_no', 1)
    .maybeSingle();
  let revId = existingRev?.id as string | undefined;
  if (!revId) {
    const { data: createdRev } = await db
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
      .single();
    revId = createdRev!.id as string;
  }
  await db.from('meals').update({ current_revision_id: revId }).eq('id', mealId);
  return revId!;
}

export default async function globalSetup(): Promise<void> {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn(
      '[e2e] E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY missing — full suite SKIPPED.',
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
  const { data: institution } = await db
    .from('institutions')
    .upsert({ name: 'E2E Nursery', kind: 'nursery' }, { onConflict: 'name' })
    .select('id')
    .single();
  const institutionId = institution!.id;

  const { data: klass } = await db
    .from('classes')
    .upsert(
      { institution_id: institutionId, name: 'E2E 1-A', grade: '1' },
      { onConflict: 'institution_id,name' },
    )
    .select('id')
    .single();
  const classId = klass!.id;

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

  for (const account of accounts) {
    const { data: existing } = await db
      .from('app_users')
      .select('user_id')
      .eq('email', account.email)
      .maybeSingle();

    if (!existing) {
      const { data: created } = await db.auth.admin.createUser({
        email: account.email,
        password: PASS,
        email_confirm: true,
        user_metadata: { full_name: account.role.replace('_', ' ').toUpperCase() },
      });

      await db.from('app_users').insert({
        user_id: created!.user!.id,
        role: account.role,
        // super_admin and parent are not institution-anchored; kitchen is a
        // Kitchen entity, not an institution. Everyone else is scoped here.
        institution_id:
          account.role === 'super_admin' ||
          account.role === 'parent' ||
          account.role === 'kitchen'
            ? null
            : institutionId,
        full_name: account.role.replace('_', ' '),
        email: account.email,
      });
    }
  }

  const { data: users } = await db.from('app_users').select('user_id, role, email');
  const byEmail = (email: string) => users!.find((u) => u.email === email)!;
  const classroomId = byEmail('e2e.classroom@lunchbox.app').user_id;
  const parentId = byEmail('e2e.parent@lunchbox.app').user_id;

  // classroom-staff assignment via class_staff (the retired teacher_id is gone)
  await db
    .from('class_staff')
    .upsert({ class_id: classId, user_id: classroomId }, { onConflict: 'class_id,user_id' });

  // ---- students (operational_status is the eligibility gate) ----------------
  const students = [
    { student_no: 'E2E-001', given_name: 'Status', family_name: 'Case', class_id: null, status: null },
    { student_no: 'E2E-101', given_name: 'Serving', family_name: 'One', class_id: classId, status: ELIGIBLE },
    { student_no: 'E2E-102', given_name: 'Serving', family_name: 'Two', class_id: classId, status: ELIGIBLE },
    { student_no: 'E2E-201', given_name: 'Portal', family_name: 'Kid', class_id: classId, status: ELIGIBLE },
  ];
  const upsertStudent = (s: (typeof students)[number]) =>
    db
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
      .single();

  const statusKid = await upsertStudent(students[0]!);
  const servingOne = await upsertStudent(students[1]!);
  await upsertStudent(students[2]!);
  const portalKid = await upsertStudent(students[3]!);

  await db
    .from('student_parents')
    .upsert({ student_id: portalKid!.id, user_id: parentId }, { onConflict: 'user_id,student_id' });

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
    const { data: service } = await db
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
      .single();
    return service!.id as string;
  };

  const breakfastServiceId = await svc('breakfast', oatsRev, today, true);
  const lunchServiceId = await svc('lunch', wrapRev, today, true);
  // A draft service tomorrow — must stay invisible to Parent/Kitchen.
  await svc('lunch', secretRev, tomorrow, false);

  // ---- today's meal results for the portal child, LINKED to their service ---
  // (0029: a served observation must carry its meal_service_id.)
  const results: Array<Record<string, unknown>> = [
    {
      student_id: portalKid!.id,
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
      student_id: portalKid!.id,
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
  for (const row of results) {
    await db.from('serving_records').upsert(row, { onConflict: 'student_id,serving_date,period' });
  }

  const recId = async (period: string): Promise<string> => {
    const { data } = await db
      .from('serving_records')
      .select('id')
      .eq('student_id', portalKid!.id)
      .eq('serving_date', today)
      .eq('period', period)
      .single();
    return data!.id as string;
  };
  const breakfastRecId = await recId('breakfast');
  const lunchRecId = await recId('lunch');

  await db.from('serving_notes').upsert(
    [
      {
        serving_record_id: breakfastRecId,
        body: 'E2E published note',
        published_at: new Date().toISOString(),
      },
      { serving_record_id: lunchRecId, body: 'E2E draft — must stay invisible', published_at: null },
    ],
    { onConflict: 'serving_record_id' },
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
    statusKid: statusKid!.id,
    servingOne: servingOne!.id,
    classForServing: classId,
    portalKid: portalKid!.id,
    breakfastServiceId,
    lunchServiceId,
  };
  fs.writeFileSync(path.join(HERE, '.seeded.json'), JSON.stringify(refs, null, 2), 'utf8');
}
