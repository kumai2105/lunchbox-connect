import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardSummary, mealPerformance } from '../lib/api';
import type { DashboardInstitutionRow, MealPerformanceRow } from '../lib/types';
import {
  Banner,
  Card,
  EmptyState,
  PageHead,
  Pill,
  Spinner,
  StatCard,
  StatusDot,
} from '../components/ui';
import { useRole } from '../lib/auth';
import {
  COMPLETION_DOT,
  COMPLETION_LABEL,
  completionState,
  institutionsNeedingAttention,
  totalActiveStudents,
  weightedAverageConsumption,
} from '../lib/completion';
import { can } from '../lib/rbac';
import { classifyMealPerformance } from '../lib/mealAnalytics';

export default function DashboardPage() {
  const role = useRole();
  const [rows, setRows] = useState<DashboardInstitutionRow[] | null>(null);
  const [meals, setMeals] = useState<MealPerformanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      // Production Demand is NOT an authorized read for every dashboard role
      // (Institution access is NOT_YET_DEFINED), and the eligible-student count
      // it was fetched for is already a factual column of the dashboard read
      // model. One authorized query, no unauthorized one.
      const d = await dashboardSummary();
      if (!active) return;
      if (d.error) setError(d.error);
      setRows(d.data ?? []);
      // v_meal_performance is Super Admin only at the RLS layer — fetching it
      // as any other role would just come back empty, so skip the request.
      if (role === 'super_admin') {
        const m = await mealPerformance();
        if (active && m.data) setMeals(m.data);
      }
    })();
    return () => {
      active = false;
    };
  }, [role]);

  if (error && !rows) return <EmptyState text={`Could not load the dashboard: ${error}`} />;
  if (!rows) return <Spinner />;

  // Whether this person operates LunchBox Connect across customers, or works
  // for one of those customers. Read from the role, not from how many rows came
  // back: a Super Admin who happens to have one customer is still the operator.
  const isGlobalOperator = role === 'super_admin';

  const activeStudents = rows.reduce((sum, r) => sum + r.active_students, 0);
  const mealsToday = rows.reduce((sum, r) => sum + r.meals_today, 0);
  const eligibleStudents = totalActiveStudents(rows);
  // Only institutions that genuinely OWE records today. A closed one owes none.
  const needsAttention = institutionsNeedingAttention(rows);

  // Weighted by the population each average actually describes — SCORED
  // observations. avg_consumption_pct never included a behaviour-only record,
  // so weighting it by valid_observations counted people who did not vote.
  const avgConsumption = weightedAverageConsumption(meals);
  // Refusal IS a property of the valid population, so it keeps that denominator.
  const totalValidObs = meals.reduce((sum, m) => sum + m.valid_observations, 0);
  const totalRefusals = meals.reduce((sum, m) => sum + m.refusal_count, 0);
  const refusalRate =
    totalValidObs > 0 ? Math.round((totalRefusals / totalValidObs) * 1000) / 10 : null;

  return (
    <div>
      <PageHead title="Dashboard" hint="what is happening across your institutions today" />

      {error && <Banner kind="err">{error}</Banner>}

      {/* Every destination below is gated by the SAME can() matrix the target
          route enforces: a Nursery Admin is denied /institutions and /status,
          so those tiles must not be presented as links to them. Where no
          approved destination exists for the role, the metric still shows —
          only the navigation is withheld (no replacement route is invented). */}
      <div className="stat-grid">
        {/* PROVEN, not assumed: v_dashboard_institutions is security_invoker,
            so institutions_select scopes it to the caller. An Institution Admin
            reads exactly one row — their own — and a Super Admin reads them
            all. The number was never global; the WORDING was, and "1 across
            the chain" reads to an Institution Admin like a company-wide figure
            they should not have. Each role now gets the label that describes
            what it is actually looking at. */}
        {isGlobalOperator ? (
          <StatCard
            icon="building"
            label="Institutions"
            value={rows.length}
            trend="across the chain"
            to={can(role, 'institutions', 'view') ? '/institutions' : undefined}
          />
        ) : (
          <StatCard
            icon="building"
            label="Your institution"
            value={rows[0]?.name ?? '—'}
            trend={rows[0] ? 'the one you administer' : 'none assigned to your account'}
          />
        )}
        <StatCard
          icon="users"
          label="Active students"
          value={activeStudents.toLocaleString()}
          trend="enrolled"
          to={can(role, 'students', 'view') ? '/students' : undefined}
        />
        <StatCard
          icon="checkCircle"
          label="Operationally eligible"
          value={eligibleStudents}
          trend="in the meal service"
          to={can(role, 'status', 'view') ? '/status' : undefined}
        />
        <StatCard
          icon="utensils"
          label="Meals recorded today"
          value={mealsToday.toLocaleString()}
          trend="against the roster"
          to={can(role, 'analytics', 'view') ? '/analytics?days=7' : undefined}
        />
        {role === 'super_admin' && avgConsumption !== null && (
          <StatCard
            icon="checkCircle"
            label="Average consumption"
            value={`${avgConsumption}%`}
            trend="across all recorded meals"
            to="/analytics"
          />
        )}
        {role === 'super_admin' && refusalRate !== null && (
          <StatCard
            icon="xCircle"
            label="Refusal rate"
            value={`${refusalRate}%`}
            trend="of valid observations"
            to="/analytics"
          />
        )}
      </div>

      <Card
        title={isGlobalOperator ? 'Institutions — serving today' : 'Serving today'}
        hint={isGlobalOperator ? 'every institution you operate' : 'your institution only'}
        actions={
          can(role, 'institutions', 'view') ? (
            <Link to="/institutions" className="btn ghost">
              Manage →
            </Link>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState text="No institutions yet — a Super Admin can add the first one." />
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th className="col-secondary">Classrooms</th>
                <th>Active students</th>
                <th>Meals today</th>
                <th className="col-secondary">Fill rate</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // §38: completion = completed applicable records / EXPECTED
                // applicable records (eligible students × periods published
                // today). Undefined when nothing is expected today.
                const rate =
                  r.expected_today > 0
                    ? Math.round((r.meals_today / r.expected_today) * 100)
                    : null;
                return (
                  <tr key={r.institution_id}>
                    <td className="cell-name">{r.name}</td>
                    <td className="mono col-secondary">{r.classrooms}</td>
                    <td className="mono">{r.active_students}</td>
                    <td className="mono">{r.meals_today}</td>
                    <td className="col-secondary">
                      {/* Undefined when nothing is published/expected today —
                          shown as "—", never a divide-by-zero or a >100% ratio. */}
                      {/* The exact ratio. The old 80%/60% colour bands were an
                          invented judgement about what counts as "good". */}
                      <span className="pill na">{rate === null ? '—' : `${rate}%`}</span>
                    </td>
                    <td>
                      {/* Four exact states, no threshold. A day with nothing
                          published is COMPLETE at 0 of 0, not a failure. */}
                      <span>
                        <StatusDot color={COMPLETION_DOT[completionState(r)]} />
                        {COMPLETION_LABEL[completionState(r)]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {role === 'super_admin' && meals.length > 0 && (
        <Card
          title="Meals needing attention"
          hint="lowest average consumption first — derived from Classroom Meal Records"
          actions={
            <Link to="/analytics" className="btn ghost">
              Full analytics →
            </Link>
          }
        >
          <table className="dash-table">
            <thead>
              <tr>
                <th>Meal</th>
                <th className="col-secondary">Period</th>
                <th>Avg. consumption</th>
                <th className="col-secondary">Refusals</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {meals.slice(0, 8).map((m) => {
                const c = classifyMealPerformance();
                return (
                  <tr key={m.menu_item_id}>
                    <td className="cell-name">{m.dish_name}</td>
                    <td className="cell-sub col-secondary">{m.period}</td>
                    <td className="mono">
                      {m.avg_consumption_pct !== null ? `${m.avg_consumption_pct}%` : '—'}
                    </td>
                    <td className="mono col-secondary">{m.refusal_count}</td>
                    <td>
                      <Pill variant={c.variant}>{c.label}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Today's attention" hint="only what today's records actually say">
        <div style={{ padding: '4px 18px' }}>
          {needsAttention.length === 0 ? (
            <div className="center-box">
              Nothing outstanding — every institution with meals scheduled today has started
              recording.
            </div>
          ) : (
            needsAttention.map((r) => (
              <Banner key={r.institution_id} kind="warn">
                <b>{r.name}</b> — {r.expected_today} applicable records expected today, none
                recorded yet.
              </Banner>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
