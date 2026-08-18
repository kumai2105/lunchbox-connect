import { useEffect, useState } from 'react';
import { listMenu, myChildren, notesForServing, servingForStudent } from '../lib/api';
import type { AppPeriod, MenuItem, ServingNote, Student } from '../lib/types';
import { Banner, Card, EmptyState, PageHead, Spinner } from '../components/ui';
import { WEEKDAY_NAMES, initials, todayISO } from '../lib/format';

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (+date - +firstThursday) / (7 * 24 * 3600 * 1000);
  return 1 + Math.round((diff + 1) / 7);
}

// Four approved meal periods (docs/02 §26, docs/09 AT-082)
const PERIOD_ORDER: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];
const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

interface PeriodOutcome {
  outcome: string;
  note?: ServingNote;
}

export default function ParentPage() {
  const [children, setChildren] = useState<Student[] | null>(null);
  const [outcomes, setOutcomes] = useState<
    Record<string, Partial<Record<AppPeriod, PeriodOutcome>>>
  >({});
  const [weekMenu, setWeekMenu] = useState<MenuItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const kids = await myChildren();
      if (!active) return;
      if (kids.error) {
        setError(kids.error);
        return;
      }
      const kidsList = kids.data ?? [];
      setChildren(kidsList);

      const today = todayISO();
      const perChild: Record<string, Partial<Record<AppPeriod, PeriodOutcome>>> = {};
      for (const child of kidsList) {
        for (const period of PERIOD_ORDER) {
          const rec = await servingForStudent(child.id, today, period);
          if (rec.error) {
            setError(rec.error);
            continue;
          }
          if (rec.data) {
            const noteRes = await notesForServing([rec.data.id]);
            const note = (noteRes.data ?? []).find((n) => n.published_at);
            perChild[child.id] = {
              ...(perChild[child.id] ?? {}),
              [period]: { outcome: rec.data.outcome, note },
            };
          }
        }
      }
      setOutcomes(perChild);

      const menu = await listMenu([isoWeek(new Date())]);
      if (menu.error) {
        setError(menu.error);
        return;
      }
      setWeekMenu((menu.data ?? []).filter((m) => m.published));
    })();
    return () => {
      active = false;
    };
  }, []);

  const AVATAR_COLORS = [
    'linear-gradient(135deg,#f59e0b,#ea580c)',
    'linear-gradient(135deg,#0d9488,#0f766e)',
    'linear-gradient(135deg,#7c3aed,#6d28d9)',
  ];

  return (
    <div>
      <PageHead title="Parent view" hint="my children only — RLS enforces the boundary" />
      <Banner kind="info">
        Today's meal outcomes, published notes and the active-week menu. Notes reach you only after
        review (AT-043); nothing is auto-published.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}

      {!children ? (
        <Spinner />
      ) : children.length === 0 ? (
        <EmptyState text="No children linked to this account yet — ask the school to link your child." />
      ) : (
        children.map((child, idx) => {
          const childDay = outcomes[child.id] ?? {};
          const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          return (
            <div className="kid-card" key={child.id}>
              <div className="kid-avatar" style={{ background: avatarColor }}>
                {initials(child.given_name)}
              </div>
              <div className="kid-info">
                <h4>
                  {child.given_name} {child.family_name}
                </h4>
                <div className="kid-meta">{child.student_no}</div>
                <div className="meal-row">
                  {PERIOD_ORDER.map((period) => {
                    const o = childDay[period];
                    return (
                      <span
                        key={period}
                        className={`meal-line ${o ? (o.outcome === 'full' || o.outcome === 'partial' ? 'ok' : 'wait') : 'wait'}`}
                      >
                        {o
                          ? `${PERIOD_LABEL[period]} — ${o.outcome}${o.note ? ` · note: "${o.note.body}"` : ''}`
                          : `${PERIOD_LABEL[period]} — not yet recorded`}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })
      )}

      <Card
        title="This week's menu"
        hint="published by the central admin"
        actions={<span className="chip green">Published</span>}
      >
        {weekMenu.length === 0 ? (
          <EmptyState text="The menu for this week has not been published yet." />
        ) : (
          <div className="menu-grid">
            {WEEKDAY_NAMES.map((day, weekday) => (
              <div className="menu-day" key={day}>
                <div className="day">{day}</div>
                {PERIOD_ORDER.map((period) => {
                  const item = weekMenu.find((m) => m.weekday === weekday && m.period === period);
                  return (
                    <div
                      key={period}
                      className={`meal ${period === 'breakfast' ? 'bf' : period === 'lunch' ? 'lu' : 'emit'}`}
                    >
                      <b>{PERIOD_LABEL[period]}</b>
                      {item?.dish_name ?? '—'}
                      {item?.portion ? <span className="meal-meta"> · {item.portion}</span> : null}
                      {item && Array.isArray(item.ingredients) && item.ingredients.length > 0 ? (
                        <span className="meal-meta">
                          {' '}
                          · {item.ingredients.map((i) => String(i)).join(', ')}
                        </span>
                      ) : null}
                      {item && Array.isArray(item.allergens) && item.allergens.length > 0 ? (
                        <span className="meal-meta" style={{ color: '#b45309' }}>
                          {' '}
                          · allergens: {item.allergens.map((a) => String(a)).join(', ')}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
