import { useEffect, useState } from 'react';
import {
  listCalendarExceptions,
  addCalendarException,
  deleteCalendarException,
  listMeals,
  listRotations,
  type CalendarException,
  type RotationSummary,
} from '../lib/api';
import type { AppPeriod, MealLibraryItem } from '../lib/types';
import { todayISO } from '../lib/format';
import { Banner, Btn, Card, EmptyState, Field, Pill, Spinner } from '../components/ui';

// Calendar exceptions (§7): closure / date-specific override / special period.
// Admin manages real dates in the UI — never SQL. The complex resolution
// (which rotation week, which period) stays behind the interface (§8).
const PERIODS: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];
const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Morning snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};
const KIND_LABEL: Record<CalendarException['kind'], string> = {
  closure: 'Closure (no service)',
  override: 'Date-specific meal change',
  special_period: 'Special period / camp menu',
};

export default function InstitutionCalendarTab({ institutionId }: { institutionId: string }) {
  const [rows, setRows] = useState<CalendarException[] | null>(null);
  const [meals, setMeals] = useState<MealLibraryItem[]>([]);
  const [rotations, setRotations] = useState<RotationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<CalendarException['kind']>('closure');
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [period, setPeriod] = useState<AppPeriod | ''>('');
  const [mealId, setMealId] = useState('');
  const [rotationId, setRotationId] = useState('');
  const [reason, setReason] = useState('');

  async function reload() {
    const [e, m, r] = await Promise.all([
      listCalendarExceptions(institutionId),
      listMeals({ includeArchived: false }),
      listRotations(),
    ]);
    if (e.error) setError(e.error);
    setRows(e.data ?? []);
    setMeals(m.data ?? []);
    setRotations((r.data ?? []).filter((x) => x.active));
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  async function onAdd() {
    if (dateTo < dateFrom) return setError('End date is before start date.');
    if (kind === 'override' && !mealId) return setError('Choose the replacement meal.');
    if (kind === 'special_period' && !rotationId) return setError('Choose the special-period menu.');
    setBusy(true);
    setError(null);
    const res = await addCalendarException({
      institutionId,
      kind,
      dateFrom,
      dateTo,
      period: period || null,
      mealId: mealId || null,
      rotationId: rotationId || null,
      reason: reason.trim() || null,
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    setReason('');
    setMealId('');
    setRotationId('');
    await reload();
  }

  async function onDelete(id: string) {
    const res = await deleteCalendarException(id);
    if (res.error) return setError(res.error);
    await reload();
  }

  if (!rows) return <Spinner />;

  return (
    <div className="calendar-tab">
      {error && <Banner kind="err">{error}</Banner>}

      <Card title="Add a calendar rule" hint="closure, a one-off meal change, or a special period">
        <Field label="Type">
          <select value={kind} onChange={(e) => setKind(e.target.value as CalendarException['kind'])}>
            {(Object.keys(KIND_LABEL) as CalendarException['kind'][]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <div className="publish-row">
          <Field label="From">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
        </div>

        {kind !== 'special_period' && (
          <Field label="Period (optional — leave blank for all periods)">
            <select value={period} onChange={(e) => setPeriod(e.target.value as AppPeriod | '')}>
              <option value="">All periods</option>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
        )}

        {kind === 'override' && (
          <Field label="Replacement meal">
            <select value={mealId} onChange={(e) => setMealId(e.target.value)}>
              <option value="">— choose meal —</option>
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {kind === 'special_period' && (
          <Field label="Special-period menu">
            <select value={rotationId} onChange={(e) => setRotationId(e.target.value)}>
              <option value="">— choose menu —</option>
              {rotations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.week_count} weeks)
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Reason (optional)">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. public holiday" />
        </Field>
        <Btn variant="brand" onClick={() => void onAdd()} disabled={busy}>
          {busy ? 'Saving…' : 'Add rule'}
        </Btn>
        <p className="tmc-meta">
          Publish (or re-publish) the affected window from the Service tab for these rules to reach
          Kitchen, Classroom and Parent.
        </p>
      </Card>

      <Card title="Calendar rules">
        {rows.length === 0 ? (
          <EmptyState text="No calendar rules yet." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th>Detail</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Pill
                      variant={
                        r.kind === 'closure' ? 'reduced' : r.kind === 'override' ? 'amber' : 'brand'
                      }
                    >
                      {KIND_LABEL[r.kind]}
                    </Pill>
                  </td>
                  <td className="cell-sub">
                    {r.date_from === r.date_to ? r.date_from : `${r.date_from} → ${r.date_to}`}
                    {r.period ? ` · ${PERIOD_LABEL[r.period]}` : ''}
                  </td>
                  <td className="cell-sub">
                    {r.kind === 'override' && (r.meal_name ?? '—')}
                    {r.kind === 'special_period' && (r.rotation_name ?? '—')}
                    {r.reason ? ` (${r.reason})` : ''}
                  </td>
                  <td>
                    <button className="chip-x" onClick={() => void onDelete(r.id)}>
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
