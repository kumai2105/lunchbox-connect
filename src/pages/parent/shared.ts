import type { AppPeriod, ServingRecord } from '../../lib/types';
import { serviceRoster, type DayMeal } from '../../lib/api';
import type { IconName } from '../../components/icons';
import { formatOperationalTime } from '../../lib/format';

// Four approved meal periods (docs/02 §26, docs/09 AT-082).
export { PERIOD_ORDER } from '../../lib/periods';

export const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Morning snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

export const PERIOD_ICON: Record<AppPeriod, IconName> = {
  breakfast: 'sunrise',
  snack: 'apple',
  lunch: 'utensils',
  afternoon_snack: 'cookie',
};

export function recordsForDate(
  records: ServingRecord[],
  date: string,
): Partial<Record<AppPeriod, ServingRecord>> {
  const out: Partial<Record<AppPeriod, ServingRecord>> = {};
  records
    .filter((r) => r.serving_date === date)
    .forEach((r) => {
      out[r.period] = r;
    });
  return out;
}

/**
 * Meals for one calendar date, keyed by period.
 *
 * Matches on the service date itself. The previous version derived a weekday
 * and matched template rows, which meant every Wednesday of the year looked
 * identical and a closure or a one-off override could not be represented.
 */
export function mealsForDate(meals: DayMeal[], date: string): Partial<Record<AppPeriod, DayMeal>> {
  const out: Partial<Record<AppPeriod, DayMeal>> = {};
  meals
    .filter((m) => m.service_date === date)
    .forEach((m) => {
      out[m.period] = m;
    });
  return out;
}

/**
 * Tone for a meal result. `null` means nothing has been recorded yet — which
 * must render as "upcoming", never as a zero (blueprint Part 75).
 */
export function toneFor(record: ServingRecord | undefined): 'ok' | 'warn' | 'danger' | 'wait' {
  if (!record) return 'wait';
  if (record.served_status === 'not_served') return 'wait';
  // A served meal with no percentage yet (or an Absent/Unwell/Asleep exception)
  // is NOT "ate none" — it is simply not scored, and must not be coloured as
  // the worst possible outcome.
  if (record.consumption_pct === null) return 'wait';
  const pct = record.consumption_pct;
  if (pct >= 50) return 'ok';
  if (pct > 0) return 'warn';
  return 'danger';
}

/**
 * The time a classroom record was filed, shown on the nursery's clock.
 *
 * This is a SERVICE time a parent reads next to "Lunch" — rendering it from the
 * device's timezone showed a meal recorded at 12:30 in the nursery as 08:30 to
 * a parent whose phone was set elsewhere.
 */
export function timeOf(iso: string): string {
  return formatOperationalTime(iso);
}

/**
 * Guards against an out-of-order async response overwriting fresher state.
 *
 * The Parent portal switches between children. Each switch fires its own set of
 * requests, and they can land in any order — so a slow response for child A
 * could arrive AFTER child B's and repaint B's screen with A's records, photo,
 * meals and notes. For a portal whose entire purpose is showing one family
 * their own child, that is the most serious kind of wrong data.
 *
 * Usage: take a token before starting a load, and discard the result if the
 * token is no longer the current one.
 */
export function createRequestGuard(): {
  next: () => number;
  isCurrent: (token: number) => boolean;
} {
  let current = 0;
  return {
    next: () => (current += 1),
    isCurrent: (token: number) => token === current,
  };
}

/**
 * Whether the loaded dataset actually belongs to the child now selected.
 *
 * The request guard alone was not enough. Clicking another child only calls
 * `setChildId(B)`, so React re-renders IMMEDIATELY with B selected while
 * `records`, `notes`, `meals` and `photoUrl` still hold A's data — and the
 * effect that would start B's load, and flip a loading flag, has not run yet.
 * That single render painted child A's meals and notes under child B's name.
 *
 * Deriving readiness from the data itself removes the window entirely: the id
 * the loaded dataset belongs to must equal the id currently selected. On the
 * selection render those differ, so nothing child-specific is rendered at all.
 */
export function childDataReady(
  loadedChildId: string | null,
  selectedChildId: string | undefined,
): boolean {
  return !!selectedChildId && loadedChildId === selectedChildId;
}

/**
 * WHICH SITTINGS THIS CHILD ACTUALLY RECEIVES, and what they get for each.
 *
 * Resolved through `service_roster()` — the SAME function the Classroom
 * register uses — so the two views cannot disagree about a child's
 * entitlement. It is SECURITY DEFINER and filtered by the existing
 * `app_can_see_student()` rule, so a Parent gets their own child and nobody
 * else's without any new visibility being invented.
 *
 * A sitting the child's Meal Plan does not include is simply absent from the
 * result. It must never be rendered as a missed or pending meal: the child was
 * never due that meal, and showing it as a gap would be telling a parent
 * something untrue about their own child's day.
 */
export async function entitlementForDay(
  childId: string,
  meals: DayMeal[],
  date: string,
): Promise<Record<string, { mealName: string | null; specialRef: string | null }>> {
  const forDate = meals.filter((m) => m.service_date === date);
  const out: Record<string, { mealName: string | null; specialRef: string | null }> = {};
  await Promise.all(
    forDate.map(async (m) => {
      const res = await serviceRoster(m.service_id);
      const mine = (res.data ?? []).find((r) => r.student_id === childId);
      if (mine?.entitled) {
        out[m.period] = {
          mealName: mine.actual_meal_name,
          specialRef: mine.special_reference,
        };
      }
    }),
  );
  return out;
}
