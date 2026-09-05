import type { AppPeriod } from './types';

/**
 * The four meal periods, in the order they happen in a day.
 *
 * This list was previously written out separately in kitchen.ts,
 * parent/shared.ts, InstitutionSchedulePage and MenuBuilderPage — four copies
 * of the same four values, each free to drift from the others and from the
 * database's `app_period` type. Menu Builder and the Meal Library now both
 * depend on this order, so it lives in one place.
 *
 * The values are the stored ones. `snack` is the MORNING snack: it predates
 * `afternoon_snack` (added in migration 0010) and was never renamed, because
 * renaming an enum value already written into years of serving records would
 * rewrite history to tidy a label. The label below carries the meaning.
 */
export const PERIOD_ORDER: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];

export const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Morning snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

/** Stored order, whatever order they arrived in. */
export function sortPeriods(periods: AppPeriod[]): AppPeriod[] {
  return PERIOD_ORDER.filter((p) => periods.includes(p));
}
