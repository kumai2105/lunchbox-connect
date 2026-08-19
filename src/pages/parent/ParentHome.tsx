import { Link } from 'react-router-dom';
import { useParentData } from './context';
import { Avatar, Card, Pill } from '../../components/ui';
import { Icon } from '../../components/icons';
import { initials, todayISO } from '../../lib/format';
import { consumptionHumanLabel, isValidPreferenceObservation } from '../../lib/mealAnalytics';
import {
  PERIOD_ICON,
  PERIOD_LABEL,
  PERIOD_ORDER,
  mealsForDate,
  recordsForDate,
  timeOf,
  toneFor,
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

  const completed = PERIOD_ORDER.filter((p) => byPeriod[p]).length;

  // Overall intake counts only valid, served observations — an upcoming meal
  // or an absence must never be averaged in as a zero (Part 73).
  const valid = PERIOD_ORDER.map((p) => byPeriod[p]).filter(
    (r): r is NonNullable<typeof r> => !!r && isValidPreferenceObservation(r),
  );
  const overall =
    valid.length > 0
      ? Math.round(valid.reduce((s, r) => s + (r.consumption_pct ?? 0), 0) / valid.length)
      : null;

  const greeting = (() => {
    const h = new Date().getHours();
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
          <div className="parent-date">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
        </div>
        <Avatar photoUrl={photoUrl} initials={initials(child.given_name)} size="md" />
      </div>

      <Card>
        <div className="parent-progress">
          <div>
            <div className="cell-sub">Meals completed today</div>
            <div className="parent-progress-value">
              {completed} <span>of {PERIOD_ORDER.length}</span>
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
            style={{ width: `${(completed / PERIOD_ORDER.length) * 100}%` }}
          />
        </div>
      </Card>

      <h3 className="parent-section">Today's meals</h3>
      <div className="today-meal-list">
        {PERIOD_ORDER.map((period) => {
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
                {note && <div className="tmc-note">“{note.body}”</div>}
              </div>
              {rec ? (
                <Pill
                  variant={
                    rec.served_status === 'not_served'
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
                    : consumptionHumanLabel(rec.consumption_pct)}
                </Pill>
              ) : (
                <Pill variant="slate">Upcoming</Pill>
              )}
            </div>
          );
        })}
      </div>

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
            <span>{child.given_name}'s details and allergies</span>
          </div>
          <Icon name="arrowRight" size={15} />
        </Link>
      </div>
    </div>
  );
}
