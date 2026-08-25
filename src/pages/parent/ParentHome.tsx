import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParentData } from './context';
import { Avatar, Card, Pill } from '../../components/ui';
import { Icon } from '../../components/icons';
import { formatOperationalDate, initials, operationalHour, todayISO } from '../../lib/format';
import {
  BEHAVIOR_LABEL,
  meanConsumption,
  LOW_INTAKE_REASON_LABEL,
  consumptionHumanLabel,
  isNonPreferenceReason,
  isValidPreferenceObservation,
} from '../../lib/mealAnalytics';
import {
  PERIOD_ICON,
  PERIOD_LABEL,
  PERIOD_ORDER,
  mealsForDate,
  recordsForDate,
  timeOf,
  toneFor,
  entitlementForDay,
} from './shared';

/**
 * Parent Home (blueprint Parts 72-75). Everything here is derived from the
 * same Classroom Meal Records the nurse recorded once — nothing on this screen
 * is entered or maintained for parents separately.
 */
export default function ParentHome() {
  const { child, photoUrl, records, notes, meals } = useParentData();
  const today = todayISO();
  const byPeriod = recordsForDate(records, today);
  const todayMeals = mealsForDate(meals, today);

  // WHAT THIS CHILD RECEIVES — not what the site serves.
  //
  // The denominator was the institution's applicable periods (those with a
  // published meal). That was right when every child on a site received every
  // sitting. With Meal Plans it would show a morning-only child a Lunch card
  // and then count it as not-yet-recorded — telling their parent their child
  // missed a meal they were never due.
  //
  // Until the entitlement resolves, fall back to the published sittings so the
  // screen does not flash empty; `entitled === null` means "not known yet".
  const [entitled, setEntitled] = useState<Record<
    string,
    { mealName: string | null; specialRef: string | null }
  > | null>(null);

  useEffect(() => {
    let active = true;
    if (!child) return;
    void entitlementForDay(child.id, meals, today).then((e) => {
      if (active) setEntitled(e);
    });
    return () => {
      active = false;
    };
  }, [child, meals, today]);

  const applicable = PERIOD_ORDER.filter((p) =>
    entitled === null ? todayMeals[p] : entitled[p] !== undefined,
  );
  const denom = applicable.length;
  const completed = applicable.filter((p) => byPeriod[p]).length;

  // §29: previous days with any record or published meal, newest first.
  const pastDays = [
    ...new Set([...records.map((r) => r.serving_date), ...meals.map((m) => m.service_date)]),
  ]
    .filter((d) => d < today)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 14);

  // Overall intake counts only valid, served observations — an upcoming meal
  // or an absence must never be averaged in as a zero (Part 73).
  const valid = applicable
    .map((p) => byPeriod[p])
    .filter((r): r is NonNullable<typeof r> => !!r && isValidPreferenceObservation(r));
  // Only SCORED observations are averaged: an upcoming or unscored meal is
  // "not recorded", never 0%.
  const overall = meanConsumption(valid);

  const greeting = (() => {
    // Greet by the nursery's clock, not the device's.
    const h = operationalHour();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div>
      <div className="parent-hero">
        <div>
          <div className="parent-greeting">{greeting},</div>
          <h2 className="parent-child-name">{child.given_name}'s day</h2>
          <div className="parent-date">{formatOperationalDate(new Date())}</div>
        </div>
        <Avatar photoUrl={photoUrl} initials={initials(child.given_name)} size="md" />
      </div>

      <Card>
        <div className="parent-progress">
          <div>
            <div className="cell-sub">Meals completed today</div>
            <div className="parent-progress-value">
              {completed} <span>of {denom || '—'}</span>
            </div>
          </div>
          <div className="parent-ring">
            <div className="parent-ring-value">{overall !== null ? `${overall}%` : '—'}</div>
            <div className="cell-sub">
              {overall !== null ? 'overall intake' : 'not recorded yet'}
            </div>
          </div>
        </div>
        <div className="parent-bar">
          <div
            className="parent-bar-fill"
            style={{ width: `${denom ? (completed / denom) * 100 : 0}%` }}
          />
        </div>
      </Card>

      <h3 className="parent-section">Today's meals</h3>
      <div className="today-meal-list">
        {(applicable.length ? applicable : PERIOD_ORDER.filter((p) => byPeriod[p])).map(
          (period) => {
            const rec = byPeriod[period];
            const item = todayMeals[period];
            const tone = toneFor(rec);
            const note = rec ? notes[rec.id] : undefined;
            return (
              <div className={`today-meal-card ${tone}`} key={period}>
                <span className="tmc-icon">
                  <Icon name={PERIOD_ICON[period]} size={16} />
                </span>
                <div className="tmc-body">
                  <div className="tmc-period">
                    {PERIOD_LABEL[period]}
                    {rec && <span className="tmc-time"> {timeOf(rec.created_at)}</span>}
                  </div>
                  <div className="tmc-meta">{item?.dish_name ?? 'Not published'}</div>
                  {/* §3: the approved structured result the nurse recorded once —
                    how they ate, plus a parent-safe reason when intake was low.
                    These are controlled fields (not free text), so they are
                    shown directly from the same record; only free-text notes
                    require review before a parent sees them. */}
                  {/* §3/§6: an eating outcome (behaviour, and a preference reason
                    when intake was low). Absent / Unwell / Asleep are NOT eating
                    outcomes — they surface as the status pill instead, so a
                    parent never reads "Ate independently · Absent". */}
                  {rec &&
                    rec.served_status === 'served' &&
                    (rec.behavior ||
                      (rec.low_intake_reason && !isNonPreferenceReason(rec.low_intake_reason))) && (
                      <div className="tmc-meta tmc-result">
                        {rec.behavior && BEHAVIOR_LABEL[rec.behavior]}
                        {rec.behavior &&
                          rec.low_intake_reason &&
                          !isNonPreferenceReason(rec.low_intake_reason) &&
                          ' · '}
                        {rec.low_intake_reason &&
                          !isNonPreferenceReason(rec.low_intake_reason) &&
                          LOW_INTAKE_REASON_LABEL[rec.low_intake_reason]}
                      </div>
                    )}
                  {note && <div className="tmc-note">“{note.body}”</div>}
                </div>
                {rec ? (
                  <Pill
                    variant={
                      rec.served_status === 'not_served' ||
                      isNonPreferenceReason(rec.low_intake_reason)
                        ? 'slate'
                        : tone === 'ok'
                          ? 'free'
                          : tone === 'warn'
                            ? 'reduced'
                            : 'red'
                    }
                  >
                    {rec.served_status === 'not_served'
                      ? 'Not served'
                      : isNonPreferenceReason(rec.low_intake_reason)
                        ? LOW_INTAKE_REASON_LABEL[rec.low_intake_reason!]
                        : consumptionHumanLabel(rec.consumption_pct)}
                  </Pill>
                ) : (
                  <Pill variant="slate">Upcoming</Pill>
                )}
              </div>
            );
          },
        )}
      </div>

      {pastDays.length > 0 && (
        <>
          <h3 className="parent-section">Recent days</h3>
          <div className="history-list">
            {pastDays.map((day) => {
              const dayRecs = recordsForDate(records, day);
              const dayMeals = mealsForDate(meals, day);
              const periods = PERIOD_ORDER.filter((p) => dayMeals[p] || dayRecs[p]);
              return (
                <Card key={day}>
                  <div className="history-day">
                    {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                  {periods.map((p) => {
                    const rec = dayRecs[p];
                    return (
                      <div className="history-row" key={p}>
                        <span className="tmc-meta">{PERIOD_LABEL[p]}</span>
                        <span>{dayMeals[p]?.dish_name ?? '—'}</span>
                        <Pill
                          variant={
                            rec && isNonPreferenceReason(rec.low_intake_reason)
                              ? 'slate'
                              : toneFor(rec) === 'ok'
                                ? 'free'
                                : rec
                                  ? 'reduced'
                                  : 'slate'
                          }
                        >
                          {rec
                            ? rec.served_status === 'not_served'
                              ? 'Not served'
                              : isNonPreferenceReason(rec.low_intake_reason)
                                ? LOW_INTAKE_REASON_LABEL[rec.low_intake_reason!]
                                : consumptionHumanLabel(rec.consumption_pct)
                            : '—'}
                        </Pill>
                      </div>
                    );
                  })}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <h3 className="parent-section">Quick links</h3>
      <div className="quick-links">
        <Link to="/parent/menu" className="quick-link">
          <Icon name="utensils" size={18} />
          <div>
            <b>Upcoming menu</b>
            <span>See what's coming up</span>
          </div>
          <Icon name="arrowRight" size={15} />
        </Link>
        <Link to="/parent/insights" className="quick-link">
          <Icon name="barChart" size={18} />
          <div>
            <b>Insights</b>
            <span>View eating trends</span>
          </div>
          <Icon name="arrowRight" size={15} />
        </Link>
        <Link to="/parent/profile" className="quick-link">
          <Icon name="user" size={18} />
          <div>
            <b>Profile</b>
            <span>{child.given_name}'s details and safety notes</span>
          </div>
          <Icon name="arrowRight" size={15} />
        </Link>
      </div>
    </div>
  );
}
