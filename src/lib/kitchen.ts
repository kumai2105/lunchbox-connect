import type { AppPeriod } from './types';

// Kitchen production grouping. The production IDENTITY is the exact meal
// revision being produced — never the display name. Two different recipes (or
// two revisions of one meal) that happen to share a name are DIFFERENT
// production lines: same name does not mean same recipe.
export interface DemandRowLike {
  institution_id: string;
  institution_name: string;
  period: AppPeriod;
  meal_revision_id: string;
  meal_name: string;
  eligible_students: number;
  safety_note_flagged: number;
}

export interface ProductionLine {
  meal_revision_id: string;
  meal_name: string;
  period: AppPeriod;
  total: number; // eligible headcount summed across the sites making this revision
  safetyNotes: number;
  sites: DemandRowLike[];
}

import { PERIOD_ORDER } from './periods';

export function groupDemandByRevision(rows: DemandRowLike[]): ProductionLine[] {
  const map = new Map<string, ProductionLine>();
  for (const r of rows) {
    // Key by (period, meal_revision_id) — the authoritative production identity.
    const key = `${r.period}::${r.meal_revision_id}`;
    const e = map.get(key) ?? {
      meal_revision_id: r.meal_revision_id,
      meal_name: r.meal_name,
      period: r.period,
      total: 0,
      safetyNotes: 0,
      sites: [] as DemandRowLike[],
    };
    e.total += r.eligible_students;
    e.safetyNotes += r.safety_note_flagged;
    e.sites.push(r);
    map.set(key, e);
  }
  return [...map.values()].sort(
    (a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period),
  );
}
