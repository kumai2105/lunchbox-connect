import { supabase } from './supabase';
import { PERIOD_ORDER } from './periods';

// The client-readable columns of a Classroom Meal Record.
//
// Enumerated rather than `*` on purpose: the LEGACY `note` column has been
// retired and its SELECT privilege revoked (migration 0034), so `select *`
// would now be refused for every role. Historical values are preserved in
// serving_record_note_archive, which no API role can read.
const SERVING_RECORD_COLUMNS =
  'id,serving_date,class_id,student_id,period,served_status,consumption_pct,behavior,low_intake_reason,concern_observed,menu_item_id,meal_service_id,recorded_by,created_at,updated_at';

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
  // ---- operational spine (0048–0053)
  type DeliveryConfig,
  type DeliveryManifest,
  type DemandDriftRow,
  type DemandRow,
  type DietaryRequirement,
  type DietaryRequirementType,
  type DietaryReviewStatus,
  type FinalDemand,
  type IssueStatus,
  type KitchenSpecialMeal,
  type ManifestLine,
  type MealPlan,
  type OperationalIssue,
  type OperationalStage,
  type PlanReadinessRow,
  type ProductionRun,
  type ReconciliationRow,
  type RosterRow,
  type SpecialLine,
  type SpecialMealResolutionKind,
  type StudentMealPlan,
  type UnresolvedDecision,
} from './types';

export type ApiResult<T> = { data: T | null; error: string | null };

/**
 * Turn whatever the data layer rejected with into text a human can act on.
 *
 * PostgREST does NOT hand back an Error on the `{ data, error }` path. Reading
 * @supabase/postgrest-js `processResponse`, a failed request does literally
 * `error = JSON.parse(await res.text())` — a PLAIN OBJECT shaped
 * `{ message, details, hint, code }`. `error instanceof Error` is therefore
 * false for every database refusal the app can encounter, and the previous
 * `String(error)` fallback rendered all of them as the literal text
 * "[object Object]".
 *
 * That is not a cosmetic problem. Every one of the err() call sites below
 * feeds a Banner the user reads, so an RLS refusal, a constraint violation and
 * a network fault were indistinguishable to the operator AND to anyone
 * diagnosing a failure — a real class-creation refusal was reported as
 * "[object Object]" for five diagnosis rounds with its cause erased.
 *
 * message, details and hint are joined because PostgREST routinely puts the
 * actionable half in `details` ("Key (institution_id)=(…) is not present in
 * table …") while `message` carries only the class of fault. The SQLSTATE is
 * appended so a refusal can be identified exactly (42501 = RLS, 23503 = FK,
 * 23505 = unique) rather than inferred from prose.
 */
export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const e = error as Partial<Record<'message' | 'details' | 'hint' | 'code', unknown>>;
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const parts = [text(e.message), text(e.details), text(e.hint)].filter(
      (x): x is string => x !== null,
    );
    const code = text(e.code);
    if (parts.length) return code ? `${parts.join(' — ')} [${code}]` : parts.join(' — ');
    // Never fall through to String(): an unrecognised object must still say
    // something, and its own JSON is infinitely more useful than "[object Object]".
    try {
      return JSON.stringify(error);
    } catch {
      return 'an unidentifiable error object was returned';
    }
  }
  return String(error);
}

function err<T>(error: unknown): ApiResult<T> {
  return { data: null, error: messageOf(error) };
}

/**
 * Invoke an Edge Function and surface the REFUSAL, not the wrapper.
 *
 * supabase-js turns any non-2xx from a function into a FunctionsHttpError
 * whose `message` is the constant string "Edge Function returned a non-2xx
 * status code". The actual reason — "You cannot deactivate the last active
 * Super Admin", "a Nursery Admin may only create staff for their own
 * institution" — is in the RESPONSE BODY, which that error carries on
 * `.context` as an unread Response. Without reading it, every server-side
 * refusal reaches the operator as that one useless sentence.
 */
async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      try {
        const parsed = (await res.json()) as { error?: string };
        if (parsed?.error) return { data: null, error: parsed.error };
      } catch {
        /* not JSON — fall through to the generic message */
      }
    }
    return err(error);
  }
  const parsed = data as ({ error?: string } & T) | null;
  if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error)
    return { data: null, error: parsed.error };
  return { data: (parsed ?? null) as T | null, error: null };
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

// Institution identity is normal Super Admin configuration, not a developer
// task: a nursery gets renamed, or was recorded under the wrong type. 0033's
// institutions_update policy and 0041's UPDATE grant already permit exactly
// this — until now nothing in the UI reached them, so the only way to correct
// a name was a database edit. Archival/delete stays impossible by design.
export async function updateInstitution(
  id: string,
  name: string,
  kind: Institution['kind'],
): Promise<ApiResult<Institution>> {
  const { data, error } = await supabase
    .from('institutions')
    .update({ name, kind })
    .eq('id', id)
    .select()
    .single();
  if (error) return err(error);
  return { data: data as Institution, error: null };
}

/**
 * Archive or reactivate an Institution (migration 0044).
 *
 * Super Admin only. Archiving is refused while the Institution still has
 * PUBLISHED meal service dated today or later — a commitment the kitchen and
 * the classrooms are already working to. The refusal names the reason; it is
 * not converted into something else behind the operator's back.
 *
 * There is no permanent delete. An Institution owns students, classes,
 * published service and observations, and destroying it would destroy the
 * record of meals that were actually served to children.
 */
export async function setInstitutionActive(
  institutionId: string,
  active: boolean,
  reason: string | null,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('set_institution_active', {
    p_inst: institutionId,
    p_active: active,
    p_reason: reason?.trim() || null,
  });
  if (error) return err(error);
  return { data: null, error: null };
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
    archived_at: r.archived_at ?? null,
    archived_by: r.archived_by ?? null,
    archived_reason: r.archived_reason ?? null,
    student_count: r.students.length > 0 ? r.students[0].count : 0,
  }));
  return { data: mapped, error: null };
}

/**
 * Archive or reactivate a Class (migration 0044).
 *
 * The Super Admin chooses the action; the database decides whether it is
 * allowed. Archiving refuses while students or staff are still assigned,
 * because an archived Class that still holds a roster is a lie. There is no
 * permanent delete for a Class that has ever been recorded against, and the
 * caller is told exactly that rather than having the action silently
 * downgraded.
 */
export async function setClassActive(
  classId: string,
  active: boolean,
  reason: string | null,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('set_class_active', {
    p_class: classId,
    p_active: active,
    p_reason: reason?.trim() || null,
  });
  if (error) return err(error);
  return { data: null, error: null };
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
  type Row = {
    class_id: string;
    user_id: string;
    class: { name: string; institution_id: string } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.class !== null);
  return {
    data: rows.map((r) => ({
      class_id: r.class_id,
      class_name: r.class!.name,
      user_id: r.user_id,
    })),
    error: null,
  };
}

export async function addClassStaff(classId: string, userId: string): Promise<ApiResult<null>> {
  const { error } = await supabase
    .from('class_staff')
    .insert({ class_id: classId, user_id: userId });
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
    .select(SERVING_RECORD_COLUMNS)
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
    .select(SERVING_RECORD_COLUMNS)
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
      | 'class_id'
      | 'given_name'
      | 'family_name'
      // Optional in the canonical model (§7): a setting that issues no student
      // numbers stores NULL, so the field must be clearable, not just editable.
      | 'student_no'
      | 'grade'
      | 'enrollment_status'
      | 'photo_path'
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
// number carrying any INTERIM safety note (medical_notes) — not an
// authoritative allergy flag (§42 structured model is BLOCKED_BY_SPEC).
// Counts only — kitchen never receives student identity (AT-034 / docs/02 §33).
export interface MealDemandRow {
  institution_id: string;
  institution_name: string;
  period: AppPeriod;
  meal_revision_id: string;
  meal_name: string;
  eligible_students: number;
  safety_note_flagged: number;
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
      safety_note_flagged: Number(r.safety_note_flagged),
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
    .select(
      'id,kind,date_from,date_to,period,meal_id,rotation_id,reason,meal:meals!meal_id(name),rotation:rotations!rotation_id(name)',
    )
    .eq('institution_id', institutionId)
    .order('date_from', { ascending: false });
  if (error) return err(error);
  type Row = {
    id: string;
    kind: CalendarException['kind'];
    date_from: string;
    date_to: string;
    period: AppPeriod | null;
    meal_id: string | null;
    rotation_id: string | null;
    reason: string | null;
    meal: { name: string } | null;
    rotation: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      date_from: r.date_from,
      date_to: r.date_to,
      period: r.period,
      meal_id: r.meal_id,
      meal_name: r.meal?.name ?? null,
      rotation_id: r.rotation_id,
      rotation_name: r.rotation?.name ?? null,
      reason: r.reason,
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
// ------------------------------------------- per-institution configuration
// An Institution's supported configuration is not a fixed list of fields. It
// is three effective-dated record sets plus one action:
//
//   institution_service_plans          which meal periods this institution
//                                      receives, from a date (0016)
//   institution_rotation_assignments   which menu applies, from a date, and
//                                      which of that menu's weeks that date
//                                      lands on (0016)
//   calendar_exceptions                closures / one-off meal changes /
//                                      special periods, by date range (0016)
//   publish_meal_services(...)         materializes the above into dated
//                                      Meal Services for a window
//
// "Change it later" therefore means adding a row with a LATER effective_from,
// never editing the old one — which is why every read here is a timeline and
// not a single value. The resolver picks the newest row at or before the date
// being resolved (resolve_rotation_week / service_plan_includes, 0016), so a
// row dated in the future is SCHEDULED, not current, and the UI must say so.
export interface ServicePlanRow {
  id: string;
  periods: AppPeriod[];
  effective_from: string;
}
export interface RotationAssignmentRow {
  id: string;
  rotation_id: string;
  rotation_name: string | null;
  anchor_week: number;
  effective_from: string;
}
export interface InstitutionConfigTimeline {
  plans: ServicePlanRow[];
  assignments: RotationAssignmentRow[];
}

/**
 * Which row governs `onDate`, given rows ordered newest effective_from first.
 *
 * This is the client-side mirror of the database's `order by effective_from
 * desc limit 1` (0016). It exists so the UI cannot claim a future-dated row is
 * in effect today — the previous read took the newest row unconditionally and
 * labelled it "Current", which was wrong the moment anyone scheduled a change.
 */
export function configInEffectOn<T extends { effective_from: string }>(
  rows: T[],
  onDate: string,
): T | null {
  return rows.find((r) => r.effective_from <= onDate) ?? null;
}

export async function getInstitutionConfigTimeline(
  institutionId: string,
): Promise<ApiResult<InstitutionConfigTimeline>> {
  const [planRes, assignRes] = await Promise.all([
    supabase
      .from('institution_service_plans')
      .select('id,periods,effective_from')
      .eq('institution_id', institutionId)
      .order('effective_from', { ascending: false }),
    supabase
      .from('institution_rotation_assignments')
      .select('id,rotation_id,anchor_week,effective_from,rotation:rotations!rotation_id(name)')
      .eq('institution_id', institutionId)
      .order('effective_from', { ascending: false }),
  ]);
  if (planRes.error) return err(planRes.error);
  if (assignRes.error) return err(assignRes.error);
  type RawAssign = {
    id: string;
    rotation_id: string;
    anchor_week: number;
    effective_from: string;
    rotation: { name: string } | null;
  };
  return {
    data: {
      plans: (planRes.data ?? []) as ServicePlanRow[],
      assignments: ((assignRes.data ?? []) as unknown as RawAssign[]).map((a) => ({
        id: a.id,
        rotation_id: a.rotation_id,
        rotation_name: a.rotation?.name ?? null,
        anchor_week: a.anchor_week,
        effective_from: a.effective_from,
      })),
    },
    error: null,
  };
}

// Withdrawing a configuration change that has not taken effect yet is a
// correction, not history rewriting. The caller decides what is still
// withdrawable; the Super Admin-only RLS (0016/0036) is unchanged.
export async function deleteServicePlanRow(id: string): Promise<ApiResult<null>> {
  const { error } = await supabase.from('institution_service_plans').delete().eq('id', id);
  if (error) return err(error);
  return { data: null, error: null };
}

export async function deleteRotationAssignmentRow(id: string): Promise<ApiResult<null>> {
  const { error } = await supabase.from('institution_rotation_assignments').delete().eq('id', id);
  if (error) return err(error);
  return { data: null, error: null };
}

// Both of these are EFFECTIVE-DATED configuration: the history of rows is
// preserved and the resolver picks the latest row at or before a date. Saving
// twice for the SAME effective date previously INSERTed a competing second
// row, leaving which configuration wins ambiguous. They now upsert on
// (institution_id, effective_from) — a re-save for the same date corrects that
// date's configuration instead of racing another row for it. The database has
// the matching unique index (0033), so this holds on the raw path too.
export async function setInstitutionServicePlan(
  institutionId: string,
  periods: AppPeriod[],
  effectiveFrom: string,
): Promise<ApiResult<null>> {
  const { error } = await supabase
    .from('institution_service_plans')
    .upsert(
      { institution_id: institutionId, periods, effective_from: effectiveFrom },
      { onConflict: 'institution_id,effective_from' },
    );
  if (error) return err(error);
  return { data: null, error: null };
}

export async function assignInstitutionRotation(
  institutionId: string,
  rotationId: string,
  anchorWeek: number,
  effectiveFrom: string,
): Promise<ApiResult<null>> {
  const { error } = await supabase.from('institution_rotation_assignments').upsert(
    {
      institution_id: institutionId,
      rotation_id: rotationId,
      // anchor_week must address a week the selected Menu actually has; the
      // database enforces the same bound (0033) whatever the caller sends.
      anchor_week: anchorWeek,
      effective_from: effectiveFrom,
    },
    { onConflict: 'institution_id,effective_from' },
  );
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
  weekday: number; // 0=Mon..6=Sun (rotation_slots allows all 7 days since 0016)
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
  type Row = {
    id: string;
    name: string;
    week_count: number;
    active: boolean;
    rotation_slots: Array<{ count: number }>;
  };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      week_count: r.week_count,
      active: r.active,
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

/**
 * Resizes a Menu ATOMICALLY (migration 0034).
 *
 * This used to DELETE the out-of-range slots and THEN update week_count as two
 * separate requests. When the second step was rejected — because an institution
 * is anchored beyond the new range — the meal slots were already destroyed, so a
 * refused edit still lost planning data.
 *
 * set_rotation_week_count() validates first and does the whole thing in one
 * transaction: a rejected shrink leaves every slot exactly as it was.
 */
export async function setRotationWeekCount(
  id: string,
  weekCount: number,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('set_rotation_week_count', {
    p_rotation: id,
    p_week_count: weekCount,
  });
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
  type Row = {
    week_number: number;
    weekday: number;
    period: AppPeriod;
    meal_id: string;
    meal: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      week_number: r.week_number,
      weekday: r.weekday,
      period: r.period,
      meal_id: r.meal_id,
      meal_name: r.meal?.name ?? '—',
    })),
    error: null,
  };
}

// Assign a meal to a slot (upsert), or clear it (mealId null → delete the row).
export async function setRotationSlot(
  rotationId: string,
  week: number,
  weekday: number,
  period: AppPeriod,
  mealId: string | null,
): Promise<ApiResult<null>> {
  if (mealId === null) {
    const { error } = await supabase
      .from('rotation_slots')
      .delete()
      .eq('rotation_id', rotationId)
      .eq('week_number', week)
      .eq('weekday', weekday)
      .eq('period', period);
    if (error) return err(error);
    return { data: null, error: null };
  }
  const { error } = await supabase
    .from('rotation_slots')
    .upsert(
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
      'id,name,active,current_revision_id,periods:meal_periods(period),rev:meal_revisions!current_revision_id(ingredients,allergens,nutrition,portion,image_path,nutrition_status,revision_no)',
    )
    .order('name');
  if (!opts?.includeArchived) q = q.eq('active', true);
  if (opts?.search) q = q.ilike('name', `%${opts.search}%`);
  const { data, error } = await q;
  if (error) return err(error);
  type Row = {
    id: string;
    name: string;
    active: boolean;
    current_revision_id: string | null;
    periods: { period: AppPeriod }[] | null;
    rev: {
      ingredients: unknown;
      allergens: unknown;
      nutrition: unknown;
      portion: string | null;
      image_path: string | null;
      nutrition_status: string;
      revision_no: number;
    } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.active,
      current_revision_id: r.current_revision_id,
      ingredients: asStringArray(r.rev?.ingredients),
      allergens: asStringArray(r.rev?.allergens),
      nutrition: (r.rev?.nutrition as Record<string, unknown>) ?? {},
      portion: r.rev?.portion ?? null,
      image_path: r.rev?.image_path ?? null,
      nutrition_status: r.rev?.nutrition_status ?? 'NOT_APPROVED',
      revision_no: r.rev?.revision_no ?? null,
      // Sorted so the tag order a person reads is the order the sittings
      // actually happen in, not whatever order the rows came back.
      periods: PERIOD_ORDER.filter((p) => (r.periods ?? []).some((x) => x.period === p)),
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
    // undefined -> null -> "leave the tags alone". An empty array clears them.
    p_periods: input.periods ?? null,
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
// against, giving Production -> Meal -> revision traceability.
//
// Returns null when nothing is published for that slot. Since migration 0033 a
// null here means the period is NOT APPLICABLE and cannot be recorded at all —
// every new Classroom Meal Record, served or not, must anchor to a published
// Meal Service. (The older comment said the caller should record anyway; that
// is no longer true, and record_serving_batch refuses it.)
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

/**
 * Reads EVERY page of a filtered query, with no silent correctness cap.
 *
 * Analytics aggregates are computed from the rows a query returns, so a fixed
 * `.limit(n)` does not "show the first n" — it silently reports wrong totals
 * for any window larger than n. This pages until the server returns a short
 * page, so the dataset is complete before any aggregate is declared.
 *
 * The caller MUST supply a stable total order (a unique tiebreaker), or rows
 * can shift between requests and be dropped or duplicated across boundaries.
 */
export async function fetchAllPages<T>(
  pageSize: number,
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: string | null }>,
): Promise<ApiResult<T[]>> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (page.error) return { data: null, error: page.error };
    const batch = page.data ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return { data: all, error: null };
}

export async function mealObservations(
  filters: ObservationFilters,
): Promise<ApiResult<ObservationRow[]>> {
  // §31: group observations by the authoritative Meal (via
  // meal_service -> meal_revision -> meal), NOT the legacy menu_item_id.
  // meal_revision.meal_id is the stable meal identity, so the same meal served
  // on different days aggregates as one — and post-cutover records (which have
  // meal_service_id, not menu_item_id) are included.
  // EXHAUSTIVE pagination — there is no silent correctness cap. This used to
  // end with `.limit(5000)`, so a window with more observations than that
  // produced wrong-but-plausible KPIs with no error and no warning.
  const PAGE = 1000;
  const paged = await fetchAllPages<unknown>(PAGE, async (from, to) => {
    let q = supabase
      .from('serving_records')
      .select(
        `${SERVING_RECORD_COLUMNS}, svc:meal_services!meal_service_id(period,rev:meal_revisions!meal_revision_id(name,meal_id)), student:students!inner(institution_id,class_id)`,
      )
      .gte('serving_date', filters.from)
      .lte('serving_date', filters.to)
      // A STABLE total order: ordering by serving_date alone leaves ties in an
      // arbitrary order between requests, which drops or duplicates rows across
      // page boundaries. The id breaks every tie deterministically.
      .order('serving_date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    if (filters.institutionId) q = q.eq('student.institution_id', filters.institutionId);
    if (filters.classId) q = q.eq('class_id', filters.classId);
    if (filters.period) q = q.eq('period', filters.period);
    const res = await q;
    return { data: res.data as unknown[] | null, error: res.error ? res.error.message : null };
  });
  if (paged.error) return { data: null, error: paged.error };
  const data = paged.data;
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
    .select(SERVING_RECORD_COLUMNS)
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
  // The legacy free-text `note` field is deliberately absent. Classroom free
  // text goes to serving_notes, which carries the publication boundary a
  // family-visible message requires; record_serving_batch no longer accepts it.
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

/**
 * Sets ONLY the concern flag on an existing Classroom Meal Record (§25).
 *
 * Flagging a concern while saving a note used to require re-sending the whole
 * meal result, so the flag was silently dropped. This narrow RPC touches no
 * other meal-result field, and the database re-checks authorization and the
 * operational-day rule.
 */
export async function setConcernObserved(
  recordId: string,
  concern: boolean,
): Promise<ApiResult<ServingRecord>> {
  const { data, error } = await supabase.rpc('set_concern_observed', {
    p_record: recordId,
    p_concern: concern,
  });
  if (error) return err(error);
  return { data: data as ServingRecord, error: null };
}

export async function servingForStudent(
  studentId: string,
  date: string,
  period: AppPeriod,
): Promise<ApiResult<ServingRecord | null>> {
  const { data, error } = await supabase
    .from('serving_records')
    .select(SERVING_RECORD_COLUMNS)
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
  return invokeFunction<{ user_id: string }>('admin-create-user', input);
}

/**
 * Deactivate or reactivate an account (migration 0044).
 *
 * This is the lifecycle action a Super Admin actually has. There is no
 * permanent delete of a person who has done anything: audit_log names them as
 * an actor, classroom observations name them as the recorder, and a Parent is
 * named by a guardian link. Deleting the row would either destroy that history
 * or leave it pointing at nothing.
 *
 * Deactivation is not cosmetic. app_current_role(), app_current_institution_id()
 * and app_current_kitchen_id() all resolve to NULL for an inactive account, and
 * every RLS policy in the schema is built on them — so a token issued before
 * the change reads nothing and writes nothing from the next statement onward.
 *
 * The database refuses two things and says which: deactivating yourself, and
 * deactivating the last active Super Admin (which would lock the platform).
 */
export async function setUserActive(
  userId: string,
  active: boolean,
  reason: string | null,
): Promise<ApiResult<{ warning?: string }>> {
  // Routed through admin-set-active rather than straight at the RPC so the
  // Supabase Auth account is banned/unbanned in the same action. The Edge
  // Function still calls set_user_active WITH THIS CALLER'S JWT, so the
  // authorization decision, the audit row and the class-assignment cleanup all
  // stay in the database where they are tested — the function only adds the
  // Auth half, which needs a key the browser must never hold.
  return invokeFunction<{ warning?: string }>('admin-set-active', {
    userId,
    active,
    reason: reason?.trim() || null,
  });
}

/**
 * Correct a person's name or phone number.
 *
 * Name and phone only, by deliberate scope. EMAIL IS NOT EDITABLE HERE: it is
 * the authentication identity held by Supabase Auth, and changing only the
 * app_users copy would leave the person signing in with one address while the
 * platform displayed another. A properly synchronised email-change workflow
 * (Auth update + confirmation + profile update in one atomic path) is not part
 * of this pass, so the field stays immutable and the interface says why rather
 * than offering an edit that would half-work.
 *
 * ROLE is not editable here either. Changing a role moves an account between
 * RLS scopes, and the safe path is a new correctly-scoped account plus the
 * deactivation of the old one — not an in-place rewrite of what a live token
 * is allowed to see.
 */
export async function updateUserProfile(
  userId: string,
  fullName: string,
  phone: string | null,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('update_user_profile', {
    p_user: userId,
    p_full_name: fullName.trim(),
    p_phone: phone?.trim() || null,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

/**
 * Issue a new password for someone else's account.
 *
 * Goes through the admin-set-password Edge Function because setting another
 * person's password requires the service-role key, which must never reach a
 * browser. The caller's own JWT is what authorises it there: a Super Admin may
 * reset any account, an Institution Admin only their own classroom staff.
 *
 * The existing password is NOT retrievable — Supabase stores a bcrypt hash and
 * there is nothing to read back. Nothing in this path returns, logs or records
 * a password value; audit_log gets the fact of the reset and its reason.
 */
export async function adminSetPassword(
  userId: string,
  password: string,
  reason: string | null,
): Promise<ApiResult<{ user_id: string; warning?: string }>> {
  return invokeFunction<{ user_id: string; warning?: string }>('admin-set-password', {
    userId,
    password,
    reason: reason?.trim() || null,
  });
}

/**
 * Change YOUR OWN password while signed in.
 *
 * This one needs no privileged key: Supabase Auth accepts it on the caller's
 * own session, so it works for every role — Parent, Classroom Staff, Kitchen,
 * Institution Admin, Super Admin — from their own profile screen. It is not a
 * self-service RESET (there is still no "forgot password" email in this
 * product); it is a signed-in change, which is a different thing and the one
 * every account can safely be given.
 */
export async function changeMyPassword(newPassword: string): Promise<ApiResult<null>> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return err(error);
  return { data: null, error: null };
}

/**
 * End one Parent's access to one child (migration 0044).
 *
 * Super Admin only, and a reason is required — this removes a person's sight
 * of a child, which is exactly the kind of change that must never be
 * anonymous. It deletes the student_parents link and nothing else: the Parent
 * account survives (they may have other children), the child survives, and
 * every observation, note and meal record survives untouched.
 */
export async function revokeGuardianAccess(
  studentId: string,
  userId: string,
  reason: string,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('revoke_guardian_access', {
    p_student: studentId,
    p_user: userId,
    p_reason: reason.trim(),
  });
  if (error) return err(error);
  return { data: null, error: null };
}

// =====================================================================
// OPERATIONAL SPINE
//
// Every write below goes through a SECURITY DEFINER rpc rather than a direct
// table write. That is not ceremony: the authority check, the validation and
// the audit row live together inside those functions, so there is no way to
// perform one without the others — including from a console.
// =====================================================================

// ------------------------------------------------------------- meal plans
export async function listMealPlans(): Promise<ApiResult<MealPlan[]>> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('id, name, active, meal_plan_periods(period)')
    .order('name');
  if (error) return err(error);
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    active: boolean;
    meal_plan_periods: Array<{ period: AppPeriod }> | null;
  }>;
  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.active,
      periods: (r.meal_plan_periods ?? []).map((p) => p.period),
    })),
    error: null,
  };
}

export async function saveMealPlan(input: {
  id?: string | null;
  name: string;
  periods: AppPeriod[];
}): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('save_meal_plan', {
    p_plan_id: input.id ?? null,
    p_name: input.name,
    p_periods: input.periods,
  });
  if (error) return err(error);
  return { data: data as string, error: null };
}

export async function retireMealPlan(id: string, active: boolean): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('retire_meal_plan', { p_plan: id, p_active: active });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function institutionMealPlans(institutionId: string): Promise<ApiResult<string[]>> {
  const { data, error } = await supabase
    .from('institution_meal_plans')
    .select('meal_plan_id')
    .eq('institution_id', institutionId);
  if (error) return err(error);
  return { data: (data ?? []).map((r) => (r as { meal_plan_id: string }).meal_plan_id), error: null };
}

export async function setInstitutionMealPlans(
  institutionId: string,
  planIds: string[],
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('set_institution_meal_plans', {
    p_inst: institutionId,
    p_plans: planIds,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

// -------------------------------------------------------- student plans
export async function studentMealPlans(studentId: string): Promise<ApiResult<StudentMealPlan[]>> {
  const { data, error } = await supabase
    .from('student_meal_plans')
    .select('id, student_id, meal_plan_id, effective_from, effective_until, note, meal_plans(name)')
    .eq('student_id', studentId)
    .order('effective_from', { ascending: false });
  if (error) return err(error);
  const rows = (data ?? []) as unknown as Array<
    StudentMealPlan & { meal_plans: Array<{ name: string }> | { name: string } | null }
  >;
  return {
    data: rows.map(({ meal_plans, ...r }) => {
      const rel = Array.isArray(meal_plans) ? meal_plans[0] : meal_plans;
      return { ...r, meal_plan_name: rel?.name };
    }),
    error: null,
  };
}

/** Every child's current plan for a whole institution, for the roster screen. */
export async function currentPlansForInstitution(
  institutionId: string,
  onDate: string,
): Promise<ApiResult<Record<string, { planId: string; planName: string }>>> {
  const { data, error } = await supabase
    .from('student_meal_plans')
    .select('student_id, meal_plan_id, effective_from, effective_until, meal_plans(name), students!inner(institution_id)')
    .eq('students.institution_id', institutionId)
    .lte('effective_from', onDate);
  if (error) return err(error);
  // PostgREST returns an embedded relation as an ARRAY even for a to-one join,
  // so it is read as one rather than cast to an object that never arrives.
  const out: Record<string, { planId: string; planName: string }> = {};
  for (const raw of (data ?? []) as unknown as Array<{
    student_id: string;
    meal_plan_id: string;
    effective_until: string | null;
    meal_plans: Array<{ name: string }> | { name: string } | null;
  }>) {
    if (raw.effective_until && raw.effective_until < onDate) continue;
    const rel = Array.isArray(raw.meal_plans) ? raw.meal_plans[0] : raw.meal_plans;
    out[raw.student_id] = { planId: raw.meal_plan_id, planName: rel?.name ?? '—' };
  }
  return { data: out, error: null };
}

export async function assignStudentMealPlan(input: {
  studentId: string;
  planId: string;
  from: string;
  note?: string | null;
}): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('assign_student_meal_plan', {
    p_student: input.studentId,
    p_plan: input.planId,
    p_from: input.from,
    p_note: input.note?.trim() || null,
  });
  if (error) return err(error);
  return { data: data as string, error: null };
}

export async function endStudentMealPlan(
  assignmentId: string,
  until: string,
  reason?: string | null,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('end_student_meal_plan', {
    p_assignment: assignmentId,
    p_until: until,
    p_reason: reason?.trim() || null,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

/**
 * Bulk assignment is atomic in the database: the rpc raises if ANY student is
 * refused, which rolls the whole call back. There is deliberately no partial
 * success path — a roster half-assigned is worse than one not assigned.
 */
export async function bulkAssignStudentMealPlan(input: {
  studentIds: string[];
  planId: string;
  from: string;
  note?: string | null;
}): Promise<ApiResult<number>> {
  const { data, error } = await supabase.rpc('bulk_assign_student_meal_plan', {
    p_students: input.studentIds,
    p_plan: input.planId,
    p_from: input.from,
    p_note: input.note?.trim() || null,
  });
  if (error) return err(error);
  return { data: data as number, error: null };
}

export async function planReadiness(
  institutionId: string,
  from: string,
): Promise<ApiResult<PlanReadinessRow[]>> {
  const { data, error } = await supabase.rpc('institution_plan_readiness', {
    p_inst: institutionId,
    p_from: from,
  });
  if (error) return err(error);
  return { data: (data ?? []) as PlanReadinessRow[], error: null };
}

export async function activateStudentMealPlans(
  institutionId: string,
  from: string,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('activate_student_meal_plans', {
    p_inst: institutionId,
    p_from: from,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

// ---------------------------------------------------------- dietary
export async function dietaryForStudent(
  studentId: string,
): Promise<ApiResult<DietaryRequirement[]>> {
  const { data, error } = await supabase
    .from('student_dietary_requirements')
    .select('*')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });
  if (error) return err(error);
  return { data: (data ?? []) as DietaryRequirement[], error: null };
}

export async function dietaryReviewQueue(): Promise<ApiResult<DietaryRequirement[]>> {
  const { data, error } = await supabase
    .from('student_dietary_requirements')
    .select('*')
    .in('review_status', ['SUBMITTED', 'NEEDS_CLARIFICATION'])
    .order('submitted_at');
  if (error) return err(error);
  return { data: (data ?? []) as DietaryRequirement[], error: null };
}

export async function submitDietaryRequirement(input: {
  studentId: string;
  type: DietaryRequirementType;
  text: string;
  source?: string | null;
  from?: string | null;
}): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('submit_dietary_requirement', {
    p_student: input.studentId,
    p_type: input.type,
    p_text: input.text,
    p_source: input.source?.trim() || null,
    p_from: input.from ?? null,
  });
  if (error) return err(error);
  return { data: data as string, error: null };
}

export async function reviewDietaryRequirement(
  id: string,
  status: DietaryReviewStatus,
  note?: string | null,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('review_dietary_requirement', {
    p_id: id,
    p_status: status,
    p_note: note?.trim() || null,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function endDietaryRequirement(
  id: string,
  reason?: string | null,
): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('end_dietary_requirement', {
    p_id: id,
    p_reason: reason?.trim() || null,
  });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function unresolvedDecisions(
  serviceId: string,
): Promise<ApiResult<UnresolvedDecision[]>> {
  const { data, error } = await supabase.rpc('unresolved_meal_decisions', { p_service: serviceId });
  if (error) return err(error);
  return { data: (data ?? []) as UnresolvedDecision[], error: null };
}

export async function resolveSpecialMeal(input: {
  studentId: string;
  serviceId: string;
  kind: SpecialMealResolutionKind;
  revisionId?: string | null;
  prepNote?: string | null;
}): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('resolve_special_meal', {
    p_student: input.studentId,
    p_service: input.serviceId,
    p_kind: input.kind,
    p_revision: input.revisionId ?? null,
    p_prep_note: input.prepNote?.trim() || null,
  });
  if (error) return err(error);
  return { data: data as string, error: null };
}

// ------------------------------------------------------------- demand
export async function demandForDate(date: string): Promise<ApiResult<DemandRow[]>> {
  const { data, error } = await supabase.rpc('meal_production_demand', { p_date: date });
  if (error) return err(error);
  return { data: (data ?? []) as DemandRow[], error: null };
}

export async function finalDemandForDate(date: string): Promise<ApiResult<FinalDemand[]>> {
  const { data, error } = await supabase
    .from('final_demand')
    .select('*')
    .eq('service_date', date)
    .is('superseded_at', null)
    .order('period');
  if (error) return err(error);
  return { data: (data ?? []) as FinalDemand[], error: null };
}

export async function finalizeDemand(serviceId: string): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('finalize_demand', { p_service: serviceId });
  if (error) return err(error);
  return { data: data as string, error: null };
}

export async function demandDrift(date: string): Promise<ApiResult<DemandDriftRow[]>> {
  const { data, error } = await supabase.rpc('demand_drift', { p_date: date });
  if (error) return err(error);
  return { data: (data ?? []) as DemandDriftRow[], error: null };
}

export async function adjustFinalDemand(id: string, reason: string): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('adjust_final_demand', {
    p_final: id,
    p_reason: reason,
  });
  if (error) return err(error);
  return { data: data as string, error: null };
}

export async function keepFinalDemand(id: string, reason: string): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('keep_final_demand', { p_final: id, p_reason: reason });
  if (error) return err(error);
  return { data: null, error: null };
}

export async function specialLines(finalDemandIds: string[]): Promise<ApiResult<SpecialLine[]>> {
  if (!finalDemandIds.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from('final_demand_special_lines')
    .select('*')
    .in('final_demand_id', finalDemandIds);
  if (error) return err(error);
  return { data: (data ?? []) as SpecialLine[], error: null };
}

// --------------------------------------------------- production / packing
export async function productionRuns(
  finalDemandIds: string[],
): Promise<ApiResult<ProductionRun[]>> {
  if (!finalDemandIds.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from('production_runs')
    .select('*')
    .in('final_demand_id', finalDemandIds);
  if (error) return err(error);
  return { data: (data ?? []) as ProductionRun[], error: null };
}

async function callVoid(fn: string, args: Record<string, unknown>): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc(fn, args);
  if (error) return err(error);
  return { data: null, error: null };
}

export const startProduction = (id: string) => callVoid('start_production', { p_final: id });
export const completeProduction = (id: string) => callVoid('complete_production', { p_final: id });
export const startPacking = (id: string) => callVoid('start_packing', { p_final: id });
export const completePacking = (id: string) => callVoid('complete_packing', { p_final: id });
export const confirmSpecialProduced = (id: string) =>
  callVoid('confirm_special_produced', { p_line: id });
export const confirmSpecialPacked = (id: string) =>
  callVoid('confirm_special_packed', { p_line: id });

export async function kitchenSpecialMeals(date: string): Promise<ApiResult<KitchenSpecialMeal[]>> {
  const { data, error } = await supabase.rpc('kitchen_special_meals', { p_date: date });
  if (error) return err(error);
  return { data: (data ?? []) as KitchenSpecialMeal[], error: null };
}

// ------------------------------------------------------------ delivery
export async function deliveryConfigs(
  institutionId: string,
): Promise<ApiResult<DeliveryConfig[]>> {
  const { data, error } = await supabase
    .from('institution_delivery_configs')
    .select('*')
    .eq('institution_id', institutionId)
    .order('effective_from', { ascending: false });
  if (error) return err(error);
  return { data: (data ?? []) as DeliveryConfig[], error: null };
}

export async function setDeliveryConfig(input: {
  institutionId: string;
  from: string;
  runCount: number;
  deliveryPoint: string;
  windows: Array<{ run: number; from: string; to: string }>;
  periodRuns: Record<string, number>;
}): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('set_delivery_config', {
    p_inst: input.institutionId,
    p_from: input.from,
    p_run_count: input.runCount,
    p_delivery_point: input.deliveryPoint,
    p_windows: input.windows,
    p_period_runs: input.periodRuns,
  });
  if (error) return err(error);
  return { data: data as string, error: null };
}

export async function deliveryReceivers(institutionId: string): Promise<ApiResult<string[]>> {
  const { data, error } = await supabase
    .from('delivery_receivers')
    .select('user_id')
    .eq('institution_id', institutionId);
  if (error) return err(error);
  return { data: (data ?? []).map((r) => (r as { user_id: string }).user_id), error: null };
}

export async function setDeliveryReceiver(
  institutionId: string,
  userId: string,
  authorized: boolean,
): Promise<ApiResult<null>> {
  return callVoid('set_delivery_receiver', {
    p_inst: institutionId,
    p_user: userId,
    p_authorized: authorized,
  });
}

export async function buildManifests(
  institutionId: string,
  date: string,
): Promise<ApiResult<number>> {
  const { data, error } = await supabase.rpc('build_manifests', {
    p_inst: institutionId,
    p_date: date,
  });
  if (error) return err(error);
  return { data: data as number, error: null };
}

export async function manifestsForDate(date: string): Promise<ApiResult<DeliveryManifest[]>> {
  const { data, error } = await supabase
    .from('delivery_manifests')
    .select('*, institutions(name)')
    .eq('service_date', date)
    .order('run_number');
  if (error) return err(error);
  const rows = (data ?? []) as unknown as Array<
    DeliveryManifest & { institutions: Array<{ name: string }> | { name: string } | null }
  >;
  return {
    data: rows.map(({ institutions, ...r }) => {
      const rel = Array.isArray(institutions) ? institutions[0] : institutions;
      return { ...r, institution_name: rel?.name };
    }),
    error: null,
  };
}

/** A Driver's own work. RLS already restricts this; the filter is for clarity. */
export async function myManifests(date: string): Promise<ApiResult<DeliveryManifest[]>> {
  const { data, error } = await supabase
    .from('delivery_manifests')
    .select('*, institutions(name)')
    .gte('service_date', date)
    .order('service_date')
    .order('run_number');
  if (error) return err(error);
  const rows = (data ?? []) as unknown as Array<
    DeliveryManifest & { institutions: Array<{ name: string }> | { name: string } | null }
  >;
  return {
    data: rows.map(({ institutions, ...r }) => {
      const rel = Array.isArray(institutions) ? institutions[0] : institutions;
      return { ...r, institution_name: rel?.name };
    }),
    error: null,
  };
}

export async function manifestLines(manifestId: string): Promise<ApiResult<ManifestLine[]>> {
  const { data, error } = await supabase
    .from('manifest_lines')
    .select('*')
    .eq('manifest_id', manifestId)
    .order('period');
  if (error) return err(error);
  return { data: (data ?? []) as ManifestLine[], error: null };
}

export const assignManifestDriver = (manifestId: string, driverId: string) =>
  callVoid('assign_manifest_driver', { p_manifest: manifestId, p_driver: driverId });
export const releaseManifest = (id: string) => callVoid('release_manifest', { p_manifest: id });
export const driverConfirmCollection = (id: string) =>
  callVoid('driver_confirm_collection', { p_manifest: id });
export const driverConfirmArrival = (id: string) =>
  callVoid('driver_confirm_arrival', { p_manifest: id });
export const confirmHandover = (id: string, withIssue = false) =>
  callVoid('confirm_handover', { p_manifest: id, p_with_issue: withIssue });

// -------------------------------------------------------------- issues
export async function listIssues(date?: string): Promise<ApiResult<OperationalIssue[]>> {
  let q = supabase.from('operational_issues').select('*').order('raised_at', { ascending: false });
  if (date) q = q.eq('service_date', date);
  const { data, error } = await q;
  if (error) return err(error);
  return { data: (data ?? []) as OperationalIssue[], error: null };
}

export async function reportIssue(input: {
  stage: OperationalStage;
  category: string;
  description: string;
  institutionId?: string | null;
  date?: string | null;
  finalDemandId?: string | null;
  manifestId?: string | null;
  specialLineId?: string | null;
}): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('report_operational_issue', {
    p_stage: input.stage,
    p_category: input.category,
    p_description: input.description,
    p_institution: input.institutionId ?? null,
    p_date: input.date ?? null,
    p_final: input.finalDemandId ?? null,
    p_manifest: input.manifestId ?? null,
    p_special_line: input.specialLineId ?? null,
  });
  if (error) return err(error);
  return { data: data as string, error: null };
}

export const advanceIssue = (id: string, status: IssueStatus, resolution?: string | null) =>
  callVoid('advance_operational_issue', {
    p_id: id,
    p_status: status,
    p_resolution: resolution?.trim() || null,
  });

// --------------------------------------------- roster / reconciliation
export async function serviceRoster(serviceId: string): Promise<ApiResult<RosterRow[]>> {
  const { data, error } = await supabase.rpc('service_roster', { p_service: serviceId });
  if (error) return err(error);
  return { data: (data ?? []) as RosterRow[], error: null };
}

export async function reconciliation(date: string): Promise<ApiResult<ReconciliationRow[]>> {
  const { data, error } = await supabase.rpc('operational_reconciliation', { p_date: date });
  if (error) return err(error);
  return { data: (data ?? []) as ReconciliationRow[], error: null };
}

export async function classroomCompletion(date: string): Promise<
  ApiResult<Array<{ institution_id: string; institution_name: string; period: AppPeriod; entitled: number; recorded: number }>>
> {
  const { data, error } = await supabase.rpc('classroom_completion', { p_date: date });
  if (error) return err(error);
  return {
    data: (data ?? []) as Array<{
      institution_id: string;
      institution_name: string;
      period: AppPeriod;
      entitled: number;
      recorded: number;
    }>,
    error: null,
  };
}

export async function closeOperationalDay(
  date: string,
  note?: string | null,
): Promise<ApiResult<null>> {
  return callVoid('close_operational_day', { p_date: date, p_note: note?.trim() || null });
}

export async function correctOperationalRecord(input: {
  entity: string;
  id: string;
  field: string;
  value: string;
  reason: string;
}): Promise<ApiResult<null>> {
  return callVoid('correct_operational_record', {
    p_entity: input.entity,
    p_id: input.id,
    p_field: input.field,
    p_value: input.value,
    p_reason: input.reason,
  });
}
