/**
 * E2E global setup — idempotent seeding of the LIVE project.
 * BLOCKED_BY_ENVIRONMENT when E2E_* vars are absent (the suite just skips).
 * All rows are namespaced (E2E …) and upserted on their own unique keys.
 * Matches the nine approved role domains (docs/02) and the operational
 * eligibility rule (ACTIVE_BILLABLE_TO_NURSERY).
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASS = process.env.E2E_PASSWORD ?? 'E2e-pass!12345';
const ELIGIBLE = 'ACTIVE_BILLABLE_TO_NURSERY';
const HERE = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  const url = process.env.E2E_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn(
      '[e2e] E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY missing — full suite SKIPPED.',
    );
    return;
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);

  // ---- institution + class ---------------------------------------------------
  const { data: institution } = await db
    .from('institutions')
    .upsert({ name: 'E2E School', kind: 'other' }, { onConflict: 'name' })
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

  // ---- nine approved role domains ----------------------------------------------
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
        institution_id:
          account.role === 'super_admin' || account.role === 'parent' ? null : institutionId,
        full_name: account.role.replace('_', ' '),
        email: account.email,
      });
    }
  }

  const { data: users } = await db.from('app_users').select('user_id, role, email');
  const byEmail = (email: string) => users!.find((u) => u.email === email)!;
  const classroomId = byEmail('e2e.classroom@lunchbox.app').user_id;
  const parentId = byEmail('e2e.parent@lunchbox.app').user_id;

  // classroom staff assignment — the basis of the assigned-class scope (AT-032)
  await db.from('classes').update({ teacher_id: classroomId }).eq('id', classId);

  // ---- students ----------------------------------------------------------------
  const students = [
    {
      student_no: 'E2E-001',
      given_name: 'Status',
      family_name: 'Case',
      class_id: null,
      status: null,
    },
    {
      student_no: 'E2E-101',
      given_name: 'Serving',
      family_name: 'One',
      class_id: classId,
      status: ELIGIBLE,
    },
    {
      student_no: 'E2E-102',
      given_name: 'Serving',
      family_name: 'Two',
      class_id: classId,
      status: ELIGIBLE,
    },
    {
      student_no: 'E2E-201',
      given_name: 'Portal',
      family_name: 'Kid',
      class_id: classId,
      status: ELIGIBLE,
    },
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
          enrollment_status: 'enrolled',
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

  // ---- current-week menu: two published reference dishes + one unpublished ----
  const weekCurrent = isoWeek(new Date());
  for (const dish of [
    {
      week_number: weekCurrent,
      weekday: 0,
      period: 'breakfast',
      dish_name: 'E2E overnight oats',
      ingredients: ['oats', 'banana', 'milk'],
      allergens: ['Gluten', 'Dairy'],
      portion: '115 g',
      nutrition: { kcal: 185 },
      published: true,
    },
    {
      week_number: weekCurrent,
      weekday: 0,
      period: 'lunch',
      dish_name: 'E2E wrap',
      ingredients: ['tortilla', 'chicken'],
      allergens: ['Gluten'],
      portion: '130 g',
      nutrition: { kcal: 310 },
      published: true,
    },
    {
      week_number: weekCurrent,
      weekday: 1,
      period: 'lunch',
      dish_name: 'UNPUBLISHED-E2E secret',
      ingredients: [],
      allergens: [],
      portion: null,
      nutrition: {},
      published: false,
    },
  ]) {
    await db.from('menus').upsert(dish, { onConflict: 'week_number,weekday,period' });
  }

  // ---- today's meal results for the portal child (docs/13 Decision 032) ---------
  for (const row of [
    {
      student_id: portalKid!.id,
      period: 'breakfast',
      served_status: 'served',
      consumption_pct: 100,
      behavior: 'ate_independently',
      serving_date: today,
    },
    {
      student_id: portalKid!.id,
      period: 'lunch',
      served_status: 'served',
      consumption_pct: 0,
      behavior: 'refused',
      low_intake_reason: 'did_not_like_it',
      serving_date: today,
    },
  ]) {
    await db.from('serving_records').upsert(row, { onConflict: 'student_id,serving_date,period' });
  }

  const breakfastRec = await db
    .from('serving_records')
    .select('id')
    .eq('student_id', portalKid!.id)
    .eq('serving_date', today)
    .eq('period', 'breakfast')
    .single()
    .then((r) => r.data);
  const lunchRec = await db
    .from('serving_records')
    .select('id')
    .eq('student_id', portalKid!.id)
    .eq('serving_date', today)
    .eq('period', 'lunch')
    .single()
    .then((r) => r.data);

  await db.from('serving_notes').upsert(
    [
      {
        serving_record_id: breakfastRec!.id,
        body: 'E2E published note',
        published_at: new Date().toISOString(),
      },
      {
        serving_record_id: lunchRec!.id,
        body: 'E2E draft — must stay invisible',
        published_at: null,
      },
    ],
    { onConflict: 'serving_record_id' },
  );

  // ---- deterministic references for the specs ---------------------------------
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
  };
  fs.writeFileSync(path.join(HERE, '.seeded.json'), JSON.stringify(refs, null, 2), 'utf8');
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (+date - +firstThursday) / (7 * 24 * 3600 * 1000);
  return 1 + Math.round((diff + 1) / 7);
}
