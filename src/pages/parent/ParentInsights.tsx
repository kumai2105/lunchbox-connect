import { useMemo, useState } from 'react';
import { useParentData } from './context';
import { Banner, Card, EmptyState, StatCard } from '../../components/ui';
import { BarChart, TrendChart } from '../../components/charts';
import {
  LOW_INTAKE_REASON_LABEL,
  aggregateObservations,
  groupPreferencesByMeal,
  isValidPreferenceObservation,
} from '../../lib/mealAnalytics';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Parent Insights (blueprint Part 79). Every figure is calculated from this
 * child's own Classroom Meal Records. There is no comparison to other named
 * children, no ranking, and no health interpretation — only what was actually
 * observed, aggregated with the same validity rules management analytics uses.
 */
export default function ParentInsights() {
  const { child, records, meals } = useParentData();
  const [days, setDays] = useState(7);

  const from = daysAgoISO(days);
  const scoped = useMemo(() => records.filter((r) => r.serving_date >= from), [records, from]);
  const stats = useMemo(() => aggregateObservations(scoped), [scoped]);

  const trend = useMemo(() => {
    const byDay = new Map<string, typeof scoped>();
    scoped.forEach((r) => {
      const list = byDay.get(r.serving_date) ?? [];
      list.push(r);
      byDay.set(r.serving_date, list);
    });
    const out: Array<{ label: string; value: number | null }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const valid = (byDay.get(key) ?? []).filter((r) => isValidPreferenceObservation(r));
      out.push({
        label: i % Math.max(1, Math.round(days / 5)) === 0 ? key.slice(5) : '',
        value:
          valid.length > 0
            ? Math.round(valid.reduce((s, r) => s + (r.consumption_pct ?? 0), 0) / valid.length)
            : null,
      });
    }
    return out;
  }, [scoped, days]);

  // Which meals this child reliably eats — computed from their own records,
  // matched back to the authoritative menu item.
  const topMeals = useMemo(() => {
    // Group by STABLE meal identity (meal_id), not the dated service id or the
    // dish-name text, so the same meal aggregates into one favourite even
    // across a rename, and same-named-but-different meals never merge (§9/§30).
    const identityFor = new Map(
      meals.map((m) => [m.service_id, { id: m.meal_id, label: m.dish_name }]),
    );
    return groupPreferencesByMeal(
      scoped.filter((r) => isValidPreferenceObservation(r)),
      (id) => identityFor.get(id),
    ).map((e) => ({ label: e.label, value: e.value, hint: `${e.count} times` }));
  }, [scoped, meals]);

  const reasons = useMemo(
    () =>
      Object.entries(stats.reasons)
        .map(([k, v]) => ({
          label: LOW_INTAKE_REASON_LABEL[k as keyof typeof LOW_INTAKE_REASON_LABEL] ?? k,
          value: v,
        }))
        .sort((a, b) => b.value - a.value),
    [stats],
  );

  return (
    <div>
      <h2 className="parent-title">{child.given_name}'s insights</h2>

      <div className="range-tabs">
        {RANGES.map((r) => (
          <button
            key={r.days}
            className={`range-tab${days === r.days ? ' active' : ''}`}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {scoped.length === 0 ? (
        <EmptyState text="No meals have been recorded for this period yet." />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              icon="checkCircle"
              label="Average intake"
              value={stats.avgConsumption !== null ? `${stats.avgConsumption}%` : '—'}
              trend={`${stats.valid} meals counted`}
            />
            <StatCard
              icon="clipboardList"
              label="Meals recorded"
              value={stats.total}
              trend={`over ${days} days`}
            />
            <StatCard
              icon="heart"
              label="Needed encouragement"
              value={stats.encouraged}
              trend="meals"
            />
            <StatCard
              icon="alertTriangle"
              label="Low intake"
              value={stats.lowIntake}
              trend="meals"
            />
          </div>

          <Card title="Intake trend" hint="average per day">
            <div style={{ padding: 16 }}>
              <TrendChart points={trend} />
            </div>
          </Card>

          <Card title="How much was eaten" hint="meals in each band">
            <div style={{ padding: 16 }}>
              <BarChart
                data={[100, 75, 50, 25, 0].map((pct) => ({
                  label: `${pct}%`,
                  value: stats.distribution[pct] ?? 0,
                  color:
                    pct >= 75
                      ? 'var(--green)'
                      : pct >= 50
                        ? '#facc15'
                        : pct >= 25
                          ? '#fb923c'
                          : 'var(--red)',
                }))}
                emptyText="No completed meals to show yet."
              />
            </div>
          </Card>

          {topMeals.length > 0 && (
            <Card title="Meals eaten best" hint="average intake per meal">
              <div style={{ padding: 16 }}>
                <BarChart data={topMeals} max={100} valueSuffix="%" />
              </div>
            </Card>
          )}

          {reasons.length > 0 && (
            <Card title="When less was eaten" hint="reasons recorded by staff">
              <div style={{ padding: 16 }}>
                <BarChart data={reasons} />
              </div>
            </Card>
          )}

          {stats.excluded > 0 && (
            <Banner kind="info">
              {stats.excluded} meal{stats.excluded === 1 ? '' : 's'} in this period{' '}
              {stats.excluded === 1 ? 'was' : 'were'} not counted in the averages — your child was
              absent, unwell, asleep, or the meal wasn't served. Those aren't signs they disliked
              the food, so they're kept out of the numbers.
            </Banner>
          )}
        </>
      )}
    </div>
  );
}
