import { supabase } from './supabase';
import {
  OPERATIONAL_STATUS_ELIGIBLE,
  type AppPeriod,
  type AppUser,
  type AuditLogRow,
  type ClassRow,
  type DashboardInstitutionRow,
  type Institution,
  type MealOutcome,
  type MenuItem,
  type ProductionDemandRow,
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
    Pick<Student, 'class_id' | 'given_name' | 'family_name' | 'grade' | 'enrollment_status'>
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
  const { data, error } = await supabase
    .from('student_parents')
    .select('*, student:students(given_name, family_name, student_no)')
    .order('created_at', { ascending: false });
  if (error) return err(error);
  return { data: (data ?? []) as unknown as StudentParentLink[], error: null };
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

export async function recordServing(
  classId: string,
  rows: Array<{
    student_id: string;
    period: AppPeriod;
    outcome: MealOutcome;
    note?: string | null;
  }>,
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
  phone?: string | null;
  authenticate?: boolean;
}): Promise<ApiResult<{ user_id: string }>> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: input });
  if (error) return err(error);
  return { data: data as { user_id: string }, error: null };
}
