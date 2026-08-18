// Pure helpers for the structured Classroom Meal Record (docs/13 Decision 032).
// Mirrors the DB-side rules (migration 0014) so the same logic is unit-testable
// without a live database — same pattern as rbac.ts mirroring RLS.

import { NON_PREFERENCE_LOW_INTAKE_REASONS } from './types';
import type { ConsumptionPct, EatingBehavior, LowIntakeReason, MealPerformanceRow } from './types';

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

// Decision-support classification for a menu item's aggregate meal-performance
// row (docs/13 Decision 032 §42-45) — one implementation shared by the
// Dashboard's "top/bottom dishes" panel and the full Reporting page, so the
// label a Super Admin sees never disagrees with itself between screens.
export function classifyMealPerformance(row: MealPerformanceRow): {
  label: string;
  variant: string;
} {
  if (row.valid_observations < 3) return { label: 'Not enough data', variant: 'slate' };
  const pct = row.avg_consumption_pct ?? 0;
  const refusalShare = row.refusal_count / row.valid_observations;
  if (pct >= 70 && refusalShare < 0.1) return { label: 'KEEP', variant: 'brand' };
  if (pct < 40 || refusalShare >= 0.3) return { label: 'CANDIDATE_FOR_REMOVAL', variant: 'na' };
  if (pct < 55 || refusalShare >= 0.15) return { label: 'REVIEW_IMPROVE', variant: 'reduced' };
  return { label: 'MONITOR', variant: 'free' };
}
