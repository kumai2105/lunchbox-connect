import { useEffect, useState } from 'react';
import ShellPage from './ShellPage';
import { mealPerformance } from '../lib/api';
import type { MealPerformanceRow } from '../lib/types';
import { Banner, Card, EmptyState, PageHead, Pill, Spinner } from '../components/ui';
import { useRole } from '../lib/auth';

/**
 * Reporting (docs/02 §16/18, docs/09 AT-100): Finance / Owner sees REPORTS
 * ONLY; Viewer is READ-ONLY. Exact KPI definitions are NOT_YET_DEFINED, so
 * most of this stays the honest shell. Meal-performance analytics (docs/13
 * Decision 032) are now defined and shown to Super Admin — the only
 * "management" role that exists, per Decision 007 — derived from the same
 * Classroom Meal Records Staff record once, never entered twice.
 *
 * Reads the actual signed-in role via useRole() — this page is reachable by
 * four different roles (docs/02 §49) and must render each one's own scope,
 * not whichever role happened to be hardcoded at the call site.
 */
export default function ReportsPage() {
  const role = useRole();
  if (role === 'super_admin') return <MealPerformance />;

  const scope =
    role === 'finance_owner'
      ? 'Reports only. No operational editing (docs/02 §16-17). Exact report set and KPI definitions are NOT_YET_DEFINED.'
      : role === 'viewer'
        ? 'Read-only viewer. Exact readable scope is BLOCKED_BY_SPEC (docs/09 AT-036) — no writes are possible from here.'
        : 'Reporting must derive from authoritative operational records (docs/03 §5, AT-100). Exact report and KPI definitions are NOT_YET_DEFINED.';
  return <ShellPage title="Reporting" scope={scope} />;
}

function classify(row: MealPerformanceRow): { label: string; variant: string } {
  if (row.valid_observations < 3) return { label: 'Not enough data', variant: 'slate' };
  const pct = row.avg_consumption_pct ?? 0;
  const refusalShare = row.refusal_count / row.valid_observations;
  if (pct >= 70 && refusalShare < 0.1) return { label: 'KEEP', variant: 'brand' };
  if (pct < 40 || refusalShare >= 0.3) return { label: 'CANDIDATE_FOR_REMOVAL', variant: 'na' };
  if (pct < 55 || refusalShare >= 0.15) return { label: 'REVIEW_IMPROVE', variant: 'reduced' };
  return { label: 'MONITOR', variant: 'free' };
}

function MealPerformance() {
  const [rows, setRows] = useState<MealPerformanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void mealPerformance().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHead
        title="Meal performance"
        hint="derived from Classroom Meal Records — decision support only"
      />
      <Banner kind="info">
        Every metric here is mathematically derived from the same records Classroom Staff record
        once for Parents (docs/13 Decision 032). Absent, unwell, sleeping and not-served
        observations are excluded from consumption stats — they are not evidence a child disliked a
        Meal.
      </Banner>
      <Banner kind="warn">
        Classification labels are decision-support evidence for a human reviewer. Nothing here
        removes, substitutes, or modifies a Meal automatically.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}

      <Card title="Meals recorded so far">
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState text="No Meal observations recorded yet." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Meal</th>
                <th>Period</th>
                <th>Week</th>
                <th>Valid observations</th>
                <th>Avg. consumption</th>
                <th>Refusals</th>
                <th>Needed encouragement</th>
                <th>Didn't like it</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = classify(r);
                return (
                  <tr key={r.menu_item_id}>
                    <td className="cell-name">{r.dish_name}</td>
                    <td className="cell-sub">{r.period}</td>
                    <td className="mono">{r.week_number}</td>
                    <td className="mono">
                      {r.valid_observations} / {r.total_observations}
                    </td>
                    <td className="mono">
                      {r.avg_consumption_pct !== null ? `${r.avg_consumption_pct}%` : '—'}
                    </td>
                    <td className="mono">{r.refusal_count}</td>
                    <td className="mono">{r.encouragement_count}</td>
                    <td className="mono">{r.did_not_like_count}</td>
                    <td>
                      <Pill variant={c.variant}>{c.label}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
