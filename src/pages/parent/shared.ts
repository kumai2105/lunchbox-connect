import type { AppPeriod, MenuItem, ServingRecord } from '../../lib/types';
import type { IconName } from '../../components/icons';
import { isoWeekday } from '../../lib/format';

// Four approved meal periods (docs/02 §26, docs/09 AT-082).
export const PERIOD_ORDER: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];

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

export function menuForDate(menu: MenuItem[], date: string): Partial<Record<AppPeriod, MenuItem>> {
  const weekday = isoWeekday(new Date(`${date}T00:00:00`));
  const out: Partial<Record<AppPeriod, MenuItem>> = {};
  menu
    .filter((m) => m.weekday === weekday)
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
  const pct = record.consumption_pct ?? 0;
  if (pct >= 50) return 'ok';
  if (pct > 0) return 'warn';
  return 'danger';
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
