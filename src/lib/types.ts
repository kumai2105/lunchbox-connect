// Domain types mirroring the database schema and the approved spec pack
// (docs/04_DATA_MODEL.md). Types marked reference to NOT_YET_DEFINED spec
// areas stay as minimal "undebatable mapping" shapes — never invented rules.

export type AppRole =
  | 'super_admin'
  | 'school_admin'
  | 'operations_manager'
  | 'finance_owner'
  | 'viewer'
  | 'parent'
  | 'classroom_staff'
  | 'kitchen'
  | 'driver';

export type AppPeriod = 'breakfast' | 'snack' | 'lunch' | 'afternoon_snack';
export type MealOutcome = 'full' | 'partial' | 'refused' | 'absent'; // provisional demo values — exact set NOT_YET_DEFINED (docs/05 §31)
export type EnrollmentStatus = 'enrolled' | 'pending' | 'withdrawn';

export const OPERATIONAL_STATUS_ELIGIBLE = 'ACTIVE_BILLABLE_TO_NURSERY' as const;

export interface Institution {
  id: string;
  name: string;
  kind: 'school' | 'nursery' | 'other';
  created_at: string;
}

// LunchBox Connect operational entity (docs/13 Decision 031) — not owned by
// any Institution. MVP: Jazeel Restaurant is the current active Kitchen.
export interface Kitchen {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface AppUser {
  user_id: string;
  role: AppRole;
  institution_id: string | null;
  /** Kitchen-role users associate with a Kitchen entity instead of an Institution (docs/13 Decision 031). */
  kitchen_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface ClassRow {
  id: string;
  institution_id: string;
  name: string;
  grade: string | null;
  teacher_id: string | null;
  active: boolean;
}

export interface Student {
  id: string;
  student_no: string;
  institution_id: string;
  given_name: string;
  family_name: string;
  class_id: string | null;
  grade: string | null;
  enrollment_status: EnrollmentStatus;
  /** Exact spec value: ACTIVE_BILLABLE_TO_NURSERY, or NULL when not eligible. */
  operational_status: string | null;
  medical_notes: MedicalNote[];
  created_at: string;
  updated_at: string;
}

export interface MedicalNote {
  id: string;
  text: string;
}

export interface StudentParentLink {
  student_id: string;
  user_id: string;
}

export interface MenuItem {
  id: string;
  week_number: number;
  weekday: number; // 0=Mon..4=Fri
  period: AppPeriod;
  dish_name: string;
  ingredients: unknown[];
  allergens: unknown[];
  nutrition: Record<string, number | string | null>;
  portion: string | null;
  source_status: string;
  published: boolean;
}

export interface ServingRecord {
  id: string;
  serving_date: string;
  class_id: string | null;
  student_id: string;
  period: AppPeriod;
  outcome: MealOutcome;
  note: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ServingNote {
  id: string;
  serving_record_id: string;
  body: string;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  action: 'create' | 'update' | 'delete';
  entity_type: 'students' | 'menus' | 'app_users';
  entity_id: string;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
}

export interface DashboardInstitutionRow {
  institution_id: string;
  name: string;
  classrooms: number;
  active_students: number;
  meals_today: number;
}

export interface ProductionDemandRow {
  institution_id: string;
  institution_name: string;
  kitchen_id: string | null;
  kitchen_name: string | null;
  eligible_students: number;
  allergy_flagged: number;
}

// Combined roster row used by the classroom "Today" screen.
export interface RosterWithOutcome extends Student {
  outcome?: MealOutcome | null;
  note?: string | null;
  serving_record_id?: string | null;
}
