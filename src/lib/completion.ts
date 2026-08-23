import type { DashboardInstitutionRow, MealPerformanceRow } from './types';

/**
 * The FACTUAL completion state of an institution's operational day.
 *
 * `expected_today` is eligible students × periods PUBLISHED for today. When it
 * is zero there is no service — a closure, or simply nothing published — and
 * "0 of 0 recorded" is a complete day, not a missing one. The dashboard used to
 * read `active_students > 0 && meals_today === 0` and announce "No outcomes
 * recorded yet", which accused a legitimately closed nursery of failing to
 * record meals it was never asked to serve.
 *
 * These four states are exact counts. No threshold decides between them,
 * because none is needed and none is approved.
 */
export type CompletionState = 'no_service' | 'not_started' | 'in_progress' | 'complete';

export function completionState(row: {
  expected_today: number;
  meals_today: number;
}): CompletionState {
  if (row.expected_today <= 0) return 'no_service';
  if (row.meals_today <= 0) return 'not_started';
  if (row.meals_today >= row.expected_today) return 'complete';
  return 'in_progress';
}

export const COMPLETION_LABEL: Record<CompletionState, string> = {
  no_service: 'No meals scheduled today',
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
};

export const COMPLETION_DOT: Record<CompletionState, 'gray' | 'amber' | 'green'> = {
  no_service: 'gray',
  not_started: 'amber',
  in_progress: 'amber',
  complete: 'green',
};

/**
 * Institutions that genuinely owe Classroom records today.
 *
 * A no-service institution is NOT one of them, however many eligible students
 * it has on the roster.
 */
export function institutionsNeedingAttention<
  T extends { expected_today: number; meals_today: number },
>(rows: T[]): T[] {
  return rows.filter((r) => completionState(r) === 'not_started');
}

/**
 * Combined average consumption across meals, weighted by the population each
 * average actually describes.
 *
 * `avg_consumption_pct` is computed from SCORED observations only (migration
 * 0035). Weighting it by `valid_observations` therefore over-weights any meal
 * that carries behaviour-only records with no percentage — the average would be
 * pulled toward a number that a larger population never voted on.
 */
export function weightedAverageConsumption(
  meals: Array<Pick<MealPerformanceRow, 'avg_consumption_pct' | 'scored_observations'>>,
): number | null {
  const scored = meals.filter((m) => m.avg_consumption_pct !== null && m.scored_observations > 0);
  const denominator = scored.reduce((sum, m) => sum + m.scored_observations, 0);
  if (denominator === 0) return null;
  const numerator = scored.reduce(
    (sum, m) => sum + (m.avg_consumption_pct as number) * m.scored_observations,
    0,
  );
  return Math.round(numerator / denominator);
}

/** Total eligible students, from the authorized dashboard read model. */
export function totalActiveStudents(rows: DashboardInstitutionRow[]): number {
  return rows.reduce((sum, r) => sum + r.active_students, 0);
}
