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
  /**
   * Lifecycle (migration 0044). An archived Institution keeps every record it
   * ever owned — students, classes, published service, observations — and is
   * refused all NEW operational activity at the database boundary, not merely
   * in the interface. It is never deleted, because its history is referenced.
   */
  active: boolean;
  archived_at: string | null;
  archived_by: string | null;
  archived_reason: string | null;
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
  /**
   * Lifecycle (migration 0044). `false` means the person cannot act: every
   * identity helper the RLS policies are built on resolves to NULL for a
   * deactivated account, so an already-issued token reads and writes nothing.
   * The row survives because audit_log.actor_user_id and every operational
   * record that names them must keep resolving.
   */
  active: boolean;
  deactivated_at: string | null;
  deactivated_by: string | null;
  deactivated_reason: string | null;
}

export interface ClassRow {
  id: string;
  institution_id: string;
  name: string;
  grade: string | null;
  // NB: classes.teacher_id still exists in the database as a legacy
  // primary-contact hint (migration 0025), but the application no longer
  // reads it — classroom staffing is the class_staff membership set (§16).
  /**
   * Lifecycle (migration 0044). An archived Class takes no student, no staff
   * assignment and no new observation; its past records are untouched.
   */
  active: boolean;
  archived_at: string | null;
  archived_by: string | null;
  archived_reason: string | null;
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
  /**
   * RETIRED (migration 0034). The legacy free-text column is no longer readable
   * by any API client and is never written again; historical values live in
   * serving_record_note_archive. Classroom free text belongs to serving_notes,
   * which has the publication boundary. Kept off this type so no screen can
   * accidentally surface internal text to a family.
   */
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
  /**
   * Free text in the database, and deliberately so: alongside the original
   * create/update/delete this now carries the lifecycle verbs written by
   * migration 0044 and the password-reset function — user.deactivate,
   * user.reactivate, user.password_reset, institution.archive,
   * institution.reactivate, class.archive, class.reactivate,
   * guardian.revoke. Narrowing it to a union would make the type lie about
   * rows that already exist.
   */
  action: string;
  entity_type: string;
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
  /** Served, non-exception records — the population for behaviour metrics. */
  valid_observations: number;
  /**
   * Valid records that actually carry a percentage. A valid record can hold a
   * behaviour and no consumption reading; it belongs to no consumption band, so
   * the five bands below are shares of THIS number, not of valid_observations.
   */
  scored_observations: number;
  avg_consumption_pct: number | null;
  refusal_count: number;
  encouragement_count: number;
  did_not_like_count: number;
}

/**
 * The approved FACTUAL Meal measures (migration 0034).
 *
 * Everything here is a count, an average or a share of what was actually
 * recorded. There is deliberately NO classification, score or ranking field:
 * the thresholds that would assign KEEP / MONITOR / REVIEW_IMPROVE /
 * CANDIDATE_FOR_REMOVAL are NOT_YET_DEFINED and are not invented.
 */
export interface MealPerformanceRow {
  menu_item_id: string; // stable Meal id (v_meal_performance, migration 0028)
  dish_name: string;
  period: AppPeriod;
  total_observations: number;
  /** Served, non-exception records — the population for behaviour metrics. */
  valid_observations: number;
  /**
   * Valid records that actually carry a percentage. A valid record can hold a
   * behaviour and no consumption reading; it belongs to no consumption band, so
   * the five bands below are shares of THIS number, not of valid_observations.
   */
  scored_observations: number;
  avg_consumption_pct: number | null;
  refusal_count: number;
  encouragement_count: number;
  did_not_like_count: number;
  /** 100/75/50/25/0 distribution across the SCORED population. */
  ate_all_count: number;
  ate_most_count: number;
  ate_half_count: number;
  ate_some_count: number;
  ate_none_count: number;
  /** The same distribution as a percentage of SCORED observations (sums to 100%). */
  ate_all_share: number | null;
  ate_most_share: number | null;
  ate_half_share: number | null;
  ate_some_share: number | null;
  ate_none_share: number | null;
  refusal_share: number | null;
  encouragement_share: number | null;
  did_not_like_share: number | null;
  /** Low-intake reason breakdown; exceptions counted separately. */
  reason_not_hungry: number;
  reason_did_not_like_it: number;
  reason_distracted: number;
  reason_other: number;
  exception_absent: number;
  exception_unwell: number;
  exception_sleeping: number;
  /** Factual trend: a reporting window, never a judgement. */
  recent_avg_consumption_pct: number | null;
  prior_avg_consumption_pct: number | null;
  trend_delta_pct: number | null;
  trend_window_days: number;
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
  /** Which sittings this meal is suitable for. Several, or none. */
  periods: AppPeriod[];
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
  /**
   * The complete tag set after the save. Omitted (undefined) leaves the
   * existing tags untouched; an empty array clears them. The two are
   * deliberately different, and save_meal treats them that way.
   */
  periods?: AppPeriod[];
}
