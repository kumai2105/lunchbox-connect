import { useEffect, useState } from 'react';
import {
  listMenu,
  myChildren,
  notesForServing,
  servingForStudent,
  studentPhotoUrl,
} from '../lib/api';
import type { AppPeriod, MenuItem, ServingNote, ServingRecord, Student } from '../lib/types';
import { Avatar, Banner, Card, EmptyState, PageHead, Spinner } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { WEEKDAY_NAMES, initials, isoWeek, isoWeekday, todayISO } from '../lib/format';
import { consumptionHumanLabel, isValidPreferenceObservation } from '../lib/mealAnalytics';

// Four approved meal periods (docs/02 §26, docs/09 AT-082)
const PERIOD_ORDER: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];
const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

interface PeriodRecord {
  record: ServingRecord;
  note?: ServingNote;
}

const PERIOD_ICON: Record<AppPeriod, IconName> = {
  breakfast: 'sunrise',
  snack: 'apple',
  lunch: 'utensils',
  afternoon_snack: 'cookie',
};

function recordedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function last7Dates(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function ParentPage() {
  const [children, setChildren] = useState<Student[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});
  const [today, setToday] = useState<Record<string, Partial<Record<AppPeriod, PeriodRecord>>>>({});
  const [weekRecords, setWeekRecords] = useState<Record<string, ServingRecord[]>>({});
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

      const todayDate = todayISO();
      const perChildToday: Record<string, Partial<Record<AppPeriod, PeriodRecord>>> = {};
      const perChildWeek: Record<string, ServingRecord[]> = {};

      for (const child of kidsList) {
        const week: ServingRecord[] = [];
        for (const date of last7Dates()) {
          for (const period of PERIOD_ORDER) {
            const rec = await servingForStudent(child.id, date, period);
            if (rec.error) continue;
            if (!rec.data) continue;
            week.push(rec.data);
            if (date === todayDate) {
              const noteRes = await notesForServing([rec.data.id]);
              const note = (noteRes.data ?? []).find((n) => n.published_at);
              perChildToday[child.id] = {
                ...(perChildToday[child.id] ?? {}),
                [period]: { record: rec.data, note },
              };
            }
          }
        }
        perChildWeek[child.id] = week;
      }
      setToday(perChildToday);
      setWeekRecords(perChildWeek);

      const urls: Record<string, string | null> = {};
      await Promise.all(
        kidsList.map(async (c) => {
          urls[c.id] = await studentPhotoUrl(c.photo_path);
        }),
      );
      if (active) setPhotoUrls(urls);

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

  return (
    <div>
      <PageHead title="Parent view" hint="my children only — RLS enforces the boundary" />
      <Banner kind="info">
        Today's meal results, published notes and the active-week menu. Notes reach you only after
        review (AT-043); nothing is auto-published.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}

      {!children ? (
        <Spinner />
      ) : children.length === 0 ? (
        <EmptyState text="No children linked to this account yet — ask the school to link your child." />
      ) : (
        children.map((child) => {
          const childDay = today[child.id] ?? {};
          const week = weekRecords[child.id] ?? [];
          const completed = PERIOD_ORDER.filter((p) => childDay[p]).length;
          const todayWeekday = isoWeekday(new Date());
          const allergyNote = child.medical_notes?.map((m) => m.text).join(' · ');

          const validWeek = week.filter((r) => isValidPreferenceObservation(r));
          const avgPct =
            validWeek.length > 0
              ? Math.round(
                  validWeek.reduce((sum, r) => sum + (r.consumption_pct ?? 0), 0) /
                    validWeek.length,
                )
              : null;
          const ateWell = validWeek.filter((r) => (r.consumption_pct ?? 0) >= 75).length;
          const lowIntake = validWeek.filter((r) => (r.consumption_pct ?? 0) <= 25).length;
          const refusals = week.filter((r) => r.behavior === 'refused').length;
          const encouraged = week.filter((r) => r.behavior === 'needed_encouragement').length;

          return (
            <div className="kid-card" key={child.id} style={{ flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                <Avatar
                  photoUrl={photoUrls[child.id]}
                  initials={initials(child.given_name)}
                  size="md"
                />
                <div className="kid-info">
                  <h4>
                    {child.given_name} {child.family_name}
                  </h4>
                  <div className="kid-meta">{child.student_no}</div>
                  <div className="kid-summary">
                    Today's meals: {completed} of {PERIOD_ORDER.length} completed
                  </div>
                  {allergyNote && (
                    <div className="focus-allergy">
                      <Icon name="alertTriangle" size={13} /> {allergyNote}
                    </div>
                  )}
                </div>
              </div>

              <div className="today-meal-list">
                {PERIOD_ORDER.map((period) => {
                  const p = childDay[period];
                  const item = weekMenu.find(
                    (m) => m.weekday === todayWeekday && m.period === period,
                  );
                  if (!p) {
                    return (
                      <div className="today-meal-card wait" key={period}>
                        <span className="tmc-icon">
                          <Icon name={PERIOD_ICON[period]} size={16} />
                        </span>
                        <div className="tmc-body">
                          <div className="tmc-period">{PERIOD_LABEL[period]}</div>
                          <div className="tmc-meta">
                            {item?.dish_name ?? 'Upcoming'}
                            {item?.allergens?.length ? (
                              <span style={{ color: '#b45309' }}>
                                {' '}
                                · allergens: {item.allergens.map(String).join(', ')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="pill slate">Upcoming</span>
                      </div>
                    );
                  }
                  const r = p.record;
                  const notServed = r.served_status === 'not_served';
                  const pct = r.consumption_pct;
                  const tone = notServed
                    ? 'wait'
                    : (pct ?? 0) >= 50
                      ? 'ok'
                      : (pct ?? 0) > 0
                        ? 'warn'
                        : 'danger';
                  return (
                    <div className={`today-meal-card ${tone}`} key={period}>
                      <span className="tmc-icon">
                        <Icon name={PERIOD_ICON[period]} size={16} />
                      </span>
                      <div className="tmc-body">
                        <div className="tmc-period">
                          {PERIOD_LABEL[period]}{' '}
                          <span className="tmc-time">{recordedTime(r.created_at)}</span>
                        </div>
                        <div className="tmc-meta">
                          {item?.dish_name ?? '—'}
                          {p.note ? ` · "${p.note.body}"` : ''}
                        </div>
                      </div>
                      <span
                        className={`pill ${notServed ? 'slate' : tone === 'ok' ? 'brand' : tone === 'warn' ? 'reduced' : 'red'}`}
                      >
                        {notServed ? 'Not served' : consumptionHumanLabel(pct)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {week.length > 0 && (
                <div className="stat-grid" style={{ width: '100%', marginTop: 14, marginBottom: 0 }}>
                  <div className="stat">
                    <div className="label">Average intake</div>
                    <div className="value">{avgPct !== null ? `${avgPct}%` : '—'}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Ate 75–100%</div>
                    <div className="value">{ateWell}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Low intake 0–25%</div>
                    <div className="value">{lowIntake}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Needed encouragement</div>
                    <div className="value">{encouraged}</div>
                  </div>
                  {refusals > 0 && (
                    <div className="stat">
                      <div className="label">Refusals</div>
                      <div className="value">{refusals}</div>
                    </div>
                  )}
                </div>
              )}
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
