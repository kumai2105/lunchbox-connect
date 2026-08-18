import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardSummary, productionDemand } from '../lib/api';
import type { DashboardInstitutionRow, ProductionDemandRow } from '../lib/types';
import { Banner, Card, EmptyState, PageHead, Spinner, StatCard, StatusDot } from '../components/ui';

export default function DashboardPage() {
  const [rows, setRows] = useState<DashboardInstitutionRow[] | null>(null);
  const [demand, setDemand] = useState<ProductionDemandRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [d, p] = await Promise.all([dashboardSummary(), productionDemand()]);
      if (!active) return;
      if (d.error || p.error) setError(d.error ?? p.error);
      setRows(d.data ?? []);
      setDemand(p.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (error && !rows) return <EmptyState text={`Could not load the dashboard: ${error}`} />;
  if (!rows) return <Spinner />;

  const activeStudents = rows.reduce((sum, r) => sum + r.active_students, 0);
  const mealsToday = rows.reduce((sum, r) => sum + r.meals_today, 0);
  const eligibleStudents = demand.reduce((sum, r) => sum + r.eligible_students, 0);
  const silentInstitutions = rows.filter((r) => r.active_students > 0 && r.meals_today === 0);

  return (
    <div>
      <PageHead title="Dashboard" hint="live boundary summary" />

      {error && <Banner kind="err">{error}</Banner>}

      <div className="stat-grid">
        <StatCard label="🏛 Institutions" value={rows.length} trend="across the chain" />
        <StatCard
          label="👪 Active students"
          value={activeStudents.toLocaleString()}
          trend="enrolled"
        />
        <StatCard
          label="✓ Operationally eligible"
          value={eligibleStudents}
          trend="ACTIVE_BILLABLE_TO_NURSERY"
        />
        <StatCard
          label="🍱 Meals recorded today"
          value={mealsToday.toLocaleString()}
          trend="against the roster"
        />
      </div>

      <Card
        title="Institutions — serving today"
        hint="read model · RLS-scoped"
        actions={
          <Link to="/institutions" className="btn ghost">
            Manage →
          </Link>
        }
      >
        {rows.length === 0 ? (
          <EmptyState text="No institutions yet — a SUPER_ADMIN can add the first one." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Classrooms</th>
                <th>Active students</th>
                <th>Meals today</th>
                <th>Fill rate</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rate =
                  r.active_students > 0 ? Math.round((r.meals_today / r.active_students) * 100) : 0;
                return (
                  <tr key={r.institution_id}>
                    <td className="cell-name">{r.name}</td>
                    <td className="mono">{r.classrooms}</td>
                    <td className="mono">{r.active_students}</td>
                    <td className="mono">{r.meals_today}</td>
                    <td>
                      <span className={r.active_students === 0 ? 'pill na' : mealsTodayPill(rate)}>
                        {r.active_students > 0 ? `${rate}%` : '—'}
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
