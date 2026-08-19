import { useEffect, useState } from 'react';
import {
  getInstitutionServiceConfig,
  setInstitutionServicePlan,
  assignInstitutionRotation,
  publishInstitutionWindow,
  listRotations,
  type InstitutionServiceConfig,
  type RotationSummary,
} from '../lib/api';
import type { AppPeriod } from '../lib/types';
import { Banner, Btn, Card, Field, Pill, Spinner } from '../components/ui';

// Institution service configuration (§7/§12/§20/§47). The Admin explicitly
// sets the CONTRACTED meal periods and which menu applies — never inferred.
const PERIODS: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];
const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Morning snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InstitutionServiceTab({ institutionId }: { institutionId: string }) {
  const [cfg, setCfg] = useState<InstitutionServiceConfig | null>(null);
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

  async function reload() {
    const [c, r] = await Promise.all([
      getInstitutionServiceConfig(institutionId),
      listRotations(),
    ]);
    if (c.error) setError(c.error);
    if (r.error) setError(r.error);
    if (c.data) {
      setCfg(c.data);
      setPeriods(c.data.periods ?? []);
      if (c.data.rotation_id) setRotationId(c.data.rotation_id);
      if (c.data.anchor_week) setAnchorWeek(c.data.anchor_week);
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
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await assignInstitutionRotation(institutionId, rotationId, anchorWeek, rotFrom);
    setBusy(false);
    if (res.error) return setError(res.error);
    setMsg('Menu assigned.');
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

  if (!cfg) return <Spinner />;

  const configured = cfg.periods && cfg.rotation_id;

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
          happens to contain.
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
        {cfg.periods && (
          <p className="tmc-meta">
            Current: {cfg.periods.map((p) => PERIOD_LABEL[p]).join(', ')} (from{' '}
            {cfg.plan_effective_from})
          </p>
        )}
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
            <Field label="Starting rotation week">
              <input
                type="number"
                min={1}
                value={anchorWeek}
                onChange={(e) => setAnchorWeek(Math.max(1, Number(e.target.value)))}
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
        {cfg.rotation_name && (
          <p className="tmc-meta">
            Current: <b>{cfg.rotation_name}</b>, anchor week {cfg.anchor_week}, from{' '}
            {cfg.rotation_effective_from}
          </p>
        )}
      </Card>

      <Card title="Publish schedule" hint="materialize dated meals for an operational window">
        <p className="tmc-meta">
          Publishing resolves the assigned menu + service plan into dated Meal Services that Kitchen,
          Classroom and Parent read. Already-served days are never overwritten.
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
