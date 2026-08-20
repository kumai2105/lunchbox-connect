import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardSummary, mealPerformance, productionDemand } from '../lib/api';
import type {
  DashboardInstitutionRow,
  MealPerformanceRow,
  ProductionDemandRow,
} from '../lib/types';
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
import { can } from '../lib/rbac';
import { classifyMealPerformance } from '../lib/mealAnalytics';

export default function DashboardPage() {
  const role = useRole();
  const [rows, setRows] = useState<DashboardInstitutionRow[] | null>(null);
  const [demand, setDemand] = useState<ProductionDemandRow[]>([]);
  const [meals, setMeals] = useState<MealPerformanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [d, p] = await Promise.all([dashboardSummary(), productionDemand()]);
      if (!active) return;
      if (d.error || p.error) setError(d.error ?? p.error);
      setRows(d.data ?? []);
      setDemand(p.data ?? []);
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

  const activeStudents = rows.reduce((sum, r) => sum + r.active_students, 0);
  const mealsToday = rows.reduce((sum, r) => sum + r.meals_today, 0);
  const eligibleStudents = demand.reduce((sum, r) => sum + r.eligible_students, 0);
  const silentInstitutions = rows.filter((r) => r.active_students > 0 && r.meals_today === 0);

  // Weighted across every recorded meal so one low-volume dish can't skew the
  // headline number the way a plain average of averages would.
  const totalValidObs = meals.reduce((sum, m) => sum + m.valid_observations, 0);
  const avgConsumption =
    totalValidObs > 0
      ? Math.round(
          meals
            .filter((m) => m.avg_consumption_pct !== null)
            .reduce((sum, m) => sum + (m.avg_consumption_pct as number) * m.valid_observations, 0) /
            totalValidObs,
        )
      : null;
  const totalRefusals = meals.reduce((sum, m) => sum + m.refusal_count, 0);
  const refusalRate =
    totalValidObs > 0 ? Math.round((totalRefusals / totalValidObs) * 1000) / 10 : null;

  return (
    <div>
      <PageHead title="Dashboard" hint="live boundary summary" />

      {error && <Banner kind="err">{error}</Banner>}

      {/* Every destination below is gated by the SAME can() matrix the target
          route enforces: a Nursery Admin is denied /institutions and /status,
          so those tiles must not be presented as links to them. Where no
          approved destination exists for the role, the metric still shows —
          only the navigation is withheld (no replacement route is invented). */}
      <div className="stat-grid">
        <StatCard
          icon="building"
          label="Institutions"
          value={rows.length}
          trend="across the chain"
          to={can(role, 'institutions', 'view') ? '/institutions' : undefined}
        />
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
          trend="ACTIVE_BILLABLE_TO_NURSERY"
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
        title="Institutions — serving today"
        hint="read model · RLS-scoped"
        actions={
          can(role, 'institutions', 'view') ? (
            <Link to="/institutions" className="btn ghost">
              Manage →
            </Link>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState text="No institutions yet — a SUPER_ADMIN can add the first one." />
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
                      <span className={rate === null ? 'pill na' : mealsTodayPill(rate)}>
                        {rate === null ? '—' : `${rate}%`}
                      </span>
                    </td>
                    <td>
                      {r.active_students > 0 && r.meals_today === 0 ? (
                        <span>
                          <StatusDot color="amber" />
                          No outcomes recorded yet
                        </span>
                      ) : (
                        <span>
                          <StatusDot color={r.meals_today > 0 ? 'green' : 'gray'} />
                          {r.meals_today > 0 ? 'Serving' : 'Empty roster'}
                        </span>
                      )}
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

      <Card title="Today's attention" hint="derived — nothing invented">
        <div style={{ padding: '4px 18px' }}>
          {silentInstitutions.length === 0 ? (
            <div className="center-box">No silent institutions today.</div>
          ) : (
            silentInstitutions.map((r) => (
              <Banner key={r.institution_id} kind="warn">
                <b>{r.name}</b> — {r.active_students} active students, 0 meal outcomes recorded
                today.
              </Banner>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function mealsTodayPill(rate: number): string {
  if (rate >= 80) return 'pill free';
  if (rate >= 60) return 'pill reduced';
  return 'pill red';
}
