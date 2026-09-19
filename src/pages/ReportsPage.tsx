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
      ? 'reports only, with no operational editing. Which reports, and the exact measures in them, are not decided yet.'
      : role === 'viewer'
        ? 'read-only access. Exactly what a viewer may read is not decided yet, and nothing can be changed from here in any case.'
        : 'reporting drawn from real operational records. Which reports, and the exact measures in them, are not decided yet.';
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
        Every figure here is calculated from the same records Classroom Staff enter once for
        Parents. Absent, unwell, sleeping and not-served observations are excluded from the
        consumption figures — they are not evidence that a child disliked a meal.
      </Banner>
      <Banner kind="warn">
        The <b>Classification</b> column is deliberately left unrated. Rating a meal would mean
        deciding at what number it counts as good or poor, and that judgement is yours, not the
        platform's. Every measure that judgement would rest on is in this table. Nothing here
        removes, substitutes or changes a meal on its own.
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
                <th className="col-secondary">Ate all / most / half / some / none</th>
                <th>Refusals</th>
                <th>Needed encouragement</th>
                <th>Didn't like it</th>
                <th className="col-secondary">Reasons</th>
                <th className="col-secondary">Exceptions</th>
                <th className="col-secondary">Trend</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = classifyMealPerformance();
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
                    {/* The approved 100/75/50/25/0 distribution, as counts with
                        their share of the valid population. */}
                    <td className="mono col-secondary">
                      {r.ate_all_count} / {r.ate_most_count} / {r.ate_half_count} /{' '}
                      {r.ate_some_count} / {r.ate_none_count}
                      {r.ate_all_share !== null && (
                        <span className="cell-sub">
                          {' '}
                          ({r.ate_all_share}% / {r.ate_most_share}% / {r.ate_half_share}% /{' '}
                          {r.ate_some_share}% / {r.ate_none_share}%)
                        </span>
                      )}
                    </td>
                    <td className="mono">
                      {r.refusal_count}
                      {r.refusal_share !== null && (
                        <span className="cell-sub"> ({r.refusal_share}%)</span>
                      )}
                    </td>
                    <td className="mono">
                      {r.encouragement_count}
                      {r.encouragement_share !== null && (
                        <span className="cell-sub"> ({r.encouragement_share}%)</span>
                      )}
                    </td>
                    <td className="mono">
                      {r.did_not_like_count}
                      {r.did_not_like_share !== null && (
                        <span className="cell-sub"> ({r.did_not_like_share}%)</span>
                      )}
                    </td>
                    {/* Low-intake reasons, and the behaviour-free exceptions kept
                        separate because they never enter the averages. */}
                    <td className="cell-sub col-secondary">
                      {r.reason_not_hungry +
                        r.reason_did_not_like_it +
                        r.reason_distracted +
                        r.reason_other ===
                      0
                        ? '—'
                        : `not hungry ${r.reason_not_hungry} · didn't like ${r.reason_did_not_like_it} · distracted ${r.reason_distracted} · other ${r.reason_other}`}
                    </td>
                    <td className="cell-sub col-secondary">
                      {r.exception_absent + r.exception_unwell + r.exception_sleeping === 0
                        ? '—'
                        : `absent ${r.exception_absent} · unwell ${r.exception_unwell} · asleep ${r.exception_sleeping}`}
                    </td>
                    {/* Factual trend: the two window averages and their
                        difference. No threshold decides what the number means. */}
                    <td className="mono col-secondary">
                      {r.trend_delta_pct === null ? (
                        <span className="cell-sub">—</span>
                      ) : (
                        <>
                          {r.trend_delta_pct > 0 ? '+' : ''}
                          {r.trend_delta_pct}
                          <span className="cell-sub">
                            {' '}
                            ({r.prior_avg_consumption_pct}% → {r.recent_avg_consumption_pct}%, last{' '}
                            {r.trend_window_days}d)
                          </span>
                        </>
                      )}
                    </td>
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
