// Pure helpers for the structured Classroom Meal Record (docs/13 Decision 032).
// Mirrors the DB-side rules (migration 0014) so the same logic is unit-testable
// without a live database — same pattern as rbac.ts mirroring RLS.

import { NON_PREFERENCE_LOW_INTAKE_REASONS } from './types';
import type { ConsumptionPct, EatingBehavior, LowIntakeReason } from './types';

export const BEHAVIOR_LABEL: Record<EatingBehavior, string> = {
  ate_independently: 'Ate independently',
  needed_encouragement: 'Needed encouragement',
  refused: 'Refused',
};

export const LOW_INTAKE_REASON_LABEL: Record<LowIntakeReason, string> = {
  not_hungry: 'Not hungry',
  did_not_like_it: "Didn't like it",
  distracted: 'Distracted',
  sleeping: 'Sleeping',
  absent: 'Absent',
  unwell: 'Unwell',
  other: 'Other',
};

// A low-intake reason selector is relevant at 0% and 25% (docs/13 Decision 032 §15).
export function isLowIntake(pct: ConsumptionPct | null): boolean {
  return pct === 0 || pct === 25;
}

// ABSENT/UNWELL/SLEEPING must never count as Meal dislike (docs/13 Decision 032 §17/§42).
export function isNonPreferenceReason(reason: LowIntakeReason | null | undefined): boolean {
  return reason != null && NON_PREFERENCE_LOW_INTAKE_REASONS.includes(reason);
}

// Whether a served observation counts toward Meal-preference analytics
// (valid observation population — docs/13 Decision 032 §42).
export function isValidPreferenceObservation(row: {
  served_status: 'served' | 'not_served';
  low_intake_reason: LowIntakeReason | null;
}): boolean {
  if (row.served_status !== 'served') return false;
  return !isNonPreferenceReason(row.low_intake_reason);
}

// Parent-facing human-readable translation of the authoritative structured
// percentage (docs/13 Decision 032 §33). The percentage remains authoritative.
export function consumptionHumanLabel(pct: ConsumptionPct | null): string {
  if (pct === null) return 'Not recorded';
  const map: Record<ConsumptionPct, string> = {
    100: 'Ate all',
    75: 'Ate most',
    50: 'Ate about half',
    25: 'Ate a little',
    0: 'Did not eat',
  };
  return map[pct];
}

/**
 * Aggregation over raw Classroom Meal Records (blueprint Parts 24/27).
 *
 * The valid-observation population is the ONLY denominator used for
 * consumption/preference stats: a child who was absent, unwell, asleep, or
 * simply not served did not reject the Meal, and counting them as a 0% would
 * make the whole analytics surface lie. Those rows are still counted and
 * reported separately as `excluded`, never silently dropped.
 */
export interface ObservationLike {
  served_status: 'served' | 'not_served';
  consumption_pct: number | null;
  behavior: EatingBehavior | null;
  low_intake_reason: LowIntakeReason | null;
  concern_observed?: boolean;
}

export interface AggregateStats {
  total: number;
  valid: number;
  excluded: number;
  avgConsumption: number | null;
  refusals: number;
  refusalRate: number | null;
  encouraged: number;
  encouragementRate: number | null;
  lowIntake: number;
  lowIntakeRate: number | null;
  concerns: number;
  distribution: Record<number, number>;
  reasons: Record<string, number>;
}

function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * The subset of valid observations that actually carries a recorded percentage.
 *
 * An observation can be valid (a served, non-exception meal) and still have no
 * consumption reading yet. Averaging it as `?? 0` silently reported "ate none"
 * for a meal nobody had scored — the difference between "0%" and "not recorded"
 * is exactly the distinction the classroom record exists to preserve.
 */
export function measuredObservations<T extends { consumption_pct: number | null }>(
  rows: T[],
): Array<T & { consumption_pct: number }> {
  return rows.filter(
    (r): r is T & { consumption_pct: number } => r.consumption_pct !== null,
  );
}

/** Mean of the recorded percentages, or null when nothing has been scored. */
export function meanConsumption(rows: Array<{ consumption_pct: number | null }>): number | null {
  const measured = measuredObservations(rows);
  if (measured.length === 0) return null;
  return Math.round(measured.reduce((s, r) => s + r.consumption_pct, 0) / measured.length);
}

export function aggregateObservations(rows: ObservationLike[]): AggregateStats {
  const valid = rows.filter((r) => isValidPreferenceObservation(r));
  const distribution: Record<number, number> = { 0: 0, 25: 0, 50: 0, 75: 0, 100: 0 };
  valid.forEach((r) => {
    if (r.consumption_pct !== null && r.consumption_pct in distribution) {
      distribution[r.consumption_pct] += 1;
    }
  });

  // Reasons are counted across ALL rows, including the non-preference ones —
  // "3 children were unwell" is operationally useful even though it must not
  // touch the consumption average.
  const reasons: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.low_intake_reason) {
      reasons[r.low_intake_reason] = (reasons[r.low_intake_reason] ?? 0) + 1;
    }
  });

  const refusals = valid.filter((r) => r.behavior === 'refused').length;
  const encouraged = valid.filter((r) => r.behavior === 'needed_encouragement').length;
  const lowIntake = valid.filter((r) => isLowIntake((r.consumption_pct ?? null) as never)).length;

  return {
    total: rows.length,
    valid: valid.length,
    excluded: rows.length - valid.length,
    // Only SCORED valid observations are averaged — an unscored one is "not
    // recorded", never 0%.
    avgConsumption: meanConsumption(valid),
    refusals,
    refusalRate: rate(refusals, valid.length),
    encouraged,
    encouragementRate: rate(encouraged, valid.length),
    lowIntake,
    lowIntakeRate: rate(lowIntake, valid.length),
    concerns: rows.filter((r) => r.concern_observed).length,
    distribution,
    reasons,
  };
}

/**
 * Meal-performance classification — KEEP / MONITOR / REVIEW_IMPROVE /
 * CANDIDATE_FOR_REMOVAL.
 *
 * The four labels are approved concepts. The NUMERIC THRESHOLDS that would
 * assign a meal to one of them are **NOT_YET_DEFINED**: no approved source
 * states the consumption cut-offs, the refusal share, or the minimum number of
 * observations required before a judgement is fair.
 *
 * A previous implementation invented them (70/40/55% consumption, 10/15/30%
 * refusal, "at least 3 observations"). Those numbers decided whether a real
 * meal looked like a candidate for removal, so inventing them was not a
 * cosmetic liberty. They are removed rather than replaced.
 *
 * Every FACTUAL measure the classification was derived from is still reported
 * in full (average consumption, the distribution, refusal / encouragement /
 * DID_NOT_LIKE_IT, the reason breakdown and the trend) — a Super Admin sees the
 * evidence and applies their own judgement until the Founder approves the
 * thresholds.
 */
export function classifyMealPerformance(): {
  label: string;
  variant: string;
} {
  return { label: 'NOT_YET_DEFINED', variant: 'slate' };
}

// ---------------------------------------------------------------------------
// Preference grouping (correction order §30/§31).
//
// A "favourite meal" is the MEAL, not a single dated serving of it. Chicken
// Pasta served on Monday, Thursday and next Tuesday is ONE meal with three
// observations — it must not appear as three unrelated meals keyed by
// meal_service_id. Group by the meal's identity (its dish name, which is the
// meal revision's name) and average consumption across every serving of it.
export interface MealPreference {
  label: string;
  value: number; // mean consumption_pct across all servings of this meal
  count: number; // how many valid observations contributed
}

// §9: identity resolves a dated service to the STABLE meal it served — its
// meal_id, not the dish-name text. Grouping on meal_id means the same meal
// aggregates as one favourite even across a rename, and two genuinely different
// meals that happen to share a name never merge. The label is carried for
// display only.
export interface MealIdentity {
  id: string;
  label: string;
}

export function groupPreferencesByMeal(
  records: Array<{ meal_service_id: string | null; consumption_pct: number | null }>,
  identityFor: (serviceId: string) => MealIdentity | undefined,
): MealPreference[] {
  const byMeal = new Map<string, { label: string; total: number; count: number }>();
  for (const r of records) {
    if (!r.meal_service_id) continue; // pre-cutover records have no service link
    const meal = identityFor(r.meal_service_id);
    if (!meal) continue;
    if (r.consumption_pct === null) continue; // unscored: not 0%, just not recorded
    const e = byMeal.get(meal.id) ?? { label: meal.label, total: 0, count: 0 };
    e.total += r.consumption_pct;
    e.count += 1;
    byMeal.set(meal.id, e); // key is the stable MEAL id, never the service id or name
  }
  return [...byMeal.values()]
    .map((e) => ({ label: e.label, value: Math.round(e.total / e.count), count: e.count }))
    .sort((a, b) => b.value - a.value);
}
