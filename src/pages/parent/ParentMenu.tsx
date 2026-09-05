import { useEffect, useState } from 'react';
import { useParentData } from './context';
import { Banner, Card, EmptyState, Modal, Pill } from '../../components/ui';
import { mealImageUrl, type DayMeal } from '../../lib/api';
import { Icon } from '../../components/icons';
import { weekStartISO } from '../../lib/format';
import { PERIOD_ICON, PERIOD_LABEL, PERIOD_ORDER } from './shared';

/** Presentational only: prettier names for the nutrition keys a meal carries. */
const NUTRIENT_LABEL: Record<string, string> = {
  kcal: 'Calories',
  calories: 'Calories',
  protein_g: 'Protein',
  carbs_g: 'Carbs',
  fat_g: 'Fat',
  fibre_g: 'Fibre',
  fiber_g: 'Fibre',
  sugar_g: 'Sugar',
  salt_g: 'Salt',
};

/**
 * Upcoming menu (blueprint Part 78). These are the same published menu rows
 * the admin manages and the kitchen produces from — there is no parent-specific
 * menu upload anywhere in the system.
 */
export default function ParentMenu() {
  const { meals } = useParentData();
  const [detail, setDetail] = useState<DayMeal | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setImgUrl(null);
    if (detail?.image_path) {
      void mealImageUrl(detail.image_path).then((u) => {
        if (active) setImgUrl(u);
      });
    }
    return () => {
      active = false;
    };
  }, [detail]);

  // Group by the real service date. The previous version iterated weekday
  // names and matched template rows, so every Wednesday rendered identically
  // and a closure or a one-off override was invisible. Dates that have no
  // published service simply do not appear — a day with no meal must never be
  // rendered as an empty meal.
  // The shell fetches a wider range for Insights; this screen shows the
  // current week only.
  const from = weekStartISO();
  const dates = [
    ...new Set(meals.filter((m) => m.service_date >= from).map((m) => m.service_date)),
  ].sort();

  return (
    <div>
      <div className="parent-head">
        <h2>This week&rsquo;s menu</h2>
        <p>Published by the nursery</p>
      </div>

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
                    <button
                      className="menu-line menu-line-btn"
                      key={period}
                      onClick={() => setDetail(item)}
                    >
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
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}

      <Banner kind="info">
        Allergen information shown here is the authoritative record <b>for this meal</b> — what the
        kitchen prepared. It is <b>not</b> matched against your child: their profile does not yet
        hold a structured allergy or dietary record, so nothing here is checked against one. Always
        tell your child's nursery or school directly about their allergies and dietary needs.
      </Banner>

      {detail && (
        <Modal title={detail.dish_name} onClose={() => setDetail(null)}>
          {detail.image_path && imgUrl && (
            <img className="meal-detail-img" src={imgUrl} alt={detail.dish_name} />
          )}
          <div className="tmc-period">{PERIOD_LABEL[detail.period]}</div>
          {detail.ingredients.length > 0 && (
            <p className="tmc-meta">
              <b>Ingredients:</b> {detail.ingredients.join(', ')}
            </p>
          )}
          {detail.allergens.length > 0 && (
            <div className="menu-allergen-row">
              {detail.allergens.map((a) => (
                <Pill key={a} variant="reduced">
                  {a}
                </Pill>
              ))}
            </div>
          )}
          {detail.portion && <p className="tmc-meta">Portion: {detail.portion}</p>}
          {Object.keys(detail.nutrition).length > 0 && (
            <div className="meal-detail-nutrition">
              <b>Nutrition</b>
              {/* Only the keys this meal actually carries are drawn. Nothing is
                  defaulted in: a missing macro is a macro the kitchen did not
                  record, and an invented zero would read as a measurement. */}
              <ul className="nutrition-tiles">
                {Object.entries(detail.nutrition).map(([k, v]) => (
                  <li key={k}>
                    <b>{String(v)}</b>
                    <span>{NUTRIENT_LABEL[k] ?? k}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
