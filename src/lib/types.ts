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
export type EnrollmentStatus = 'enrolled' | 'pending' | 'withdrawn';

// Structured Classroom Meal Record fields (docs/13 Decision 032) — supersedes
// the earlier provisional full/partial/refused/absent outcome set.
export type ServedStatus = 'served' | 'not_served';
export type ConsumptionPct = 0 | 25 | 50 | 75 | 100;
export type EatingBehavior = 'ate_independently' | 'needed_encouragement' | 'refused';
export type LowIntakeReason =
  'not_hungry' | 'did_not_like_it' | 'distracted' | 'sleeping' | 'absent' | 'unwell' | 'other';

export const CONSUMPTION_VALUES: ConsumptionPct[] = [0, 25, 50, 75, 100];
// Reasons that must never count as evidence of Meal dislike (docs/13 Decision 032 §17/§42).
export const NON_PREFERENCE_LOW_INTAKE_REASONS: LowIntakeReason[] = [
  'absent',
  'unwell',
  'sleeping',
];

export const OPERATIONAL_STATUS_ELIGIBLE = 'ACTIVE_BILLABLE_TO_NURSERY' as const;

export interface Institution {
  id: string;
  name: string;
  kind: 'nursery' | 'school';
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
  // NB: classes.teacher_id still exists in the database as a legacy
  // primary-contact hint (migration 0025), but the application no longer
  // reads it — classroom staffing is the class_staff membership set (§16).
  active: boolean;
}

export interface Student {
  id: string;
  // §7: optional in the canonical model — NULL when the setting assigns no number.
  student_no: string | null;
  institution_id: string;
  given_name: string;
  family_name: string;
  class_id: string | null;
  grade: string | null;
  enrollment_status: EnrollmentStatus;
  /** Exact spec value: ACTIVE_BILLABLE_TO_NURSERY, or NULL when not eligible. */
  operational_status: string | null;
  medical_notes: MedicalNote[];
  /** Object path in the private student-photos bucket, never a public URL (docs/13 Decision 032 §6). */
  photo_path: string | null;
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

export interface ServingRecord {
  id: string;
  serving_date: string;
  class_id: string | null;
  student_id: string;
  period: AppPeriod;
  served_status: ServedStatus;
  consumption_pct: ConsumptionPct | null;
  behavior: EatingBehavior | null;
  low_intake_reason: LowIntakeReason | null;
  concern_observed: boolean;
  menu_item_id: string | null;
  /**
   * The dated Meal Service this observation was recorded against. Supersedes
   * menu_item_id, which pointed at a template row addressed by a global
   * calendar-week number. Null on records written before the cutover.
   */
  meal_service_id: string | null;
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
  /** Published meal-service periods this institution has today (§38). */
  periods_today: number;
  /** Expected applicable student-meal records today = eligible students × periods_today (§38). */
  expected_today: number;
}

export interface ProductionDemandRow {
  institution_id: string;
  institution_name: string;
  kitchen_id: string | null;
  kitchen_name: string | null;
  eligible_students: number;
  safety_note_flagged: number;
}

// Meal-performance analytics row (docs/13 Decision 032, Super Admin only) —
// derived-only, excludes the non-preference population from consumption stats.
// Revision-level meal performance (Decision 033 / integrity item 2) — the same
// observations as MealPerformanceRow but kept split per meal revision, so a
// recipe change can be evaluated before/after. Meal-level stays the default.
export interface MealRevisionPerformanceRow {
  meal_id: string;
  meal_name: string;
  meal_revision_id: string;
  revision_no: number;
  revision_name: string;
  period: AppPeriod;
  total_observations: number;
  valid_observations: number;
  avg_consumption_pct: number | null;
  refusal_count: number;
  encouragement_count: number;
  did_not_like_count: number;
}

export interface MealPerformanceRow {
  menu_item_id: string; // stable Meal id (v_meal_performance, migration 0028)
  dish_name: string;
  period: AppPeriod;
  total_observations: number;
  valid_observations: number;
  avg_consumption_pct: number | null;
  refusal_count: number;
  encouragement_count: number;
  did_not_like_count: number;
}


// ---- Meal Library (§4) --------------------------------------------------
export interface MealLibraryItem {
  id: string;
  name: string;
  active: boolean;
  current_revision_id: string | null;
  ingredients: string[];
  allergens: string[];
  nutrition: Record<string, unknown>;
  portion: string | null;
  image_path: string | null;
  nutrition_status: string;
  revision_no: number | null;
}

export interface MealInput {
  id?: string | null;
  name: string;
  ingredients: string[];
  allergens: string[];
  nutrition: Record<string, unknown>;
  portion: string | null;
  image_path?: string | null;
  nutrition_status?: string;
}
