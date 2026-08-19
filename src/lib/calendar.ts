import type { AppPeriod } from './types';

/**
 * Pure mirror of the SQL calendar resolution (migration 0016, Decision 033).
 *
 * The database is authoritative — `resolve_meal()` runs there and RLS enforces
 * who may see the result. This module exists so the *semantics* are pinned by
 * unit tests without needing a live database, the same way `rbac.ts` mirrors the
 * RLS matrix. If these two ever disagree, the SQL wins and this file is the bug.
 */

/** menus/rotation weekday convention: 0 = Monday … 6 = Sunday. */
export function isoWeekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Midnight of the Monday that starts the given date's week, in local time. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - isoWeekdayIndex(out));
  return out;
}

/**
 * Which rotation week applies to a real date.
 *
 * Derived from whole calendar weeks elapsed since the assignment anchor — NOT
 * from counting days that actually had service. That is precisely why a closure
 * cannot shift the rotation forward (Decision 033).
 *
 * Returns null when the date precedes the assignment.
 */
export function rotationWeekFor(
  date: Date,
  effectiveFrom: Date,
  anchorWeek: number,
  weekCount: number,
): number | null {
  if (weekCount < 1) return null;
  const weeks = Math.floor(
    (startOfWeek(date).getTime() - startOfWeek(effectiveFrom).getTime()) / (7 * 24 * 3600 * 1000),
  );
  if (weeks < 0) return null;
  return ((((anchorWeek - 1 + weeks) % weekCount) + weekCount) % weekCount) + 1;
}

export type ResolutionSource = 'closure' | 'override' | 'special_period' | 'rotation' | 'none';

export interface ResolvedMeal {
  mealId: string | null;
  source: ResolutionSource;
}

export interface CalendarExceptionLike {
  kind: 'closure' | 'override' | 'special_period';
  dateFrom: string; // ISO yyyy-mm-dd
  dateTo: string;
  /** null => applies to every period on those dates */
  period: AppPeriod | null;
  mealId?: string | null;
  rotationId?: string | null;
}

export interface RotationSlotLike {
  rotationId: string;
  weekNumber: number;
  weekday: number;
  period: AppPeriod;
  mealId: string | null;
}

export interface ResolveInput {
  date: string; // ISO yyyy-mm-dd
  period: AppPeriod;
  /** Periods the institution actually receives on this date. Empty => none. */
  planPeriods: AppPeriod[];
  exceptions: CalendarExceptionLike[];
  /** Normal rotation assignment, if any. */
  rotation?: {
    rotationId: string;
    effectiveFrom: string;
    anchorWeek: number;
    weekCount: number;
  } | null;
  slots: RotationSlotLike[];
}

function covers(e: CalendarExceptionLike, date: string, period: AppPeriod): boolean {
  if (date < e.dateFrom || date > e.dateTo) return false;
  return e.period === null || e.period === period;
}

/**
 * Deterministic precedence, in the order Decision 033 fixes:
 *   service plan gate > closure > override > special period > rotation > none.
 *
 * Never fabricates a meal: an unresolvable slot returns `{ mealId: null }`.
 */
export function resolveMeal(input: ResolveInput): ResolvedMeal {
  const { date, period, planPeriods, exceptions, rotation, slots } = input;

  // 0. The institution must actually receive this period. No plan => no service.
  if (!planPeriods.includes(period)) return { mealId: null, source: 'none' };

  // 1. Closure beats everything.
  if (exceptions.some((e) => e.kind === 'closure' && covers(e, date, period))) {
    return { mealId: null, source: 'closure' };
  }

  // 2. Date-specific override.
  const override = exceptions.find((e) => e.kind === 'override' && covers(e, date, period));
  if (override?.mealId) return { mealId: override.mealId, source: 'override' };

  const weekday = isoWeekdayIndex(new Date(`${date}T00:00:00`));

  // 3. Special period rotation for the range.
  const special = exceptions.find(
    (e) => e.kind === 'special_period' && date >= e.dateFrom && date <= e.dateTo,
  );
  if (special?.rotationId) {
    const slot = slots.find(
      (s) => s.rotationId === special.rotationId && s.weekday === weekday && s.period === period,
    );
    return { mealId: slot?.mealId ?? null, source: 'special_period' };
  }

  // 4. Normal rotation.
  if (!rotation) return { mealId: null, source: 'none' };
  const week = rotationWeekFor(
    new Date(`${date}T00:00:00`),
    new Date(`${rotation.effectiveFrom}T00:00:00`),
    rotation.anchorWeek,
    rotation.weekCount,
  );
  if (week === null) return { mealId: null, source: 'none' };

  const slot = slots.find(
    (s) =>
      s.rotationId === rotation.rotationId &&
      s.weekNumber === week &&
      s.weekday === weekday &&
      s.period === period,
  );

  // 5. Nothing applicable -> no meal invented.
  return slot?.mealId
    ? { mealId: slot.mealId, source: 'rotation' }
    : { mealId: null, source: 'none' };
}
