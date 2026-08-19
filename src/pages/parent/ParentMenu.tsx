import { useParentData } from './context';
import { Banner, Card, EmptyState, Pill } from '../../components/ui';
import { Icon } from '../../components/icons';
import { weekStartISO } from '../../lib/format';
import { PERIOD_ICON, PERIOD_LABEL, PERIOD_ORDER } from './shared';

/**
 * Upcoming menu (blueprint Part 78). These are the same published menu rows
 * the admin manages and the kitchen produces from — there is no parent-specific
 * menu upload anywhere in the system.
 */
export default function ParentMenu() {
  const { meals } = useParentData();

  // Group by the real service date. The previous version iterated weekday
  // names and matched template rows, so every Wednesday rendered identically
  // and a closure or a one-off override was invisible. Dates that have no
  // published service simply do not appear — a day with no meal must never be
  // rendered as an empty meal.
  // The shell fetches a wider range for Insights; this screen shows the
  // current week only.
  const from = weekStartISO();
  const dates = [...new Set(meals.filter((m) => m.service_date >= from).map((m) => m.service_date))].sort();

  return (
    <div>
      <h2 className="parent-title">This week's menu</h2>

      {dates.length === 0 ? (
        <EmptyState text="The menu for this week has not been published yet." />
      ) : (
        dates.map((date) => {
          const dayItems = meals.filter((m) => m.service_date === date);
          if (dayItems.length === 0) return null;
          const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          });
          return (
            <Card key={date} title={label}>
              <div className="menu-day-list">
                {PERIOD_ORDER.map((period) => {
                  const item = dayItems.find((m) => m.period === period);
                  if (!item) return null;
                  const allergens = Array.isArray(item.allergens) ? item.allergens.map(String) : [];
                  const ingredients = Array.isArray(item.ingredients)
                    ? item.ingredients.map(String)
                    : [];
                  return (
                    <div className="menu-line" key={period}>
                      <span className="tmc-icon">
                        <Icon name={PERIOD_ICON[period]} size={16} />
                      </span>
                      <div className="tmc-body">
                        <div className="tmc-period">{PERIOD_LABEL[period]}</div>
                        <div className="menu-dish">{item.dish_name}</div>
                        {ingredients.length > 0 && (
                          <div className="tmc-meta menu-ingredients">{ingredients.join(', ')}</div>
                        )}
                        {item.portion && <div className="tmc-meta">Portion: {item.portion}</div>}
                        {allergens.length > 0 && (
                          <div className="menu-allergen-row">
                            {allergens.map((a) => (
                              <Pill key={a} variant="reduced">
                                {a}
                              </Pill>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}

      <Banner kind="info">
        Allergen information shown here comes from the authoritative meal record. If your child has
        an allergy that isn't reflected on their profile, contact your nursery — it cannot be
        changed from this app.
      </Banner>
    </div>
  );
}
