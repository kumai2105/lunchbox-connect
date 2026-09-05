import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listClasses,
  listInstitutions,
  mealObservations,
  type ClassWithMeta,
  type ObservationRow,
} from '../lib/api';
import type { AppPeriod, Institution } from '../lib/types';
import { Banner, Card, EmptyState, PageHead, Pill, Spinner, StatCard } from '../components/ui';
import { BarChart, TrendChart, type BarDatum } from '../components/charts';
import {
  LOW_INTAKE_REASON_LABEL,
  aggregateObservations,
  classifyMealPerformance,
  isValidPreferenceObservation,
  meanConsumption,
} from '../lib/mealAnalytics';
import { operationalDaysAgoISO, todayISO } from '../lib/format';

const PERIODS: Array<{ value: AppPeriod | ''; label: string }> = [
  { value: '', label: 'All periods' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'snack', label: 'Morning snack' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'afternoon_snack', label: 'Afternoon snack' },
];

const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

// Inclusive range ending today (operational/Asia/Dubai).
function daysAgoISO(days: number): string {
  return operationalDaysAgoISO(days - 1);
}

// Enumerate calendar dates between two YYYY-MM-DD strings. Parsed as UTC so the
// enumeration is independent of the host timezone (pure date arithmetic).
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end && out.length < 120) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Meal Analytics (blueprint Parts 24-27). Every KPI, chart and table on this
 * page is computed from the raw Classroom Meal Records returned for the
 * CURRENT filter set — changing any filter refetches and recalculates all of
 * them, rather than relabelling a fixed aggregate.
 *
 * Non-preference observations (absent / unwell / sleeping / not served) are
 * excluded from every consumption and preference figure and reported
 * separately: they are not evidence a child disliked a Meal (Part 27).
 */
export default function MealAnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const rangeDays = Number(params.get('days') ?? '30');
  const institutionId = params.get('institution') ?? '';
  const classId = params.get('class') ?? '';
  const period = (params.get('period') ?? '') as AppPeriod | '';
  const focus = params.get('focus') ?? '';

  const from = daysAgoISO(rangeDays);
  const to = todayISO();

  const [rows, setRows] = useState<ObservationRow[] | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Changing the institution invalidates a class filter from another one.
    if (key === 'institution') next.delete('class');
    setParams(next, { replace: true });
  }

  useEffect(() => {
    void (async () => {
      const [i, c] = await Promise.all([listInstitutions(), listClasses()]);
      setInstitutions(i.data ?? []);
      setClasses(c.data ?? []);
    })();
  }, []);

  useEffect(() => {
    let active = true;
    setRows(null);
    void (async () => {
      const res = await mealObservations({
        from,
        to,
        institutionId: institutionId || null,
        classId: classId || null,
        period: period || null,
      });
      if (!active) return;
      setError(res.error);
      setRows(res.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [from, to, institutionId, classId, period]);

  const stats = useMemo(() => aggregateObservations(rows ?? []), [rows]);

  // Per-meal rollup, keyed by the authoritative menu item.
  const perMeal = useMemo(() => {
    const map = new Map<string, { name: string; rows: ObservationRow[] }>();
    (rows ?? []).forEach((r) => {
      if (!r.menu) return;
      const entry = map.get(r.menu.id) ?? { name: r.menu.dish_name, rows: [] };
      entry.rows.push(r);
      map.set(r.menu.id, entry);
    });
    return [...map.entries()]
      .map(([id, e]) => {
        const a = aggregateObservations(e.rows);
        return { id, name: e.name, agg: a };
      })
      .filter((m) => m.agg.valid > 0)
      .sort((x, y) => (x.agg.avgConsumption ?? 0) - (y.agg.avgConsumption ?? 0));
  }, [rows]);

  const trend = useMemo(() => {
    const byDay = new Map<string, ObservationRow[]>();
    (rows ?? []).forEach((r) => {
      const list = byDay.get(r.serving_date) ?? [];
      list.push(r);
      byDay.set(r.serving_date, list);
    });
    const days = eachDay(from, to);
    // One label every ~5 days keeps the axis readable at 30/90-day ranges.
    const labelEvery = Math.max(1, Math.round(days.length / 6));
    return days.map((d, i) => {
      const dayRows = byDay.get(d) ?? [];
      const valid = dayRows.filter((r) => isValidPreferenceObservation(r));
      return {
        label: i % labelEvery === 0 ? d.slice(5) : '',
        value: valid.length > 0 ? meanConsumption(valid) : null,
      };
    });
  }, [rows, from, to]);

  const distributionData: BarDatum[] = useMemo(() => {
    const colors: Record<number, string> = {
      100: 'var(--green)',
      75: '#4ade80',
      50: '#facc15',
      25: '#fb923c',
      0: 'var(--red)',
    };
    return [100, 75, 50, 25, 0].map((pct) => ({
      label: `${pct}%`,
      value: stats.distribution[pct] ?? 0,
      color: colors[pct],
    }));
  }, [stats]);

  const reasonData: BarDatum[] = useMemo(
    () =>
      Object.entries(stats.reasons)
        .map(([key, count]) => ({
          label: LOW_INTAKE_REASON_LABEL[key as keyof typeof LOW_INTAKE_REASON_LABEL] ?? key,
          value: count,
        }))
        .sort((a, b) => b.value - a.value),
    [stats],
  );

  const focused = focus ? perMeal.find((m) => m.id === focus) : undefined;

  return (
    <div>
      <PageHead
        title="Meal analytics"
        hint="derived from Classroom Meal Records — decision support only"
      />

      {error && <Banner kind="err">{error}</Banner>}

      <Card bodyClassName="filters">
        <select value={String(rangeDays)} onChange={(e) => setFilter('days', e.target.value)}>
          {RANGES.map((r) => (
            <option key={r.days} value={r.days}>
              {r.label}
            </option>
          ))}
        </select>
        <select value={institutionId} onChange={(e) => setFilter('institution', e.target.value)}>
          <option value="">All institutions</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select value={classId} onChange={(e) => setFilter('class', e.target.value)}>
          <option value="">All classes</option>
          {classes
            .filter((c) => !institutionId || c.institution_id === institutionId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <select value={period} onChange={(e) => setFilter('period', e.target.value)}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="cell-sub">
          {from} → {to}
        </span>
      </Card>

      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState text="No meal observations were recorded for this period and filter set." />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              icon="clipboardList"
              label="Valid observations"
              value={stats.valid}
              trend={`${stats.excluded} excluded as non-preference`}
            />
            <StatCard
              icon="checkCircle"
              label="Average consumption"
              value={stats.avgConsumption !== null ? `${stats.avgConsumption}%` : '—'}
              trend="valid population only"
            />
            <StatCard
              icon="xCircle"
              label="Refusal rate"
              value={stats.refusalRate !== null ? `${stats.refusalRate}%` : '—'}
              trend={`${stats.refusals} refusals`}
            />
            <StatCard
              icon="heart"
              label="Needed encouragement"
              value={stats.encouragementRate !== null ? `${stats.encouragementRate}%` : '—'}
              trend={`${stats.encouraged} observations`}
            />
            <StatCard
              icon="alertTriangle"
              label="Low intake (0–25%)"
              value={stats.lowIntakeRate !== null ? `${stats.lowIntakeRate}%` : '—'}
              trend={`${stats.lowIntake} observations`}
            />
          </div>

          <Banner kind="info">
            {stats.excluded} of {stats.total} observations are excluded from every consumption
            figure above: absent, unwell, sleeping and not-served children did not reject a Meal.
            They are still counted in the reason breakdown below.
          </Banner>

          <Card title="Consumption trend" hint={`average valid intake per day · ${from} → ${to}`}>
            <div style={{ padding: 18 }}>
              <TrendChart points={trend} />
            </div>
          </Card>

          <div className="chart-grid">
            <Card title="Consumption distribution" hint="valid observations">
              <div style={{ padding: 18 }}>
                <BarChart
                  data={distributionData}
                  emptyText="No valid observations to distribute."
                />
              </div>
            </Card>
            <Card title="Low-intake reasons" hint="all observations, including excluded ones">
              <div style={{ padding: 18 }}>
                <BarChart
                  data={reasonData}
                  emptyText="No low-intake reasons were recorded for this period."
                />
              </div>
            </Card>
          </div>

          <Card
            title="Meal performance"
            hint="lowest average consumption first — click a meal for its detail"
          >
            {perMeal.length === 0 ? (
              <EmptyState text="No observations in this period are linked to a menu item yet." />
            ) : (
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Meal</th>
                    <th>Valid obs.</th>
                    <th>Avg. consumption</th>
                    <th className="col-secondary">Refusal rate</th>
                    <th className="col-secondary">Didn't like it</th>
                    <th>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {perMeal.map((m) => {
                    const c = classifyMealPerformance();
                    return (
                      <tr
                        key={m.id}
                        className={`row-clickable${focus === m.id ? ' row-active' : ''}`}
                        onClick={() => setFilter('focus', focus === m.id ? '' : m.id)}
                      >
                        <td className="cell-name">{m.name}</td>
                        <td className="mono">
                          {m.agg.valid} / {m.agg.total}
                        </td>
                        <td className="mono">
                          {m.agg.avgConsumption !== null ? `${m.agg.avgConsumption}%` : '—'}
                        </td>
                        <td className="mono col-secondary">
                          {m.agg.refusalRate !== null ? `${m.agg.refusalRate}%` : '—'}
                        </td>
                        <td className="mono col-secondary">{m.agg.reasons.did_not_like_it ?? 0}</td>
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

          {focused && (
            <Card
              title={`${focused.name} — detail`}
              hint="aggregated only; no individual child is identified here"
              actions={
                <button className="btn ghost" onClick={() => setFilter('focus', '')}>
                  Close
                </button>
              }
            >
              <div style={{ padding: 18 }}>
                <div className="stat-grid" style={{ marginBottom: 18 }}>
                  <StatCard
                    icon="clipboardList"
                    label="Valid observations"
                    value={focused.agg.valid}
                    trend={`of ${focused.agg.total} total`}
                  />
                  <StatCard
                    icon="checkCircle"
                    label="Average consumption"
                    value={
                      focused.agg.avgConsumption !== null ? `${focused.agg.avgConsumption}%` : '—'
                    }
                  />
                  <StatCard
                    icon="xCircle"
                    label="Refusal rate"
                    value={focused.agg.refusalRate !== null ? `${focused.agg.refusalRate}%` : '—'}
                  />
                  <StatCard
                    icon="alertTriangle"
                    label="Didn't like it"
                    value={focused.agg.reasons.did_not_like_it ?? 0}
                    trend="explicit dislike reason"
                  />
                </div>
                <BarChart
                  data={[100, 75, 50, 25, 0].map((pct) => ({
                    label: `${pct}%`,
                    value: focused.agg.distribution[pct] ?? 0,
                  }))}
                  emptyText="No valid observations for this meal."
                />
              </div>
            </Card>
          )}

          <Banner kind="warn">
            Classification labels are decision support for a human reviewer. Nothing here removes,
            substitutes or modifies a Meal automatically.
          </Banner>

          <Link to="/menu-builder" className="btn ghost">
            Open Menu Builder
          </Link>
        </>
      )}
    </div>
  );
}
