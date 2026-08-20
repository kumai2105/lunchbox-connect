import { supabase } from './supabase';
import {
  OPERATIONAL_STATUS_ELIGIBLE,
  type AppPeriod,
  type AppUser,
  type AuditLogRow,
  type ClassRow,
  type ConsumptionPct,
  type DashboardInstitutionRow,
  type EatingBehavior,
  type Institution,
  type Kitchen,
  type LowIntakeReason,
  type MealInput,
  type MealLibraryItem,
  type MealPerformanceRow,
  type MealRevisionPerformanceRow,
  type ProductionDemandRow,
  type ServedStatus,
  type ServingNote,
  type ServingRecord,
  type Student,
  type StudentParentLink,
} from './types';

export type ApiResult<T> = { data: T | null; error: string | null };

function err<T>(error: unknown): ApiResult<T> {
  const message = error instanceof Error ? error.message : String(error);
  return { data: null, error: message };
}

// ---------------------------------------------------------------- institutions
export async function listInstitutions(): Promise<ApiResult<Institution[]>> {
  const { data, error } = await supabase.from('institutions').select('*').order('name');
  if (error) return err(error);
  return { data: data as Institution[], error: null };
}

// LunchBox Connect operational entity, not an Institution (docs/13 Decision 031).
export async function listKitchens(): Promise<ApiResult<Kitchen[]>> {
  const { data, error } = await supabase.from('kitchens').select('*').order('name');
  if (error) return err(error);
  return { data: data as Kitchen[], error: null };
}

export async function createInstitution(
  name: string,
  kind: Institution['kind'],
): Promise<ApiResult<Institution>> {
  const { data, error } = await supabase
    .from('institutions')
    .insert({ name, kind })
    .select()
    .single();
  if (error) return err(error);
  return { data: data as Institution, error: null };
}

export async function dashboardSummary(): Promise<ApiResult<DashboardInstitutionRow[]>> {
  const { data, error } = await supabase.from('v_dashboard_institutions').select('*');
  if (error) return err(error);
  return { data: data as DashboardInstitutionRow[], error: null };
}

// Single authoritative Institution record — the same row the list renders,
// fetched by id for the detail view (docs/13 blueprint Part 12). RLS decides
// whether the caller may see it; a denied row comes back as null, not an error.
export async function getInstitution(id: string): Promise<ApiResult<Institution | null>> {
  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return err(error);
  return { data: (data as Institution | null) ?? null, error: null };
}

// Institution-side users (staff). Kitchen/driver users are LunchBox-side and
// scope to a kitchen, not an institution, so they correctly never appear here.
export async function staffForInstitution(institutionId: string): Promise<ApiResult<AppUser[]>> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('institution_id', institutionId)
    .order('full_name');
  if (error) return err(error);
  return { data: (data ?? []) as AppUser[], error: null };
}

// ---------------------------------------------------------------- classes
export interface ClassWithMeta extends ClassRow {
  student_count?: number;
}

export async function listClasses(): Promise<ApiResult<ClassWithMeta[]>> {
  const { data, error } = await supabase.from('classes').select('*, students(count)').order('name');
  if (error) return err(error);
  const rows = (data ?? []) as Array<ClassRow & { students: Array<{ count: number }> }>;
  const mapped: ClassWithMeta[] = rows.map((r) => ({
    id: r.id,
    institution_id: r.institution_id,
    name: r.name,
    grade: r.grade,
    active: r.active,
    student_count: r.students.length > 0 ? r.students[0].count : 0,
  }));
  return { data: mapped, error: null };
}

export async function createClass(input: {
  institution_id: string;
  name: string;
  grade?: string | null;
}): Promise<ApiResult<ClassRow>> {
  const { data, error } = await supabase.from('classes').insert(input).select().single();
  if (error) return err(error);
  return { data: data as ClassRow, error: null };
}

// Classroom Staff ⇄ Class is a many-to-many (class_staff, migration 0025):
// a class may have several staff, and a staff member several classes. These
// membership rows drive classroom_staff RLS scope (app_can_see_class /
// app_can_record_in_class / app_can_see_student).
export interface ClassStaffMember {
  user_id: string;
  full_name: string;
  email: string;
}

export async function classStaff(classId: string): Promise<ApiResult<ClassStaffMember[]>> {
  const { data, error } = await supabase
    .from('class_staff')
    .select('user_id,staff:app_users!user_id(full_name,email)')
    .eq('class_id', classId);
  if (error) return err(error);
  type Row = { user_id: string; staff: { full_name: string; email: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      user_id: r.user_id,
      full_name: r.staff?.full_name ?? '—',
      email: r.staff?.email ?? '',
    })),
    error: null,
  };
}

// All class_staff memberships within one institution (for the institution
// Staff view — which staff cover which classes, via the real join, not the
// retired teacher_id).
export async function classStaffForInstitution(
  institutionId: string,
): Promise<ApiResult<Array<{ class_id: string; class_name: string; user_id: string }>>> {
  const { data, error } = await supabase
    .from('class_staff')
    .select('class_id,user_id,class:classes!class_id(name,institution_id)')
    .eq('class.institution_id', institutionId);
  if (error) return err(error);
  type Row = { class_id: string; user_id: string; class: { name: string; institution_id: string } | null };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.class !== null);
  return {
    data: rows.map((r) => ({ class_id: r.class_id, class_name: r.class!.name, user_id: r.user_id })),
    error: null,
  };
}

export async function addClassStaff(classId: string, userId: string): Promise<ApiResult<null>> {
  const { error } = await supabase.from('class_staff').insert({ class_id: classId, user_id: userId });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function removeClassStaff(classId: string, userId: string): Promise<ApiResult<null>> {
  const { error } = await supabase
    .from('class_staff')
    .delete()
    .eq('class_id', classId)
    .eq('user_id', userId);
  if (error) return err(error);
  return { data: null, error: null };
}

// ---------------------------------------------------------------- students
export interface StudentFilters {
  institutionId?: string | null;
  classId?: string | null;
  search?: string | null;
  limit?: number;
}

export async function listStudents(filters: StudentFilters = {}): Promise<ApiResult<Student[]>> {
  let q = supabase.from('students').select('*').order('family_name').order('given_name');
  if (filters.institutionId) q = q.eq('institution_id', filters.institutionId);
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.search) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    q = q.or(`given_name.ilike.${term},family_name.ilike.${term},student_no.ilike.${term}`);
  }
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) return err(error);
  return { data: data as Student[], error: null };
}

// One authoritative Student record, fetched by id for the Student Profile
// (blueprint Part 15). Every portal that shows this child shows THIS row —
// there is no per-portal copy.
export async function getStudent(id: string): Promise<ApiResult<Student | null>> {
  const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
  if (error) return err(error);
  return { data: (data as Student | null) ?? null, error: null };
}

// Meal history for one child, newest first — the same Classroom Meal Records
// that drive Parent view and Meal analytics (blueprint Part 82/89).
export async function servingHistoryForStudent(
  studentId: string,
  limit = 60,
): Promise<ApiResult<ServingRecord[]>> {
  const { data, error } = await supabase
    .from('serving_records')
    .select('*')
    .eq('student_id', studentId)
    .order('serving_date', { ascending: false })
    .order('period')
    .limit(limit);
  if (error) return err(error);
  return { data: (data ?? []) as ServingRecord[], error: null };
}

// All meal records for one child across a date range, in ONE query. The
// parent view previously issued 4 periods x 7 days = 28 sequential requests
// per child to assemble the same thing.
export async function servingRangeForStudent(
  studentId: string,
  from: string,
  to: string,
): Promise<ApiResult<ServingRecord[]>> {
  const { data, error } = await supabase
    .from('serving_records')
    .select('*')
    .eq('student_id', studentId)
    .gte('serving_date', from)
    .lte('serving_date', to)
    .order('serving_date', { ascending: false });
  if (error) return err(error);
  return { data: (data ?? []) as ServingRecord[], error: null };
}

// Guardian accounts linked to one Student (blueprint Part 15/45).
export async function guardiansForStudent(studentId: string): Promise<ApiResult<AppUser[]>> {
  const { data, error } = await supabase
    .from('student_parents')
    .select('user:app_users(*)')
    .eq('student_id', studentId);
  if (error) return err(error);
  const rows = (data ?? []) as unknown as Array<{ user: AppUser | null }>;
  return { data: rows.map((r) => r.user).filter((u): u is AppUser => u !== null), error: null };
}

export async function createStudent(input: {
  // §7: the canonical minimum is given_name + family_name + institution_id.
  // student_no is optional (many settings do not assign one); a blank value is
  // stored as NULL, never as a colliding empty string.
  student_no?: string | null;
  institution_id: string;
  given_name: string;
  family_name: string;
  class_id?: string | null;
  grade?: string | null;
  medical_notes?: unknown[];
}): Promise<ApiResult<Student>> {
  const { data, error } = await supabase
    .from('students')
    .insert({ ...input, student_no: input.student_no?.trim() || null })
    .select()
    .single();
  if (error) return err(error);
  return { data: data as Student, error: null };
}

export async function updateStudent(
  id: string,
  patch: Partial<
    Pick<
      Student,
      'class_id' | 'given_name' | 'family_name' | 'grade' | 'enrollment_status' | 'photo_path'
    >
  >,
): Promise<ApiResult<Student>> {
  const { data, error } = await supabase
    .from('students')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return err(error);
  return { data: data as Student, error: null };
}

// Student photo (docs/13 Decision 032 §5-6): private bucket, path-scoped RLS
// (migration 0014), never a public URL. Callers must already hold a Student
// they're authorized to see/manage — the same boundary the students table uses.
const STUDENT_PHOTOS_BUCKET = 'student-photos';

export async function uploadStudentPhoto(
  studentId: string,
  file: File,
): Promise<ApiResult<string>> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${studentId}/photo.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(STUDENT_PHOTOS_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) return err(uploadError);
  const res = await updateStudent(studentId, { photo_path: path });
  if (res.error) return err(res.error);
  return { data: path, error: null };
}

export async function studentPhotoUrl(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;
  const { data, error } = await supabase.storage
    .from(STUDENT_PHOTOS_BUCKET)
    .createSignedUrl(photoPath, 60 * 30); // 30 min — re-requested per page load
  if (error || !data) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------- eligibility gate (operational status)
export const ELIGIBLE_STATUS = OPERATIONAL_STATUS_ELIGIBLE;

export async function setOperationalStatus(
  studentId: string,
  status: string | null,
): Promise<ApiResult<Student>> {
  // Only the single approved value may ever be written (docs/05 §7, §44).
  if (status !== null && status !== OPERATIONAL_STATUS_ELIGIBLE) {
    return { data: null, error: `Unapproved status value: ${status}` };
  }
  const { data, error } = await supabase
    .from('students')
    .update({ operational_status: status })
    .eq('id', studentId)
    .select()
    .single();
  if (error) return err(error);
  return { data: data as Student, error: null };
}

export async function listGuardians(): Promise<ApiResult<StudentParentLink[]>> {
  // student_parents (0002) has no created_at column — it's a plain link
  // table (user_id, student_id) with no independent ordering column, so this
  // query errored on every load. Caller sorts by the embedded student name.
  const { data, error } = await supabase
    .from('student_parents')
    .select('*, student:students(given_name, family_name, student_no)');
  if (error) return err(error);
  return { data: (data ?? []) as unknown as StudentParentLink[], error: null };
}

// Links an existing Parent-role user to a Student (docs/04 §9 confirms the
// Guardian<->Student relationship; one-to-many/primary-guardian/removal
// nuances are explicitly NOT_YET_DEFINED, so this is the plain link only —
// creation, not those undefined refinements). Gated by the same
// app_can_manage_student RLS check as everything else about a Student.
export async function linkGuardian(studentId: string, userId: string): Promise<ApiResult<null>> {
  const { error } = await supabase
    .from('student_parents')
    .insert({ student_id: studentId, user_id: userId });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function listAudit(): Promise<ApiResult<AuditLogRow[]>> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(250);
  if (error) return err(error);
  return { data: (data ?? []) as AuditLogRow[], error: null };
}

// Authoritative derived demand: eligible students per institution, plus the
// number of allergy-flagged eligible students (counts only — kitchen never
// receives student identity, AT-034 / docs/02 §33).
export interface MealDemandRow {
  institution_id: string;
  institution_name: string;
  period: AppPeriod;
  meal_revision_id: string;
  meal_name: string;
  eligible_students: number;
  allergy_flagged: number;
}

// Per-published-meal demand for a date (§33/§34): the kitchen sees the quantity
// for each ACTUAL meal, not one institution count applied to every meal.
export async function mealProductionDemand(date: string): Promise<ApiResult<MealDemandRow[]>> {
  const { data, error } = await supabase.rpc('meal_production_demand', { p_date: date });
  if (error) return err(error);
  return {
    data: ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      institution_id: r.institution_id as string,
      institution_name: r.institution_name as string,
      period: r.period as AppPeriod,
      meal_revision_id: r.meal_revision_id as string,
      meal_name: r.meal_name as string,
      eligible_students: Number(r.eligible_students),
      allergy_flagged: Number(r.allergy_flagged),
    })),
    error: null,
  };
}

export async function productionDemand(): Promise<ApiResult<ProductionDemandRow[]>> {
  const { data, error } = await supabase.from('v_production_demand').select('*');
  if (error) return err(error);
  return { data: (data ?? []) as ProductionDemandRow[], error: null };
}

// ---------------------------------------- calendar exceptions (§7)
export interface CalendarException {
  id: string;
  kind: 'closure' | 'override' | 'special_period';
  date_from: string;
  date_to: string;
  period: AppPeriod | null;
  meal_id: string | null;
  meal_name: string | null;
  rotation_id: string | null;
  rotation_name: string | null;
  reason: string | null;
}

export async function listCalendarExceptions(
  institutionId: string,
): Promise<ApiResult<CalendarException[]>> {
  const { data, error } = await supabase
    .from('calendar_exceptions')
    .select('id,kind,date_from,date_to,period,meal_id,rotation_id,reason,meal:meals!meal_id(name),rotation:rotations!rotation_id(name)')
    .eq('institution_id', institutionId)
    .order('date_from', { ascending: false });
  if (error) return err(error);
  type Row = {
    id: string; kind: CalendarException['kind']; date_from: string; date_to: string;
    period: AppPeriod | null; meal_id: string | null; rotation_id: string | null; reason: string | null;
    meal: { name: string } | null; rotation: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      id: r.id, kind: r.kind, date_from: r.date_from, date_to: r.date_to, period: r.period,
      meal_id: r.meal_id, meal_name: r.meal?.name ?? null,
      rotation_id: r.rotation_id, rotation_name: r.rotation?.name ?? null, reason: r.reason,
    })),
    error: null,
  };
}

export async function addCalendarException(input: {
  institutionId: string;
  kind: 'closure' | 'override' | 'special_period';
  dateFrom: string;
  dateTo: string;
  period?: AppPeriod | null;
  mealId?: string | null;
  rotationId?: string | null;
  reason?: string | null;
}): Promise<ApiResult<null>> {
  const { error } = await supabase.from('calendar_exceptions').insert({
    institution_id: input.institutionId,
    kind: input.kind,
    date_from: input.dateFrom,
    date_to: input.dateTo,
    period: input.period ?? null,
    meal_id: input.kind === 'override' ? (input.mealId ?? null) : null,
    rotation_id: input.kind === 'special_period' ? (input.rotationId ?? null) : null,
    reason: input.reason ?? null,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function deleteCalendarException(id: string): Promise<ApiResult<null>> {
  const { error } = await supabase.from('calendar_exceptions').delete().eq('id', id);
  if (error) return err(error);
  return { data: null, error: null };
}

// ---------------------------------------- institution service config (§7,§12,§47)
// The Admin sets, per institution, the CONTRACTED meal periods (service plan)
// and which menu (rotation) applies from when. Never inferred from the menu.
export interface InstitutionServiceConfig {
  periods: AppPeriod[] | null;
  plan_effective_from: string | null;
  rotation_id: string | null;
  rotation_name: string | null;
  anchor_week: number | null;
  rotation_effective_from: string | null;
}

export async function getInstitutionServiceConfig(
  institutionId: string,
): Promise<ApiResult<InstitutionServiceConfig>> {
  const [planRes, assignRes] = await Promise.all([
    supabase
      .from('institution_service_plans')
      .select('periods,effective_from')
      .eq('institution_id', institutionId)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('institution_rotation_assignments')
      .select('rotation_id,anchor_week,effective_from,rotation:rotations!rotation_id(name)')
      .eq('institution_id', institutionId)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (planRes.error) return err(planRes.error);
  if (assignRes.error) return err(assignRes.error);
  const plan = planRes.data as { periods: AppPeriod[]; effective_from: string } | null;
  const asg = assignRes.data as
    | { rotation_id: string; anchor_week: number; effective_from: string; rotation: { name: string } | null }
    | null;
  return {
    data: {
      periods: plan?.periods ?? null,
      plan_effective_from: plan?.effective_from ?? null,
      rotation_id: asg?.rotation_id ?? null,
      rotation_name: asg?.rotation?.name ?? null,
      anchor_week: asg?.anchor_week ?? null,
      rotation_effective_from: asg?.effective_from ?? null,
    },
    error: null,
  };
}

export async function setInstitutionServicePlan(
  institutionId: string,
  periods: AppPeriod[],
  effectiveFrom: string,
): Promise<ApiResult<null>> {
  const { error } = await supabase
    .from('institution_service_plans')
    .insert({ institution_id: institutionId, periods, effective_from: effectiveFrom });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function assignInstitutionRotation(
  institutionId: string,
  rotationId: string,
  anchorWeek: number,
  effectiveFrom: string,
): Promise<ApiResult<null>> {
  const { error } = await supabase.from('institution_rotation_assignments').insert({
    institution_id: institutionId,
    rotation_id: rotationId,
    anchor_week: anchorWeek,
    effective_from: effectiveFrom,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

// Publish (materialize) dated Meal Services for an explicit window. Gated in
// the DB: only a Super Admin, and it will not overwrite already-served rows.
export async function publishInstitutionWindow(
  institutionId: string,
  from: string,
  to: string,
): Promise<ApiResult<number>> {
  const { data, error } = await supabase.rpc('publish_meal_services', {
    p_inst: institutionId,
    p_from: from,
    p_to: to,
  });
  if (error) return err(error);
  return { data: (data as number) ?? 0, error: null };
}

// ------------------------------------------------- menus / rotations (§5)
// A "Menu" in the Admin UI is a rotation: a named, N-week arrangement of meals
// into day/period slots. Duration is data-driven (week_count), never fixed.
export interface RotationSummary {
  id: string;
  name: string;
  week_count: number;
  active: boolean;
  slot_count: number;
}
export interface RotationSlotRow {
  week_number: number;
  weekday: number; // 0=Mon..4=Fri
  period: AppPeriod;
  meal_id: string;
  meal_name: string;
}

export async function listRotations(): Promise<ApiResult<RotationSummary[]>> {
  const { data, error } = await supabase
    .from('rotations')
    .select('id,name,week_count,active,rotation_slots(count)')
    .order('name');
  if (error) return err(error);
  type Row = { id: string; name: string; week_count: number; active: boolean; rotation_slots: Array<{ count: number }> };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      id: r.id, name: r.name, week_count: r.week_count, active: r.active,
      slot_count: r.rotation_slots?.[0]?.count ?? 0,
    })),
    error: null,
  };
}

export async function createRotation(name: string, weekCount: number): Promise<ApiResult<string>> {
  const { data, error } = await supabase
    .from('rotations')
    .insert({ name, week_count: weekCount })
    .select('id')
    .single();
  if (error) return err(error);
  return { data: (data as { id: string }).id, error: null };
}

export async function setRotationWeekCount(id: string, weekCount: number): Promise<ApiResult<null>> {
  // Shrinking removes the now-out-of-range slots so no orphan planning lingers.
  const { error: delErr } = await supabase
    .from('rotation_slots')
    .delete()
    .eq('rotation_id', id)
    .gt('week_number', weekCount);
  if (delErr) return err(delErr);
  const { error } = await supabase.from('rotations').update({ week_count: weekCount }).eq('id', id);
  if (error) return err(error);
  return { data: null, error: null };
}

export async function setRotationActive(id: string, active: boolean): Promise<ApiResult<null>> {
  const { error } = await supabase.from('rotations').update({ active }).eq('id', id);
  if (error) return err(error);
  return { data: null, error: null };
}

export async function rotationSlots(rotationId: string): Promise<ApiResult<RotationSlotRow[]>> {
  const { data, error } = await supabase
    .from('rotation_slots')
    .select('week_number,weekday,period,meal_id,meal:meals!meal_id(name)')
    .eq('rotation_id', rotationId);
  if (error) return err(error);
  type Row = { week_number: number; weekday: number; period: AppPeriod; meal_id: string; meal: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      week_number: r.week_number, weekday: r.weekday, period: r.period,
      meal_id: r.meal_id, meal_name: r.meal?.name ?? '—',
    })),
    error: null,
  };
}

// Assign a meal to a slot (upsert), or clear it (mealId null → delete the row).
export async function setRotationSlot(
  rotationId: string, week: number, weekday: number, period: AppPeriod, mealId: string | null,
): Promise<ApiResult<null>> {
  if (mealId === null) {
    const { error } = await supabase.from('rotation_slots').delete()
      .eq('rotation_id', rotationId).eq('week_number', week).eq('weekday', weekday).eq('period', period);
    if (error) return err(error);
    return { data: null, error: null };
  }
  const { error } = await supabase.from('rotation_slots').upsert(
    { rotation_id: rotationId, week_number: week, weekday, period, meal_id: mealId },
    { onConflict: 'rotation_id,week_number,weekday,period' },
  );
  if (error) return err(error);
  return { data: null, error: null };
}

// ------------------------------------------------- meal library (0024, §4)
// The single source of Meals for the whole system. Admin creates a Meal once
// here; Menu, Kitchen, Classroom, Parent and Analytics all reference it.
export async function listMeals(opts?: {
  search?: string;
  includeArchived?: boolean;
}): Promise<ApiResult<MealLibraryItem[]>> {
  let q = supabase
    .from('meals')
    .select(
      'id,name,active,current_revision_id,rev:meal_revisions!current_revision_id(ingredients,allergens,nutrition,portion,image_path,nutrition_status,revision_no)',
    )
    .order('name');
  if (!opts?.includeArchived) q = q.eq('active', true);
  if (opts?.search) q = q.ilike('name', `%${opts.search}%`);
  const { data, error } = await q;
  if (error) return err(error);
  type Row = {
    id: string; name: string; active: boolean; current_revision_id: string | null;
    rev: {
      ingredients: unknown; allergens: unknown; nutrition: unknown;
      portion: string | null; image_path: string | null; nutrition_status: string;
      revision_no: number;
    } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      id: r.id, name: r.name, active: r.active, current_revision_id: r.current_revision_id,
      ingredients: asStringArray(r.rev?.ingredients),
      allergens: asStringArray(r.rev?.allergens),
      nutrition: (r.rev?.nutrition as Record<string, unknown>) ?? {},
      portion: r.rev?.portion ?? null,
      image_path: r.rev?.image_path ?? null,
      nutrition_status: r.rev?.nutrition_status ?? 'NOT_APPROVED',
      revision_no: r.rev?.revision_no ?? null,
    })),
    error: null,
  };
}

export async function saveMeal(input: MealInput): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('save_meal', {
    p_meal_id: input.id ?? null,
    p_name: input.name,
    p_ingredients: input.ingredients,
    p_allergens: input.allergens,
    p_nutrition: input.nutrition,
    p_portion: input.portion,
    p_image_path: input.image_path ?? null,
    p_nutrition_status: input.nutrition_status ?? 'NOT_APPROVED',
  });
  if (error) return err(error);
  return { data: data as string, error: null };
}

export async function setMealActive(id: string, active: boolean): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('set_meal_active', { p_meal_id: id, p_active: active });
  if (error) return err(error);
  return { data: null, error: null };
}

// Upload a meal image and return its storage path. Independent of any meal id
// so it can run BEFORE the meal exists — the caller then saves the meal once
// with this path, producing exactly one revision per intentional edit. Image
// visibility is enforced by the storage RLS policy (path is not a secret).
export async function uploadMealImage(file: File): Promise<ApiResult<string>> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('meal-images').upload(path, file, { upsert: true });
  if (error) return err(error);
  return { data: path, error: null };
}

export async function mealImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from('meal-images').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ------------------------------------------------- meal services (0016/0017)
// The authoritative dated schedule. Replaces the legacy `menus` lookup, which
// addressed dishes by a single global calendar-week number and so could not
// express a per-institution rotation, a closure, or a date override. RLS scopes
// what comes back: Kitchen sees every institution it serves, a Parent sees only
// their child's, and NOBODY except a Super Admin sees an unpublished row.
export interface DayMeal {
  service_id: string;
  institution_id: string;
  service_date: string;
  period: AppPeriod;
  // §9: the STABLE Meal identity behind this dated service. Parent preference
  // grouping keys on this, not the dish-name text, so the same meal served on
  // several days aggregates as one even if a later revision renames it. The
  // served revision's name is preserved as dish_name for historical detail.
  meal_id: string;
  dish_name: string;
  allergens: string[];
  ingredients: string[];
  portion: string | null;
  nutrition: Record<string, unknown>;
  image_path: string | null;
}

interface RawService {
  id: string;
  institution_id: string;
  service_date: string;
  period: AppPeriod;
  rev: {
    name: string;
    meal_id: string;
    allergens: unknown;
    ingredients: unknown;
    portion: string | null;
    nutrition: unknown;
    image_path: string | null;
  } | null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export async function mealsForDates(
  from: string,
  to: string,
  institutionId?: string | null,
): Promise<ApiResult<DayMeal[]>> {
  let q = supabase
    .from('meal_services')
    .select(
      'id,institution_id,service_date,period,rev:meal_revisions!meal_revision_id(name,meal_id,allergens,ingredients,portion,nutrition,image_path)',
    )
    .gte('service_date', from)
    .lte('service_date', to)
    // Belt and braces. RLS already hides drafts from every role but Super
    // Admin, and a Super Admin viewing the Kitchen screen must not be shown
    // a draft as though the kitchen were going to cook it.
    .eq('published', true)
    .order('service_date')
    .order('period');
  if (institutionId) q = q.eq('institution_id', institutionId);
  const { data, error } = await q;
  if (error) return err(error);
  const rows = (data ?? []) as unknown as RawService[];
  return {
    data: rows
      // A service whose revision is missing is skipped rather than rendered as
      // a blank dish — the spec forbids showing a meal that was never resolved.
      .filter((r) => r.rev !== null)
      .map((r) => ({
        service_id: r.id,
        institution_id: r.institution_id,
        service_date: r.service_date,
        period: r.period,
        meal_id: r.rev!.meal_id,
        dish_name: r.rev!.name,
        allergens: asStringArray(r.rev!.allergens),
        ingredients: asStringArray(r.rev!.ingredients),
        portion: r.rev!.portion,
        nutrition: (r.rev!.nutrition as Record<string, unknown>) ?? {},
        image_path: r.rev!.image_path,
      })),
    error: null,
  };
}

// Links a Classroom observation to the exact dated service it was recorded
// against, giving Production -> Meal -> revision traceability. Returns null
// when nothing is published for that slot, and the caller must record the
// observation anyway rather than inventing a service.
export async function resolveMealServiceId(
  institutionId: string,
  serving_date: string,
  period: AppPeriod,
): Promise<string | null> {
  const { data } = await supabase
    .from('meal_services')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('service_date', serving_date)
    .eq('period', period)
    .eq('published', true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// Meal-performance analytics (docs/13 Decision 032, Super Admin only via RLS
// on v_meal_performance — returns empty for any other role).
export async function mealPerformance(): Promise<ApiResult<MealPerformanceRow[]>> {
  const { data, error } = await supabase
    .from('v_meal_performance')
    .select('*')
    .order('avg_consumption_pct', { ascending: true, nullsFirst: false });
  if (error) return err(error);
  return { data: (data ?? []) as MealPerformanceRow[], error: null };
}

// Revision-level performance (integrity item 2): the same observations kept
// split per meal revision, for before/after recipe evaluation.
export async function mealRevisionPerformance(): Promise<ApiResult<MealRevisionPerformanceRow[]>> {
  const { data, error } = await supabase
    .from('v_meal_revision_performance')
    .select('*')
    .order('meal_name')
    .order('revision_no');
  if (error) return err(error);
  return { data: (data ?? []) as MealRevisionPerformanceRow[], error: null };
}

// Raw Classroom Meal Records for analytics, joined to the Meal they were
// recorded against and the Student's institution. Everything on the Meal
// Analytics screen is computed from these rows, so changing any filter
// genuinely recalculates every KPI, chart and table (blueprint Part 94)
// rather than relabelling a fixed aggregate. RLS scopes what comes back.
export interface ObservationRow extends ServingRecord {
  menu: { id: string; dish_name: string; period: AppPeriod } | null;
  student: { institution_id: string; class_id: string | null } | null;
}

export interface ObservationFilters {
  from: string;
  to: string;
  institutionId?: string | null;
  classId?: string | null;
  period?: AppPeriod | null;
}

export async function mealObservations(
  filters: ObservationFilters,
): Promise<ApiResult<ObservationRow[]>> {
  // §31: group observations by the authoritative Meal (via
  // meal_service -> meal_revision -> meal), NOT the legacy menu_item_id.
  // meal_revision.meal_id is the stable meal identity, so the same meal served
  // on different days aggregates as one — and post-cutover records (which have
  // meal_service_id, not menu_item_id) are included.
  let q = supabase
    .from('serving_records')
    .select(
      '*, svc:meal_services!meal_service_id(period,rev:meal_revisions!meal_revision_id(name,meal_id)), student:students!inner(institution_id,class_id)',
    )
    .gte('serving_date', filters.from)
    .lte('serving_date', filters.to)
    .order('serving_date', { ascending: false })
    .limit(5000);
  if (filters.institutionId) q = q.eq('student.institution_id', filters.institutionId);
  if (filters.classId) q = q.eq('class_id', filters.classId);
  if (filters.period) q = q.eq('period', filters.period);
  const { data, error } = await q;
  if (error) return err(error);
  type Raw = ServingRecord & {
    svc: { period: AppPeriod; rev: { name: string; meal_id: string } | null } | null;
    student: { institution_id: string; class_id: string | null } | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  return {
    data: rows.map((r) => ({
      ...r,
      // map into the stable meal identity so the page keys by MEAL, not service
      menu: r.svc?.rev
        ? { id: r.svc.rev.meal_id, dish_name: r.svc.rev.name, period: r.svc.period }
        : null,
      student: r.student,
    })) as unknown as ObservationRow[],
    error: null,
  };
}

// ---------------------------------------------------------------- serving
export async function rosterForClass(classId: string): Promise<ApiResult<Student[]>> {
  // §41: operational_status = ACTIVE_BILLABLE_TO_NURSERY is the SOLE
  // authoritative eligibility gate (docs/03 §5). The legacy enrollment_status
  // is not an additional requirement — a billable child is eligible regardless
  // of the old enrolled/pending/withdrawn value.
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .eq('operational_status', OPERATIONAL_STATUS_ELIGIBLE)
    .order('family_name')
    .order('given_name');
  if (error) return err(error);
  return { data: data as Student[], error: null };
}

export async function servingForDay(
  classId: string,
  date: string,
  period: AppPeriod,
): Promise<ApiResult<ServingRecord[]>> {
  const { data, error } = await supabase
    .from('serving_records')
    .select('*')
    .eq('class_id', classId)
    .eq('serving_date', date)
    .eq('period', period);
  if (error) return err(error);
  return { data: (data ?? []) as ServingRecord[], error: null };
}

export interface MealObservationInput {
  student_id: string;
  period: AppPeriod;
  served_status: ServedStatus;
  consumption_pct?: ConsumptionPct | null;
  behavior?: EatingBehavior | null;
  low_intake_reason?: LowIntakeReason | null;
  concern_observed?: boolean;
  menu_item_id?: string | null;
  /** The dated Meal Service this observation was recorded against (0016/0020). */
  meal_service_id?: string | null;
  note?: string | null;
}

export async function recordServing(
  classId: string,
  rows: MealObservationInput[],
  date: string,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('record_serving_batch', {
    p_class: classId,
    p_rows: rows,
    p_date: date,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function servingForStudent(
  studentId: string,
  date: string,
  period: AppPeriod,
): Promise<ApiResult<ServingRecord | null>> {
  const { data, error } = await supabase
    .from('serving_records')
    .select('*')
    .eq('student_id', studentId)
    .eq('serving_date', date)
    .eq('period', period)
    .maybeSingle();
  if (error) return err(error);
  return { data: (data as ServingRecord | null) ?? null, error: null };
}

// ---------------------------------------------------------------- notes
export async function notesForServing(recordIds: string[]): Promise<ApiResult<ServingNote[]>> {
  if (recordIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from('serving_notes')
    .select('*')
    .in('serving_record_id', recordIds);
  if (error) return err(error);
  return { data: (data ?? []) as ServingNote[], error: null };
}

// Parent-safe review queue (blueprint Parts 66-67). A staff note is internal
// until a reviewer publishes it: `published_at is null` IS the pending state,
// and the serving_notes RLS policy independently prevents a parent from
// reading an unpublished body regardless of what any screen does.
export interface PendingNote extends ServingNote {
  record: {
    id: string;
    student_id: string;
    serving_date: string;
    period: AppPeriod;
    class_id: string | null;
    student: { given_name: string; family_name: string; student_no: string } | null;
  } | null;
}

export async function pendingParentNotes(): Promise<ApiResult<PendingNote[]>> {
  const { data, error } = await supabase
    .from('serving_notes')
    .select(
      '*, record:serving_records!inner(id,student_id,serving_date,period,class_id,student:students(given_name,family_name,student_no))',
    )
    .is('published_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return err(error);
  return { data: (data ?? []) as unknown as PendingNote[], error: null };
}

/** Approve a reviewed note for the child's family, optionally with redactions. */
export async function publishParentNote(
  noteId: string,
  body: string,
): Promise<ApiResult<ServingNote>> {
  const { data, error } = await supabase
    .from('serving_notes')
    .update({ body, published_at: new Date().toISOString() })
    .eq('id', noteId)
    .select()
    .single();
  if (error) return err(error);
  return { data: data as ServingNote, error: null };
}

export async function upsertServingNote(
  servingRecordId: string,
  body: string,
  published: boolean,
): Promise<ApiResult<ServingNote>> {
  const existing = await supabase
    .from('serving_notes')
    .select('id')
    .eq('serving_record_id', servingRecordId)
    .maybeSingle();
  const { data, error } = await supabase
    .from('serving_notes')
    .upsert(
      {
        id: existing.data?.id ?? undefined,
        serving_record_id: servingRecordId,
        body,
        published_at: published ? new Date().toISOString() : null,
      },
      { onConflict: 'serving_record_id' },
    )
    .select()
    .single();
  if (error) return err(error);
  return { data: data as ServingNote, error: null };
}

// ---------------------------------------------------------------- parent
export async function myChildren(): Promise<ApiResult<Student[]>> {
  const { data, error } = await supabase
    .from('students')
    .select('*, parents:student_parents!inner(user_id)')
    .eq('parents.user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
  if (error) return err(error);
  return { data: (data ?? []) as Student[], error: null };
}

export async function myChildrenLinks(): Promise<ApiResult<StudentParentLink[]>> {
  const { data, error } = await supabase
    .from('student_parents')
    .select('*')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
  if (error) return err(error);
  return { data: (data ?? []) as StudentParentLink[], error: null };
}

// ---------------------------------------------------------------- users
export async function listUsers(): Promise<ApiResult<AppUser[]>> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return err(error);
  return { data: (data ?? []) as AppUser[], error: null };
}

export async function createAccount(input: {
  email: string;
  password: string;
  fullName: string;
  role: string;
  institutionId?: string | null;
  kitchenId?: string | null;
  phone?: string | null;
  authenticate?: boolean;
}): Promise<ApiResult<{ user_id: string }>> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: input });
  if (error) return err(error);
  return { data: data as { user_id: string }, error: null };
}
