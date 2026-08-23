import { useEffect, useMemo, useState } from 'react';
import { mealsForDates, type DayMeal } from '../lib/api';
import type { AppPeriod } from '../lib/types';
import { useAuth } from '../lib/auth';
import { Banner, Card, EmptyState, PageHead, Pill, Spinner } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { formatOperationalDate, todayISO, weekEndISO, weekStartISO } from '../lib/format';

const PERIOD_META: Record<AppPeriod, { label: string; icon: IconName }> = {
  breakfast: { label: 'Breakfast', icon: 'sunrise' },
  snack: { label: 'Morning snack', icon: 'apple' },
  lunch: { label: 'Lunch', icon: 'utensils' },
  afternoon_snack: { label: 'Afternoon snack', icon: 'cookie' },
};
import { PERIOD_ORDER } from '../lib/periods';

/**
 * Institution published schedule — READ ONLY (Founder-approved addition).
 *
 * What a Nursery/School Admin can see of their own institution's menu. It is
 * not a second menu model: every row here is an existing, authoritative
 * **published `meal_services`** row for this institution, read through the same
 * RLS that serves the Kitchen and the Parent portal. Nothing is created,
 * edited, published or duplicated here.
 *
 * Consequences that fall out of reading the resolved published truth rather
 * than a template:
 *   - a Super Admin republishing a future Meal shows up here automatically;
 *   - a date Override appears as the resolved Meal for that date;
 *   - a Closure removes the date entirely — no stale Meal is left visible;
 *   - only periods actually published for THIS institution appear.
 *
 * Raw Rotation templates and draft Calendar / Service Plan configuration are
 * never exposed: those tables are closed to this role at the database boundary
 * (migration 0033), not merely hidden by this screen.
 */
export default function InstitutionSchedulePage() {
  const { profile } = useAuth();
  const institutionId = profile?.institution_id ?? null;

  const [meals, setMeals] = useState<DayMeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DayMeal | null>(null);

  const today = todayISO();
  const weekStart = weekStartISO();
  const weekEnd = weekEndISO();

  useEffect(() => {
    let active = true;
    setMeals(null);
    void (async () => {
      // A Super Admin has no single institution; this screen is the
      // institution's own view, so it needs one to scope to.
      if (!institutionId) {
        if (active) setMeals([]);
        return;
      }
      const res = await mealsForDates(weekStart, weekEnd, institutionId);
      if (!active) return;
      if (res.error) setError(res.error);
      setMeals(res.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [institutionId, weekStart, weekEnd]);

  // Only dates that actually have something published appear. A closure
  // therefore drops off the list rather than lingering with an old Meal.
  const byDate = useMemo(() => {
    const map = new Map<string, Partial<Record<AppPeriod, DayMeal>>>();
    (meals ?? []).forEach((m) => {
      const day = map.get(m.service_date) ?? {};
      day[m.period] = m;
      map.set(m.service_date, day);
    });
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [meals]);

  const todayMeals = useMemo(() => byDate.find(([d]) => d === today)?.[1] ?? {}, [byDate, today]);
  const todayPeriods = PERIOD_ORDER.filter((p) => todayMeals[p]);

  // The WEEK's columns are the periods this institution actually publishes in
  // the displayed week — not the fixed four. A three-meal nursery was being
  // given a permanently empty Afternoon snack column, which reads as a service
  // it failed to provide rather than one it never contracted for.
  const weekPeriods = useMemo(() => {
    const seen = new Set<AppPeriod>((meals ?? []).map((m) => m.period));
    return PERIOD_ORDER.filter((p) => seen.has(p));
  }, [meals]);

  if (!meals) return <Spinner />;

  return (
    <div>
      <PageHead title="Published menu" hint="what is published for your institution — read only" />

      {error && <Banner kind="err">{error}</Banner>}

      <Banner kind="info">
        This is the <b>published</b> schedule for your institution, read from the same authoritative
        record the kitchen and families see. It updates on its own when the menu is republished, and
        a closed day simply disappears. Changes are made by LunchBox Connect — this screen has no
        editing controls.
      </Banner>

      {!institutionId && (
        <Banner kind="warn">
          Your account is not anchored to an institution, so there is no schedule to show.
        </Banner>
      )}

      {/* ---- TODAY ---------------------------------------------------- */}
      <Card
        title={`Today — ${formatOperationalDate(today)}`}
        hint="the applicable meal periods for today"
      >
        {todayPeriods.length === 0 ? (
          <EmptyState text="Nothing is published for today — no meal service is scheduled." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Meal</th>
                <th className="col-secondary">Allergens</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {todayPeriods.map((p) => {
                const m = todayMeals[p]!;
                return (
                  <tr key={p}>
                    <td className="cell-name">
                      <span className="period-cell">
                        <Icon name={PERIOD_META[p].icon} size={15} /> {PERIOD_META[p].label}
                      </span>
                    </td>
                    <td>{m.dish_name}</td>
                    <td className="col-secondary">
                      {m.allergens.length === 0 ? (
                        <span className="cell-sub">—</span>
                      ) : (
                        m.allergens.map((a) => (
                          <Pill key={a} variant="reduced">
                            {a}
                          </Pill>
                        ))
                      )}
                    </td>
                    <td>
                      <button className="btn ghost sm" onClick={() => setDetail(m)}>
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* ---- THIS WEEK ------------------------------------------------- */}
      <Card
        title="This week"
        hint={`published meals, ${formatOperationalDate(weekStart, { day: 'numeric', month: 'short' })} – ${formatOperationalDate(weekEnd, { day: 'numeric', month: 'short' })}`}
      >
        {byDate.length === 0 ? (
          <EmptyState text="Nothing is published for your institution this week." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                {weekPeriods.map((p) => (
                  <th key={p}>{PERIOD_META[p].label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byDate.map(([date, periods]) => (
                <tr key={date} className={date === today ? 'row-active' : undefined}>
                  <td className="cell-name">
                    {formatOperationalDate(date, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                  {weekPeriods.map((p) => {
                    const m = periods[p];
                    return (
                      <td key={p}>
                        {m ? (
                          <button className="btn ghost sm" onClick={() => setDetail(m)}>
                            {m.dish_name}
                          </button>
                        ) : (
                          // Not published for this institution on this date —
                          // which is also how a closure reads.
                          <span className="cell-sub">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ---- approved published Meal detail ---------------------------- */}
      {detail && (
        <Card
          title={detail.dish_name}
          hint={`${PERIOD_META[detail.period].label} · ${formatOperationalDate(detail.service_date)}`}
          actions={
            <button className="btn ghost" onClick={() => setDetail(null)}>
              Close
            </button>
          }
        >
          <table>
            <tbody>
              <tr>
                <td className="cell-sub">Portion</td>
                <td>{detail.portion ?? '—'}</td>
              </tr>
              <tr>
                <td className="cell-sub">Ingredients</td>
                <td>{detail.ingredients.length ? detail.ingredients.join(', ') : '—'}</td>
              </tr>
              <tr>
                <td className="cell-sub">Allergens</td>
                <td>
                  {detail.allergens.length === 0
                    ? '—'
                    : detail.allergens.map((a) => (
                        <Pill key={a} variant="reduced">
                          {a}
                        </Pill>
                      ))}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ padding: '0 18px 18px' }}>
            <Banner kind="info">
              Allergen information is the authoritative record <b>for this meal</b> — what the
              kitchen prepares. It is not matched against any individual child.
            </Banner>
          </div>
        </Card>
      )}
    </div>
  );
}
