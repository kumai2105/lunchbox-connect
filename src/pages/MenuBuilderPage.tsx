import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  listRotations,
  createRotation,
  setRotationWeekCount,
  setRotationActive,
  rotationSlots,
  setRotationSlot,
  listMeals,
  type RotationSummary,
  type RotationSlotRow,
} from '../lib/api';
import type { AppPeriod, MealLibraryItem } from '../lib/types';
import { Banner, Btn, EmptyState, Field, Modal, PageHead, Pill, Spinner } from '../components/ui';
import { Icon } from '../components/icons';

// Menu Builder (§5). A "Menu" is a rotation: a named, N-week arrangement of
// meals into weekday/period slots. Week count is chosen by Admin (§2/§6) — the
// grid grows and shrinks with it; nothing is hard-coded to 4 weeks.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];
const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Morning snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

type SlotKey = string; // `${week}-${weekday}-${period}`
const keyOf = (w: number, d: number, p: AppPeriod): SlotKey => `${w}-${d}-${p}`;

export default function MenuBuilderPage() {
  const [rotations, setRotations] = useState<RotationSummary[] | null>(null);
  const [meals, setMeals] = useState<MealLibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RotationSummary | null>(null);
  const [slots, setSlots] = useState<Map<SlotKey, RotationSlotRow>>(new Map());
  const [week, setWeek] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWeeks, setNewWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  // cell being edited: {week,weekday,period} or null
  const [cell, setCell] = useState<{ w: number; d: number; p: AppPeriod } | null>(null);

  async function loadRotations() {
    const res = await listRotations();
    if (res.error) setError(res.error);
    setRotations(res.data ?? []);
    return res.data ?? [];
  }

  useEffect(() => {
    let active = true;
    void Promise.all([listRotations(), listMeals({ includeArchived: false })]).then(([r, m]) => {
      if (!active) return;
      if (r.error) setError(r.error);
      setRotations(r.data ?? []);
      setMeals(m.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  async function openRotation(r: RotationSummary) {
    setSelected(r);
    setWeek(1);
    const res = await rotationSlots(r.id);
    if (res.error) {
      setError(res.error);
      return;
    }
    const map = new Map<SlotKey, RotationSlotRow>();
    (res.data ?? []).forEach((s) => map.set(keyOf(s.week_number, s.weekday, s.period), s));
    setSlots(map);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createRotation(newName.trim(), newWeeks);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setShowCreate(false);
    setNewName('');
    const list = await loadRotations();
    const created = list.find((r) => r.id === res.data);
    if (created) await openRotation(created);
  }

  async function changeWeeks(delta: number) {
    if (!selected) return;
    const next = Math.max(1, selected.week_count + delta);
    if (next === selected.week_count) return;
    const res = await setRotationWeekCount(selected.id, next);
    if (res.error) {
      setError(res.error);
      return;
    }
    const updated = { ...selected, week_count: next };
    setSelected(updated);
    if (week > next) setWeek(next);
    await loadRotations();
    await openRotation(updated);
  }

  async function assign(mealId: string | null) {
    if (!selected || !cell) return;
    const res = await setRotationSlot(selected.id, cell.w, cell.d, cell.p, mealId);
    if (res.error) {
      setError(res.error);
      return;
    }
    const map = new Map(slots);
    const k = keyOf(cell.w, cell.d, cell.p);
    if (mealId === null) map.delete(k);
    else {
      const meal = meals.find((m) => m.id === mealId);
      map.set(k, {
        week_number: cell.w,
        weekday: cell.d,
        period: cell.p,
        meal_id: mealId,
        meal_name: meal?.name ?? '—',
      });
    }
    setSlots(map);
    setCell(null);
  }

  async function toggleActive() {
    if (!selected) return;
    const res = await setRotationActive(selected.id, !selected.active);
    if (res.error) {
      setError(res.error);
      return;
    }
    const updated = { ...selected, active: !selected.active };
    setSelected(updated);
    await loadRotations();
  }

  const weekTabs = useMemo(
    () => (selected ? Array.from({ length: selected.week_count }, (_, i) => i + 1) : []),
    [selected],
  );

  if (error && !rotations) return <EmptyState text={`Could not load menus: ${error}`} />;

  return (
    <div>
      <PageHead
        title="Menu Builder"
        hint="Create a menu of any duration and place meals into its days"
        actions={
          <Btn variant="brand" onClick={() => setShowCreate(true)}>
            <Icon name="utensils" size={15} /> New menu
          </Btn>
        }
      />
      {error && <Banner kind="err">{error}</Banner>}

      <div className="menu-builder">
        <aside className="menu-list">
          {!rotations ? (
            <Spinner />
          ) : rotations.length === 0 ? (
            <EmptyState text="No menus yet." />
          ) : (
            rotations.map((r) => (
              <button
                key={r.id}
                className={`menu-list-item${selected?.id === r.id ? ' active' : ''}`}
                onClick={() => void openRotation(r)}
              >
                <b>{r.name}</b>
                <span className="tmc-meta">
                  {r.week_count} weeks · {r.slot_count} slots
                </span>
                {!r.active && <Pill variant="reduced">Archived</Pill>}
              </button>
            ))
          )}
        </aside>

        <section className="menu-canvas">
          {!selected ? (
            <EmptyState text="Select a menu, or create one, to arrange its meals." />
          ) : (
            <>
              <div className="menu-canvas-head">
                <div>
                  <h3>{selected.name}</h3>
                  <span className="tmc-meta">
                    {selected.active ? 'Active' : 'Archived'} · {selected.week_count}-week rotation
                  </span>
                </div>
                <div className="menu-canvas-actions">
                  <Btn size="sm" onClick={() => void changeWeeks(-1)} disabled={selected.week_count <= 1}>
                    − week
                  </Btn>
                  <Btn size="sm" onClick={() => void changeWeeks(1)}>
                    + week
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => void toggleActive()}>
                    {selected.active ? 'Archive' : 'Restore'}
                  </Btn>
                </div>
              </div>

              <div className="week-tabs">
                {weekTabs.map((w) => (
                  <button
                    key={w}
                    className={`week-tab${w === week ? ' active' : ''}`}
                    onClick={() => setWeek(w)}
                  >
                    Week {w}
                  </button>
                ))}
              </div>

              <div className="menu-grid-scroll">
                <table className="menu-grid">
                  <thead>
                    <tr>
                      <th>Period</th>
                      {WEEKDAYS.map((d) => (
                        <th key={d}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map((p) => (
                      <tr key={p}>
                        <td className="period-label">{PERIOD_LABEL[p]}</td>
                        {WEEKDAYS.map((_, d) => {
                          const s = slots.get(keyOf(week, d, p));
                          return (
                            <td key={d}>
                              <button
                                className={`slot-cell${s ? ' filled' : ''}`}
                                onClick={() => setCell({ w: week, d, p })}
                              >
                                {s ? s.meal_name : '+'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {showCreate && (
        <Modal
          title="New menu"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Btn>
              <Btn variant="brand" onClick={onCreate} disabled={busy || !newName.trim()}>
                {busy ? 'Creating…' : 'Create'}
              </Btn>
            </>
          }
        >
          <form onSubmit={onCreate}>
            <Field label="Menu name">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Spring 2026"
                autoFocus
              />
            </Field>
            <Field label="Number of weeks">
              <input
                type="number"
                min={1}
                max={12}
                value={newWeeks}
                onChange={(e) => setNewWeeks(Math.max(1, Number(e.target.value)))}
              />
            </Field>
            <p className="tmc-meta">
              The current company standard is 4 weeks, but you can choose any duration and change it
              later.
            </p>
          </form>
        </Modal>
      )}

      {cell && (
        <Modal
          title={`${PERIOD_LABEL[cell.p]} · ${WEEKDAYS[cell.d]} · Week ${cell.w}`}
          onClose={() => setCell(null)}
        >
          <div className="meal-picker">
            <button className="meal-pick clear" onClick={() => void assign(null)}>
              <Icon name="x" size={14} /> Clear slot
            </button>
            {meals.length === 0 ? (
              <EmptyState text="No active meals. Create meals in the Meal Library first." />
            ) : (
              meals.map((m) => (
                <button key={m.id} className="meal-pick" onClick={() => void assign(m.id)}>
                  {m.name}
                  {m.allergens.length > 0 && (
                    <span className="tmc-meta"> · {m.allergens.join(', ')}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
