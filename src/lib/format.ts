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
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (+date - +firstThursday) / (7 * 24 * 3600 * 1000);
  return 1 + Math.round((diff + 1) / 7);
}

// menus.weekday: 0=Mon..4=Fri. Date.getDay() is 0=Sun..6=Sat.
export function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}
