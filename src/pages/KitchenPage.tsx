import { useEffect, useMemo, useState } from 'react';
import { mealProductionDemand, type MealDemandRow } from '../lib/api';
import { groupDemandByRevision } from '../lib/kitchen';
import type { AppPeriod } from '../lib/types';
import { Banner, Card, EmptyState, Field, PageHead, Pill, Spinner, StatCard } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { todayISO } from '../lib/format';

const PERIOD_META: Record<AppPeriod, { label: string; icon: IconName }> = {
  breakfast: { label: 'Breakfast', icon: 'sunrise' },
  snack: { label: 'Morning snack', icon: 'apple' },
  lunch: { label: 'Lunch', icon: 'utensils' },
  afternoon_snack: { label: 'Afternoon snack', icon: 'cookie' },
};

/**
 * Kitchen production demand (§33/§34/§35/§56). Demand is per PUBLISHED MEAL:
 * the kitchen sees how many of each actual meal to make. Whether a date is a
 * service day is decided entirely by what is published for it — no weekend
 * rule. Counts only, never student identity.
 */
export default function KitchenPage() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<MealDemandRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRows(null);
    void mealProductionDemand(date).then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [date]);

  // Aggregate by the exact MEAL REVISION being produced (§34). Two recipes/
  // revisions that share a display name are separate production lines — same
  // name does not mean same recipe. A revision made at several sites for the
  // same period is one line with the summed headcount.
  const byMeal = useMemo(() => groupDemandByRevision(rows ?? []), [rows]);

  const totalPortions = byMeal.reduce((s, m) => s + m.total, 0);
  const totalSafetyNotes = byMeal.reduce((s, m) => s + m.safetyNotes, 0);
  const isServiceDay = (rows?.length ?? 0) > 0;

  return (
    <div>
      <PageHead title="Kitchen production" hint="what to make, per meal, for a chosen day" />

      <Banner kind="info">
        Demand is derived from authoritative eligible records (operational status{' '}
        <b>ACTIVE_BILLABLE_TO_NURSERY</b>) against the <b>published</b> schedule. Kitchen staff never
        see student identity — counts only (§56). Whether a day has service is decided by what is
        published for it, not by the day of the week (§35). Packing / dispatch / delivery states
        remain <b>BLOCKED_BY_SPEC</b> until the spec defines them.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="toolbar">
        <Field label="Production date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <div className="stat-grid">
        <StatCard icon="utensils" label="Distinct meals" value={byMeal.length} trend="to prepare" />
        <StatCard
          icon="users"
          label="Total eligible servings"
          value={totalPortions}
          trend="summed across meals"
        />
        <StatCard
          icon="alertTriangle"
          label="Safety notes (interim)"
          value={totalSafetyNotes}
          trend="students with any interim note — not an allergy record"
        />
      </div>

      <Card title="Make list" hint="one line per meal — quantities are eligible headcount">
        {!rows ? (
          <Spinner />
        ) : !isServiceDay ? (
          <EmptyState text="Nothing is published for this date — no production scheduled." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Meal</th>
                <th>Make (eligible)</th>
                <th className="col-secondary">Safety notes</th>
                <th className="col-secondary">Sites</th>
              </tr>
            </thead>
            <tbody>
              {byMeal.map((m) => (
                <tr key={`${m.period}-${m.meal_revision_id}`}>
                  <td className="cell-name">
                    <span className="period-cell">
                      <Icon name={PERIOD_META[m.period].icon} size={15} />{' '}
                      {PERIOD_META[m.period].label}
                    </span>
                  </td>
                  <td>{m.meal_name}</td>
                  <td className="mono">
                    <b>{m.total}</b>
                  </td>
                  <td className="col-secondary">
                    {m.safetyNotes > 0 ? (
                      <Pill variant="reduced">{m.safetyNotes}</Pill>
                    ) : (
                      <span className="cell-sub">—</span>
                    )}
                  </td>
                  <td className="col-secondary cell-sub">
                    {m.sites.map((s) => `${s.institution_name} (${s.eligible_students})`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
