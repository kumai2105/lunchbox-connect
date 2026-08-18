import { useParentData } from './context';
import { Banner, Card, EmptyState, Pill } from '../../components/ui';
import { Icon } from '../../components/icons';
import { WEEKDAY_NAMES } from '../../lib/format';
import { PERIOD_ICON, PERIOD_LABEL, PERIOD_ORDER } from './shared';

/**
 * Upcoming menu (blueprint Part 78). These are the same published menu rows
 * the admin manages and the kitchen produces from — there is no parent-specific
 * menu upload anywhere in the system.
 */
export default function ParentMenu() {
  const { menu } = useParentData();

  return (
    <div>
      <h2 className="parent-title">This week's menu</h2>

      {menu.length === 0 ? (
        <EmptyState text="The menu for this week has not been published yet." />
      ) : (
        WEEKDAY_NAMES.map((day, weekday) => {
          const dayItems = menu.filter((m) => m.weekday === weekday);
          if (dayItems.length === 0) return null;
          return (
            <Card key={day} title={day}>
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
