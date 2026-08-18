import { supabase } from './supabase';
import { isoWeek, isoWeekday } from './format';
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
  type MealPerformanceRow,
  type MenuItem,
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
    teacher_id: r.teacher_id,
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

// classes.teacher_id is what actually drives a classroom_staff user's RLS
// scope (app_can_see_class / app_can_record_in_class, migrations 0010/0011)
// — without a way to set it, the Classroom Staff role can never see a
// roster. Pass null to unassign.
export async function assignClassStaff(
  classId: string,
  teacherId: string | null,
): Promise<ApiResult<ClassRow>> {
  const { data, error } = await supabase
    .from('classes')
    .update({ teacher_id: teacherId })
    .eq('id', classId)
    .select()
    .single();
  if (error) return err(error);
  return { data: data as ClassRow, error: null };
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
  student_no: string;
  institution_id: string;
  given_name: string;
  family_name: string;
  class_id?: string | null;
  grade?: string | null;
  medical_notes?: unknown[];
}): Promise<ApiResult<Student>> {
  const { data, error } = await supabase.from('students').insert(input).select().single();
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
export async function productionDemand(): Promise<ApiResult<ProductionDemandRow[]>> {
  const { data, error } = await supabase.from('v_production_demand').select('*');
  if (error) return err(error);
  return { data: (data ?? []) as ProductionDemandRow[], error: null };
}

// ---------------------------------------------------------------- menus
export async function listMenu(weekNumbers: number[]): Promise<ApiResult<MenuItem[]>> {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .in('week_number', weekNumbers)
    .order('week_number')
    .order('weekday')
    .order('period');
  if (error) return err(error);
  return { data: (data ?? []) as MenuItem[], error: null };
}

export async function saveMenuItem(input: {
  week_number: number;
  weekday: number;
  period: AppPeriod;
  dish_name: string;
  allergens?: string[];
}): Promise<ApiResult<MenuItem>> {
  const { data, error } = await supabase
    .from('menus')
    .upsert(input, { onConflict: 'week_number,weekday,period' })
    .select()
    .single();
  if (error) return err(error);
  return { data: data as MenuItem, error: null };
}

export async function publishMenuWeek(week: number): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('publish_menu_week', { p_week: week });
  if (error) return err(error);
  return { data: null, error: null };
}

// Resolves which Menu row a serving_date/period corresponds to, via the same
// week/weekday/period lookup already used for the Parent menu view — gives
// Production→Meal traceability without inventing a versioning system
// (docs/13 Decision 032).
export async function resolveMenuItemId(
  serving_date: string,
  period: AppPeriod,
): Promise<string | null> {
  const d = new Date(`${serving_date}T00:00:00`);
  const { data } = await supabase
    .from('menus')
    .select('id')
    .eq('week_number', isoWeek(d))
    .eq('weekday', isoWeekday(d))
    .eq('period', period)
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

// ---------------------------------------------------------------- serving
export async function rosterForClass(classId: string): Promise<ApiResult<Student[]>> {
  // Only operationally eligible students enter serving (docs/03 §7, AT-011).
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .eq('enrollment_status', 'enrolled')
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
