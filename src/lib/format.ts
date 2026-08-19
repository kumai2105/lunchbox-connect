// Small formatting helpers.

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Deterministic week label for the menu grid: baseWeek is the admin-set "now".
export function weekLabel(week: number): string {
  return `Week ${week}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ISO week number for a date — used to resolve which menu week applies
// (menus.week_number is a real calendar ISO week, per the existing menu-lookup
// convention this app already used for the Parent view before docs/13
// Decision 032, now shared so serving records can resolve the same Meal).
/**
 * ISO-8601 week number.
 *
 * The previous implementation divided by seven twice — `diff` was already a
 * count of weeks and was then divided by 7 again — so the result advanced
 * once every SEVEN calendar weeks. Across 12 consecutive weeks it changed
 * twice instead of eleven times. Nothing addresses meals by this number any
 * more (that moved to rotation position, which the database computes), but
 * the function is exported, so it is corrected rather than left as a trap.
 */
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Shift to the Thursday of this ISO week: the year that Thursday falls in
  // is by definition the ISO week-numbering year.
  date.setUTCDate(date.getUTCDate() + 4 - ((date.getUTCDay() + 6) % 7) - 1);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
}

/** Monday of the week containing `d`, as YYYY-MM-DD. */
export function weekStartISO(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return toISO(x);
}

/** Sunday of the week containing `d`, as YYYY-MM-DD. */
export function weekEndISO(d: Date = new Date()): string {
  const x = new Date(`${weekStartISO(d)}T00:00:00`);
  x.setDate(x.getDate() + 6);
  return toISO(x);
}

function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// menus.weekday: 0=Mon..4=Fri. Date.getDay() is 0=Sun..6=Sat.
export function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}
