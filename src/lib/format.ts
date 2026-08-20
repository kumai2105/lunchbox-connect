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

// ---------------------------------------------------------------------------
// Canonical MVP operational date (item: UAE date handling).
//
// The market is Dubai/Sharjah. Gulf Standard Time is UTC+4 with no DST, so the
// operational calendar date is the date part of the instant shifted +4h read in
// UTC — deterministic and independent of the host machine's timezone. Between
// 20:00 and 24:00 UTC this is already "tomorrow" in the nursery, which is
// exactly the boundary a UTC `new Date().toISOString()` got wrong. Per-
// institution timezones are intentionally NOT modelled yet.
export const UAE_UTC_OFFSET_HOURS = 4;

/** The Asia/Dubai calendar date for a given instant, as YYYY-MM-DD. */
export function operationalDateFor(instant: Date): string {
  return new Date(instant.getTime() + UAE_UTC_OFFSET_HOURS * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

/** Today's operational (Asia/Dubai) date. */
export function operationalToday(): string {
  return operationalDateFor(new Date());
}

/** The operational date `n` days before today (Asia/Dubai). */
export function operationalDaysAgoISO(n: number, base: Date = new Date()): string {
  const d = new Date(base.getTime() + UAE_UTC_OFFSET_HOURS * 3_600_000);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// The whole app's "today" is the operational (Asia/Dubai) date, so the browser
// and the database agree on the service day even after UTC midnight.
export function todayISO(): string {
  return operationalToday();
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

/** Monday (operational/Asia/Dubai) of the week containing `base`, as YYYY-MM-DD. */
export function weekStartISO(base: Date = new Date()): string {
  const x = new Date(base.getTime() + UAE_UTC_OFFSET_HOURS * 3_600_000);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

/** Sunday (operational/Asia/Dubai) of the week containing `base`, as YYYY-MM-DD. */
export function weekEndISO(base: Date = new Date()): string {
  const x = new Date(`${weekStartISO(base)}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 6);
  return x.toISOString().slice(0, 10);
}

// menus.weekday: 0=Mon..4=Fri. Date.getDay() is 0=Sun..6=Sat.
export function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}
