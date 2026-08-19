import { useEffect, useState } from 'react';
import { mealsForDates, productionDemand } from '../lib/api';
import type { AppPeriod, ProductionDemandRow } from '../lib/types';
import type { DayMeal } from '../lib/api';
import { Banner, Card, EmptyState, PageHead, Pill, Spinner, StatCard } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { isoWeekday, todayISO } from '../lib/format';

const PERIODS: Array<{ period: AppPeriod; label: string; icon: IconName }> = [
  { period: 'breakfast', label: 'Breakfast', icon: 'sunrise' },
  { period: 'snack', label: 'Morning snack', icon: 'apple' },
  { period: 'lunch', label: 'Lunch', icon: 'utensils' },
  { period: 'afternoon_snack', label: 'Afternoon snack', icon: 'cookie' },
];

/**
 * Kitchen production demand (docs/02 §31-35, AT-060/061/062, AT-034).
 * Demand is DERIVED from eligible records — counts only, no student identity.
 * Exact production formula and preparation states remain NOT_YET_DEFINED.
 */
export default function KitchenPage() {
  const [rows, setRows] = useState<ProductionDemandRow[] | null>(null);
  const [todayMeals, setTodayMeals] = useState<DayMeal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const weekday = isoWeekday(now);
  const isWeekend = weekday > 4;

  useEffect(() => {
    let active = true;
    void (async () => {
      // Today's DATED services, scoped by RLS to the institutions this
      // kitchen serves. Previously this asked for a global ISO-week number
      // and filtered by weekday, which returned the same template every week
      // for seven weeks running and could not honour a closure or an
      // override. These are the same published rows Parents read — the
      // Kitchen is not given a separate copy to maintain (blueprint Part 23).
      const today = todayISO();
      const [demand, meals] = await Promise.all([productionDemand(), mealsForDates(today, today)]);
      if (!active) return;
      if (demand.error || meals.error) setError(demand.error ?? meals.error);
      setRows(demand.data ?? []);
      setTodayMeals(meals.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const totalEligible = rows?.reduce((sum, r) => sum + r.eligible_students, 0) ?? 0;
  const totalAllergy = rows?.reduce((sum, r) => sum + r.allergy_flagged, 0) ?? 0;
  const kitchenName = rows?.find((r) => r.kitchen_name)?.kitchen_name ?? null;

  return (
    <div>
      <PageHead
        title="Kitchen production"
        hint={kitchenName ? `derived demand for ${kitchenName}` : 'derived demand — counts only'}
      />
      <Banner kind="info">
        Demand is derived from authoritative eligible records (operational status{' '}
        <b>ACTIVE_BILLABLE_TO_NURSERY</b>). Kitchen staff cannot change eligibility, cannot invent
        counts, and never see student identity (AT-034).
      </Banner>
      <Banner kind="info">
        Responsible Kitchen: <b>{kitchenName ?? '—'}</b>. Kitchen is a LunchBox Connect operational
        entity, not owned by any institution — this is the current active Kitchen (MVP), not
        permanently hard-coded (docs/13 Decision 031).
      </Banner>
      <Banner kind="warn">
        The <b>eligible children</b> column is exactly that — the authoritative count of children
        eligible for service. It is deliberately not labelled "portions": the production formula
        (per-period package sizing, wastage allowance, dietary substitutions) is{' '}
        <b>NOT_YET_DEFINED</b>, so this screen shows the inputs a human needs and stops short of
        inventing the calculation. Packing and dispatch-readiness states are <b>BLOCKED_BY_SPEC</b>{' '}
        for the same reason — the delivery state machine has no approved values yet.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="stat-grid">
        <StatCard
          icon="users"
          label="Eligible children"
          value={totalEligible}
          trend="across visible institutions"
        />
        <StatCard
          icon="alertTriangle"
          label="Allergy-flagged"
          value={totalAllergy}
          trend="require safe-handling awareness"
        />
        <StatCard
          icon="utensils"
          label="Meals scheduled today"
          value={isWeekend ? '—' : todayMeals.length}
          trend={isWeekend ? 'no service at the weekend' : 'published for today'}
        />
      </div>

      <Card
        title="Today's production"
        hint={now.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      >
        {isWeekend ? (
          <EmptyState text="No meal service is scheduled at the weekend." />
        ) : !rows ? (
          <Spinner />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Scheduled meal</th>
                <th className="col-secondary">Allergens</th>
                <th>Eligible children</th>
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => {
                const item = todayMeals.find((m) => m.period === p.period);
                return (
                  <tr key={p.period}>
                    <td className="cell-name">
                      <span className="period-cell">
                        <Icon name={p.icon} size={15} /> {p.label}
                      </span>
                    </td>
                    <td>
                      {item ? (
                        item.dish_name
                      ) : (
                        <span className="cell-sub">No published meal for this period</span>
                      )}
                      {item?.portion ? <span className="cell-sub"> · {item.portion}</span> : null}
                    </td>
                    <td className="col-secondary">
                      {item && Array.isArray(item.allergens) && item.allergens.length > 0 ? (
                        <Pill variant="reduced">{item.allergens.map(String).join(', ')}</Pill>
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                    </td>
                    <td className="mono">{item ? totalEligible : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Demand by institution">
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState text="No eligible students yet in your scope." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Eligible students</th>
                <th>Allergy-flagged</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.institution_id}>
                  <td className="cell-name">{r.institution_name}</td>
                  <td className="mono">{r.eligible_students}</td>
                  <td className="mono">{r.allergy_flagged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
