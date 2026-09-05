import { useMemo, useState } from 'react';
import { useParentData } from './context';
import { Banner, Card, EmptyState, StatCard } from '../../components/ui';
import { BarChart, DonutChart, TrendChart } from '../../components/charts';
import {
  LOW_INTAKE_REASON_LABEL,
  aggregateObservations,
  groupPreferencesByMeal,
  isValidPreferenceObservation,
  meanConsumption,
} from '../../lib/mealAnalytics';
import { operationalDaysAgoISO } from '../../lib/format';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

// Inclusive range: `days` calendar days ending today (operational/Asia/Dubai).
function daysAgoISO(days: number): string {
  return operationalDaysAgoISO(days - 1);
}

/**
 * The app's real five-point intake scale, in the order a donut should read.
 * These are the exact values the Classroom records against — this screen does
 * not re-bucket them into friendlier-sounding ranges, because the bands a
 * parent is shown should be the bands a nurse actually recorded.
 */
const BANDS = [
  { pct: 100, label: 'Ate all', color: '#16a34a' },
  { pct: 75, label: 'Ate most', color: '#65a30d' },
  { pct: 50, label: 'Ate half', color: '#facc15' },
  { pct: 25, label: 'Ate a little', color: '#fb923c' },
  { pct: 0, label: 'Did not eat', color: '#dc2626' },
];

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
      const key = operationalDaysAgoISO(i);
      const valid = (byDay.get(key) ?? []).filter((r) => isValidPreferenceObservation(r));
      out.push({
        label: i % Math.max(1, Math.round(days / 5)) === 0 ? key.slice(5) : '',
        value: valid.length > 0 ? meanConsumption(valid) : null,
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

  // The approved Parent set includes BOTH the meals accepted best and those
  // accepted least. groupPreferencesByMeal returns them ordered by average
  // intake, so the two ends of the same factual list are shown — no score, no
  // ranking judgement, and never a comparison against another child.
  const DISPLAY_LIMIT = 5;
  const higherAccepted = useMemo(() => topMeals.slice(0, DISPLAY_LIMIT), [topMeals]);
  const lowerAccepted = useMemo(() => {
    // Only the meals not already shown above, so a short list is never printed
    // twice under two different headings.
    const remaining = topMeals.slice(higherAccepted.length);
    return [...remaining].reverse().slice(0, DISPLAY_LIMIT);
  }, [topMeals, higherAccepted]);

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

  // "Eaten well" is the top two bands of the same scale shown in the donut —
  // stated as a fraction of the meals that were actually counted, so it can
  // never read as a score out of something larger than the evidence.
  const ateWell = (stats.distribution[100] ?? 0) + (stats.distribution[75] ?? 0);

  return (
    <div>
      <div className="parent-head">
        <h2>{child.given_name}'s insights</h2>
        <p>Last {days} days</p>
        {scoped.length > 0 && (
          <div className="parent-head-stats">
            <div>
              <b>{stats.avgConsumption !== null ? `${stats.avgConsumption}%` : '—'}</b>
              <span>Average intake</span>
            </div>
            <div>
              <b>
                {ateWell}
                <i>/{stats.valid}</i>
              </b>
              <span>Eaten well</span>
            </div>
            <div>
              <b>{stats.lowIntake}</b>
              <span>Low intake</span>
            </div>
            <div>
              <b>{stats.encouraged}</b>
              <span>Encouraged</span>
            </div>
          </div>
        )}
      </div>

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
          {/* Average intake, low intake and encouragement now live in the
              header strip above. Only the two figures that are NOT up there
              are repeated as cards — showing the same number twice on one
              screen makes a reader hunt for the difference between them. */}
          <div className="stat-grid">
            <StatCard
              icon="clipboardList"
              label="Meals recorded"
              value={stats.total}
              trend={`over ${days} days`}
            />
            <StatCard
              icon="xCircle"
              label="Refused"
              value={stats.refusals}
              trend={
                stats.refusalRate !== null ? `${stats.refusalRate}% of counted meals` : 'meals'
              }
            />
          </div>

          <Card title="Intake trend" hint="average per day">
            <div style={{ padding: 16 }}>
              <TrendChart points={trend} />
            </div>
          </Card>

          <Card title="How much was eaten" hint="meals in each band">
            <div className="intake-overview">
              <DonutChart
                segments={BANDS.map((b) => ({
                  label: b.label,
                  value: stats.distribution[b.pct] ?? 0,
                  color: b.color,
                }))}
                centreValue={stats.avgConsumption !== null ? `${stats.avgConsumption}%` : '—'}
                centreLabel="average intake"
              />
              <ul className="donut-legend">
                {BANDS.map((b) => (
                  <li key={b.pct}>
                    <i style={{ background: b.color }} />
                    <span>{b.label}</span>
                    <b>{stats.distribution[b.pct] ?? 0}</b>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {higherAccepted.length > 0 && (
            <Card title="Meals eaten best" hint="average intake per meal">
              <ul className="meal-rank">
                {higherAccepted.map((m) => (
                  <li key={m.label}>
                    <div>
                      <b>{m.label}</b>
                      <span>{m.hint}</span>
                    </div>
                    <span className="meal-rank-ring" style={{ ['--pct' as string]: m.value }}>
                      {m.value}%
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {lowerAccepted.length > 0 && (
            <Card title="Meals eaten least" hint="average intake per meal">
              <div style={{ padding: 16 }}>
                <BarChart data={lowerAccepted} max={100} valueSuffix="%" />
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
