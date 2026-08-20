import { useEffect, useState } from 'react';
import ShellPage from './ShellPage';
import { mealPerformance, mealRevisionPerformance } from '../lib/api';
import type { MealPerformanceRow, MealRevisionPerformanceRow } from '../lib/types';
import { Banner, Card, EmptyState, PageHead, Pill, Spinner } from '../components/ui';
import { useRole } from '../lib/auth';
import { classifyMealPerformance } from '../lib/mealAnalytics';

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

function MealPerformance() {
  const [rows, setRows] = useState<MealPerformanceRow[] | null>(null);
  const [revRows, setRevRows] = useState<MealRevisionPerformanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([mealPerformance(), mealRevisionPerformance()]).then(([res, rev]) => {
      if (!active) return;
      if (res.error || rev.error) setError(res.error ?? rev.error);
      setRows(res.data ?? []);
      setRevRows(rev.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  // A meal is worth a revision breakdown only when more than one revision of it
  // has actually been observed — that is exactly the before/after case.
  const revisedMeals = new Set(
    Object.entries(
      (revRows ?? []).reduce<Record<string, Set<string>>>((acc, r) => {
        (acc[r.meal_id] ??= new Set()).add(r.meal_revision_id);
        return acc;
      }, {}),
    )
      .filter(([, revs]) => revs.size > 1)
      .map(([mealId]) => mealId),
  );
  const revisionBreakdown = (revRows ?? []).filter((r) => revisedMeals.has(r.meal_id));

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
                const c = classifyMealPerformance(r);
                return (
                  <tr key={r.menu_item_id}>
                    <td className="cell-name">{r.dish_name}</td>
                    <td className="cell-sub">{r.period}</td>
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

      <Card
        title="By recipe revision"
        hint="before/after evaluation — only meals with more than one observed revision"
      >
        {!revRows ? (
          <Spinner />
        ) : revisionBreakdown.length === 0 ? (
          <EmptyState text="No meal has been observed across more than one recipe revision yet." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Meal</th>
                <th>Revision</th>
                <th>Period</th>
                <th>Valid observations</th>
                <th>Avg. consumption</th>
                <th>Refusals</th>
              </tr>
            </thead>
            <tbody>
              {revisionBreakdown.map((r) => (
                <tr key={`${r.meal_revision_id}-${r.period}`}>
                  <td className="cell-name">{r.meal_name}</td>
                  <td className="mono">
                    v{r.revision_no}
                    {r.revision_name !== r.meal_name ? ` — ${r.revision_name}` : ''}
                  </td>
                  <td className="cell-sub">{r.period}</td>
                  <td className="mono">
                    {r.valid_observations} / {r.total_observations}
                  </td>
                  <td className="mono">
                    {r.avg_consumption_pct !== null ? `${r.avg_consumption_pct}%` : '—'}
                  </td>
                  <td className="mono">{r.refusal_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
