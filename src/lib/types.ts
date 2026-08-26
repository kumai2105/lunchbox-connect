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
  /**
   * Student Meal Plan enforcement boundary (migration 0048). NULL means this
   * site has NOT been switched over and its production demand keeps its exact
   * pre-0048 meaning. A date means entitlement governs on and after it.
   */
  student_plan_enforced_from?: string | null;
  student_plan_activated_at?: string | null;
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

// =====================================================================
// OPERATIONAL SPINE — Student Meal Plan entitlement through to handover.
//
// These mirror the 0048–0053 contracts. `AppPeriod` is reused deliberately:
// a Meal Plan selects a subset of the EXISTING sittings and introduces no new
// period type.
// =====================================================================

export interface MealPlan {
  id: string;
  name: string;
  active: boolean;
  periods: AppPeriod[];
}

/** Effective-dated entitlement for one child. `effective_until` is inclusive. */
export interface StudentMealPlan {
  id: string;
  student_id: string;
  meal_plan_id: string;
  meal_plan_name?: string;
  effective_from: string;
  effective_until: string | null;
  note: string | null;
}

/** A child who cannot be served yet, and the reason in words an operator can act on. */
export interface PlanReadinessRow {
  student_id: string;
  student_no: string;
  student_name: string;
  class_name: string | null;
  problem: string;
}

export type DietaryRequirementType = 'ALLERGY' | 'DIETARY_RESTRICTION' | 'OTHER_MEAL_REQUIREMENT';

export type DietaryReviewStatus =
  'SUBMITTED' | 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED' | 'ENDED';

export interface DietaryRequirement {
  id: string;
  student_id: string;
  requirement_type: DietaryRequirementType;
  requirement_text: string;
  source: string | null;
  effective_from: string;
  effective_until: string | null;
  review_status: DietaryReviewStatus;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export type SpecialMealResolutionKind = 'STANDARD_CONFIRMED' | 'ALTERNATIVE_ASSIGNED';

export interface UnresolvedDecision {
  student_id: string;
  student_no: string;
  student_name: string;
  requirement_type: DietaryRequirementType;
  requirement_text: string;
}

/**
 * Live demand. `total_required` is ALWAYS `standard_required + special_required`
 * — a special Meal replaces a standard one rather than adding to it.
 */
export interface DemandRow {
  institution_id: string;
  institution_name: string;
  meal_service_id: string;
  period: AppPeriod;
  meal_revision_id: string | null;
  meal_name: string | null;
  eligible_students: number;
  safety_note_flagged: number;
  standard_required: number;
  special_required: number;
  total_required: number;
  unresolved_decisions: number;
  plan_enforced: boolean;
}

export interface FinalDemand {
  id: string;
  institution_id: string;
  // Projected by final_demand_for_date() (0055). The Kitchen cannot read
  // `institutions`, so this never comes from an embed — an unreadable embed
  // returns null rather than an error, which is how the site went missing
  // from this screen in the first place.
  institution_name: string;
  service_date: string;
  period: AppPeriod;
  meal_service_id: string;
  meal_revision_id: string | null;
  entitled_students: number;
  standard_quantity: number;
  special_quantity: number;
  total_quantity: number;
  plan_enforced: boolean;
  finalized_at: string;
  superseded_at: string | null;
}

export interface SpecialLine {
  id: string;
  final_demand_id: string;
  student_id: string;
  meal_revision_id: string;
  reference: string;
  prep_note: string | null;
  produced_at: string | null;
  packed_at: string | null;
}

export interface DemandDriftRow {
  final_demand_id: string;
  institution_name: string;
  period: AppPeriod;
  meal_name: string | null;
  finalized_total: number;
  recalculated_total: number;
  finalized_standard: number;
  recalculated_standard: number;
  finalized_special: number;
  recalculated_special: number;
}

export type ProductionState = 'READY' | 'IN_PRODUCTION' | 'COMPLETE';
export type PackingState = 'WAITING_FOR_PRODUCTION' | 'PACKING' | 'PACKED';

export interface ProductionRun {
  id: string;
  final_demand_id: string;
  production_state: ProductionState;
  packing_state: PackingState;
}

export type DispatchState =
  'PREPARING' | 'READY_FOR_DISPATCH' | 'RELEASED' | 'IN_TRANSIT' | 'ARRIVED' | 'HANDED_OVER';

export interface DeliveryManifest {
  id: string;
  institution_id: string;
  institution_name?: string;
  service_date: string;
  run_number: number;
  window_from: string | null;
  window_to: string | null;
  delivery_point: string | null;
  state: DispatchState;
  driver_user_id: string | null;
  handover_with_issue: boolean;
  handed_over_at: string | null;
}

export interface ManifestLine {
  id: string;
  manifest_id: string;
  final_demand_id: string;
  period: AppPeriod;
  meal_revision_id: string | null;
  standard_quantity: number;
  special_quantity: number;
  total_quantity: number;
}

export interface DeliveryConfig {
  id: string;
  institution_id: string;
  effective_from: string;
  effective_until: string | null;
  run_count: number;
  delivery_point: string;
}

export type OperationalStage = 'PRODUCTION' | 'PACKING' | 'DISPATCH' | 'DELIVERY';
export type IssueStatus = 'OPEN' | 'LUNCHBOX_ACTIONED' | 'INSTITUTION_ACKNOWLEDGED' | 'CLOSED';

export interface OperationalIssue {
  id: string;
  stage: OperationalStage;
  category: string;
  description: string;
  institution_id: string | null;
  service_date: string | null;
  manifest_id: string | null;
  status: IssueStatus;
  raised_at: string;
  resolution: string | null;
}

/** Who is on a service, and what each child actually receives. */
export interface RosterRow {
  student_id: string;
  student_no: string;
  given_name: string;
  family_name: string;
  class_id: string | null;
  entitled: boolean;
  special_reference: string | null;
  actual_meal_revision_id: string | null;
  actual_meal_name: string | null;
  decision_pending: boolean;
}

export interface ReconciliationRow {
  institution_id: string;
  institution_name: string;
  period: AppPeriod;
  meal_name: string | null;
  entitled_students: number;
  required_total: number;
  required_standard: number;
  required_special: number;
  production_state: string;
  packing_state: string;
  dispatch_state: string;
  specials_produced: number;
  specials_packed: number;
  specials_total: number;
  open_issues: number;
  plan_enforced: boolean;
}

export interface KitchenSpecialMeal {
  reference: string;
  institution_name: string;
  class_name: string | null;
  child_label: string;
  meal_name: string;
  period: AppPeriod;
  prep_note: string | null;
}
