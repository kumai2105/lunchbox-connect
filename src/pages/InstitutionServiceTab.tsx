import { useEffect, useMemo, useState } from 'react';
import {
  getInstitutionConfigTimeline,
  configInEffectOn,
  setInstitutionServicePlan,
  assignInstitutionRotation,
  deleteServicePlanRow,
  deleteRotationAssignmentRow,
  publishInstitutionWindow,
  listRotations,
  type InstitutionConfigTimeline,
  type RotationSummary,
} from '../lib/api';
import type { AppPeriod } from '../lib/types';
import { todayISO } from '../lib/format';
import { Banner, Btn, Card, EmptyState, Field, Pill, Spinner } from '../components/ui';

// Institution service configuration (§7/§12/§20/§47). The Admin explicitly
// sets the CONTRACTED meal periods and which menu applies — never inferred.
//
// Both record sets are EFFECTIVE-DATED: changing a nursery's package or menu
// means adding a row from a future date, and the old row keeps governing the
// days it already governed. So this tab shows a timeline, not a single value,
// and distinguishes what is in effect today from what is merely scheduled.
const PERIODS: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];
const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Morning snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

export default function InstitutionServiceTab({ institutionId }: { institutionId: string }) {
  const [cfg, setCfg] = useState<InstitutionConfigTimeline | null>(null);
  const [rotations, setRotations] = useState<RotationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // plan editor
  const [periods, setPeriods] = useState<AppPeriod[]>([]);
  const [planFrom, setPlanFrom] = useState(todayISO());
  // rotation editor
  const [rotationId, setRotationId] = useState('');
  const [anchorWeek, setAnchorWeek] = useState(1);
  const [rotFrom, setRotFrom] = useState(todayISO());
  // publish
  const [pubFrom, setPubFrom] = useState(todayISO());
  const [pubTo, setPubTo] = useState(todayISO());

  const today = todayISO();

  async function reload() {
    const [c, r] = await Promise.all([
      getInstitutionConfigTimeline(institutionId),
      listRotations(),
    ]);
    if (c.error) setError(c.error);
    if (r.error) setError(r.error);
    if (c.data) {
      setCfg(c.data);
      // Prefill from what governs TODAY, so an edit starts from the live
      // configuration rather than from a change someone scheduled for later.
      const plan = configInEffectOn(c.data.plans, todayISO());
      const asg = configInEffectOn(c.data.assignments, todayISO());
      if (plan) setPeriods(plan.periods);
      if (asg) {
        setRotationId(asg.rotation_id);
        setAnchorWeek(asg.anchor_week);
      }
    }
    setRotations((r.data ?? []).filter((x) => x.active));
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  function togglePeriod(p: AppPeriod) {
    setPeriods((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function savePlan() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const ordered = PERIODS.filter((p) => periods.includes(p));
    const res = await setInstitutionServicePlan(institutionId, ordered, planFrom);
    setBusy(false);
    if (res.error) return setError(res.error);
    setMsg(`Service plan saved (${ordered.length} periods, from ${planFrom}).`);
    await reload();
  }

  async function saveRotation() {
    if (!rotationId) return setError('Choose a menu to assign.');
    const weeks = rotations.find((r) => r.id === rotationId)?.week_count ?? 1;
    if (anchorWeek < 1 || anchorWeek > weeks) {
      return setError(`Starting rotation week must be between 1 and ${weeks} for this menu.`);
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await assignInstitutionRotation(institutionId, rotationId, anchorWeek, rotFrom);
    setBusy(false);
    if (res.error) return setError(res.error);
    setMsg('Menu assigned.');
    await reload();
  }

  async function withdrawPlan(id: string) {
    setError(null);
    setMsg(null);
    const res = await deleteServicePlanRow(id);
    if (res.error) return setError(res.error);
    setMsg('Scheduled service-plan change withdrawn.');
    await reload();
  }

  async function withdrawAssignment(id: string) {
    setError(null);
    setMsg(null);
    const res = await deleteRotationAssignmentRow(id);
    if (res.error) return setError(res.error);
    setMsg('Scheduled menu change withdrawn.');
    await reload();
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await publishInstitutionWindow(institutionId, pubFrom, pubTo);
    setBusy(false);
    if (res.error) return setError(res.error);
    setMsg(`Published ${res.data} dated meal services for ${pubFrom} → ${pubTo}.`);
  }

  const livePlan = useMemo(() => (cfg ? configInEffectOn(cfg.plans, today) : null), [cfg, today]);
  const liveAssignment = useMemo(
    () => (cfg ? configInEffectOn(cfg.assignments, today) : null),
    [cfg, today],
  );

  if (!cfg) return <Spinner />;

  // Publishing needs a plan and a menu to exist at all — including ones dated
  // in the future, since publishing a future window is legitimate.
  const configured = cfg.plans.length > 0 && cfg.assignments.length > 0;
  // The upper bound for the anchor week follows the currently selected menu.
  const selectedWeekCount = rotations.find((r) => r.id === rotationId)?.week_count ?? 1;

  return (
    <div className="service-config">
      {error && <Banner kind="err">{error}</Banner>}
      {msg && <Banner kind="info">{msg}</Banner>}
      {!configured && (
        <Banner kind="warn">
          This institution is not fully configured yet. Set its contracted meal periods and assign a
          menu before publishing a schedule.
        </Banner>
      )}

      <Card title="Contracted meal periods" hint="which meals this institution actually receives">
        <p className="tmc-meta">
          The institution's own service determines applicable periods — not what the master menu
          happens to contain. To change the package later, set the new periods and an effective date
          from which they apply; days before that date keep the package they were served under.
        </p>
        <div className="period-checks">
          {PERIODS.map((p) => (
            <label key={p} className="check-inline">
              <input type="checkbox" checked={periods.includes(p)} onChange={() => togglePeriod(p)} />
              {PERIOD_LABEL[p]}
            </label>
          ))}
        </div>
        <Field label="Effective from">
          <input type="date" value={planFrom} onChange={(e) => setPlanFrom(e.target.value)} />
        </Field>
        <Btn variant="brand" onClick={() => void savePlan()} disabled={busy || periods.length === 0}>
          Save service plan
        </Btn>
        <p className="tmc-meta" data-testid="plan-in-effect">
          {livePlan
            ? `In effect today: ${livePlan.periods.map((p) => PERIOD_LABEL[p]).join(', ')} (since ${livePlan.effective_from})`
            : 'In effect today: nothing — this institution receives no meals until a plan starts.'}
        </p>
        <ConfigTimeline
          testId="plan-timeline"
          rows={cfg.plans.map((r) => ({
            id: r.id,
            effective_from: r.effective_from,
            detail: r.periods.map((p) => PERIOD_LABEL[p]).join(', '),
          }))}
          today={today}
          onWithdraw={(id) => void withdrawPlan(id)}
        />
      </Card>

      <Card title="Assigned menu" hint="which menu (rotation) applies, and from when">
        {rotations.length === 0 ? (
          <p className="tmc-meta">No active menus. Create one in the Menu Builder first.</p>
        ) : (
          <>
            <Field label="Menu">
              <select value={rotationId} onChange={(e) => setRotationId(e.target.value)}>
                <option value="">— choose a menu —</option>
                {rotations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.week_count} weeks)
                  </option>
                ))}
              </select>
            </Field>
            {/* anchor_week must address a week the SELECTED menu actually has —
                an anchor beyond its week_count resolves to nothing. The bound
                follows the chosen menu, and the database enforces the same
                rule (0033) whatever the client sends. */}
            <Field label="Starting rotation week">
              <input
                type="number"
                min={1}
                max={selectedWeekCount}
                value={anchorWeek}
                onChange={(e) =>
                  setAnchorWeek(
                    Math.min(selectedWeekCount, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
              />
            </Field>
            <Field label="Effective from">
              <input type="date" value={rotFrom} onChange={(e) => setRotFrom(e.target.value)} />
            </Field>
            <Btn variant="brand" onClick={() => void saveRotation()} disabled={busy || !rotationId}>
              Assign menu
            </Btn>
          </>
        )}
        <p className="tmc-meta">
          The starting week is set <b>once</b>, for the effective date. Every later week advances by
          itself from the calendar — week 2, then 3, then back to week 1 — and a closure never
          shifts it. Nobody picks a rotation week week by week.
        </p>
        <p className="tmc-meta" data-testid="rotation-in-effect">
          {liveAssignment
            ? `In effect today: ${liveAssignment.rotation_name ?? '—'}, started on week ${liveAssignment.anchor_week} of ${liveAssignment.effective_from}`
            : 'In effect today: no menu assigned.'}
        </p>
        <ConfigTimeline
          testId="rotation-timeline"
          rows={cfg.assignments.map((r) => ({
            id: r.id,
            effective_from: r.effective_from,
            detail: `${r.rotation_name ?? '—'} · starts on week ${r.anchor_week}`,
          }))}
          today={today}
          onWithdraw={(id) => void withdrawAssignment(id)}
        />
      </Card>

      <Card title="Publish schedule" hint="materialize dated meals for an operational window">
        <p className="tmc-meta">
          Publishing resolves the assigned menu + service plan into dated Meal Services that Kitchen,
          Classroom and Parent read. Already-served days are never overwritten. Re-publish a window
          after changing the configuration or the calendar so the change reaches those portals.
        </p>
        <div className="publish-row">
          <Field label="From">
            <input type="date" value={pubFrom} onChange={(e) => setPubFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={pubTo} onChange={(e) => setPubTo(e.target.value)} />
          </Field>
        </div>
        <Btn
          variant="brand"
          onClick={() => void publish()}
          disabled={busy || !configured || pubTo < pubFrom}
        >
          {busy ? 'Publishing…' : 'Publish window'}
        </Btn>
        {!configured && <Pill variant="reduced">Configure periods + menu first</Pill>}
      </Card>
    </div>
  );
}

/**
 * The effective-dated history of one configuration record set.
 *
 * A row dated in the future has not taken effect and can still be withdrawn. A
 * row that already governs real days cannot: withdrawing it would silently
 * change what those days were configured to be.
 */
function ConfigTimeline({
  rows,
  today,
  onWithdraw,
  testId,
}: {
  rows: Array<{ id: string; effective_from: string; detail: string }>;
  today: string;
  onWithdraw: (id: string) => void;
  testId: string;
}) {
  if (rows.length === 0) return <EmptyState text="Nothing configured yet." />;
  return (
    <table data-testid={testId}>
      <thead>
        <tr>
          <th>From</th>
          <th>Configuration</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const scheduled = r.effective_from > today;
          // Newest-first: the first row that has already started is the one
          // governing today; the ones after it are superseded history.
          const live = !scheduled && rows.findIndex((x) => x.effective_from <= today) === i;
          return (
            <tr key={r.id}>
              <td className="cell-sub">{r.effective_from}</td>
              <td className="cell-sub">{r.detail}</td>
              <td>
                {scheduled ? (
                  <Pill variant="amber">Scheduled</Pill>
                ) : live ? (
                  <Pill variant="brand">In effect</Pill>
                ) : (
                  <Pill variant="slate">Superseded</Pill>
                )}
              </td>
              <td>
                {scheduled && (
                  <button className="chip-x" onClick={() => onWithdraw(r.id)}>
                    withdraw
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
