import { useCallback, useEffect, useState } from 'react';
import {
  deliveryConfigs,
  deliveryReceivers,
  listInstitutions,
  setDeliveryConfig,
  setDeliveryReceiver,
  staffForInstitution,
} from '../lib/api';
import { PERIOD_LABEL, PERIOD_ORDER } from '../lib/periods';
import type { AppPeriod, AppUser, DeliveryConfig, Institution } from '../lib/types';
import { operationalToday } from '../lib/format';
import { useRole } from '../lib/auth';
import { can } from '../lib/rbac';
import {
  Banner,
  Btn,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHead,
  Pill,
  Spinner,
} from '../components/ui';

/**
 * DELIVERY SETUP.
 *
 * One delivery or two is a TRANSPORT decision. It changes nothing about who
 * receives what: the same already-calculated Meals travel in one vehicle or
 * two. The period→run mapping below is therefore the whole substance of the
 * screen, and the database refuses a configuration that leaves a serviced
 * sitting off every run, or puts one on both.
 *
 * Nothing is defaulted. An institution with no configuration gets no manifest
 * and a screen that says so — the commercial "one delivery" norm is not a
 * licence to write a row on every site's behalf.
 */
export default function DeliverySetupPage() {
  // Delivery configuration is LunchBox's decision and the site's to READ. The
  // matrix has always said so — `delivery` grants school_admin and kitchen
  // 'view' and nothing else — but this screen offered "Change configuration"
  // to whoever opened it, so an Institution Admin was shown a button that
  // could only ever be refused. The interface now offers what the caller can
  // actually do.
  const role = useRole();
  const mayConfigure = can(role, 'delivery', 'update');
  // Authorising a receiver is a different authority from configuring the
  // delivery, and the database keeps them apart: set_delivery_receiver asks
  // app_can_manage_institution, which the Kitchen never satisfies. The Kitchen
  // reads this screen to know where it is delivering, so it sees the state
  // without being offered an action it cannot take.
  const mayManageReceivers = role === 'super_admin' || role === 'school_admin';

  const [institutions, setInstitutions] = useState<Institution[] | null>(null);
  const [selected, setSelected] = useState<Institution | null>(null);
  const [configs, setConfigs] = useState<DeliveryConfig[]>([]);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [receivers, setReceivers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void listInstitutions().then((r) => {
      const active = (r.data ?? []).filter((i) => i.active !== false);
      setInstitutions(active);
      if (active.length && !selected) setSelected(active[0]);
    });
    // Selecting the first institution once is intentional; re-running on every
    // `selected` change would fight the operator's own choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!selected) return;
    const [c, s, r] = await Promise.all([
      deliveryConfigs(selected.id),
      staffForInstitution(selected.id),
      deliveryReceivers(selected.id),
    ]);
    if (c.error) setError(c.error);
    setConfigs(c.data ?? []);
    setStaff(s.data ?? []);
    setReceivers(r.data ?? []);
  }, [selected]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<{ error: string | null }>, done: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fn();
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    setOk(done);
    setEditing(false);
    await load();
    return true;
  }

  const today = operationalToday();
  const current = configs.find(
    (c) => c.effective_from <= today && (!c.effective_until || c.effective_until >= today),
  );

  return (
    <>
      <PageHead
        title="Delivery setup"
        hint="How each institution receives its meals — one or two runs a day"
        actions={
          institutions && institutions.length > 0 ? (
            <select
              value={selected?.id ?? ''}
              onChange={(e) =>
                setSelected(institutions.find((i) => i.id === e.target.value) ?? null)
              }
              aria-label="Institution"
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          ) : null
        }
      />

      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      <Banner kind="info">
        Changing the number of runs changes <b>transport grouping only</b>. It does not change any
        child&rsquo;s Meal Plan, the Menu, or one single Meal of total demand.
      </Banner>

      {institutions === null ? (
        <Spinner />
      ) : institutions.length === 0 ? (
        <EmptyState text="No active institutions." />
      ) : (
        <>
          <Card
            title="Delivery configuration"
            actions={
              mayConfigure ? (
                <Btn variant="brand" onClick={() => setEditing(true)}>
                  {current ? 'Change configuration' : 'Configure deliveries'}
                </Btn>
              ) : undefined
            }
          >
            {!mayConfigure && (
              <Banner kind="info">
                This is set by LunchBox. To change the number of runs, the delivery windows or the
                delivery point, ask LunchBox — you can see the arrangement in effect here, and you
                manage your own authorised receivers on Today&rsquo;s delivery.
              </Banner>
            )}
            {!current ? (
              <Banner kind="warn">
                DELIVERY CONFIGURATION REQUIRED — this institution has no configuration in effect
                today, so no manifest can be built for it. Nothing has been guessed on its behalf.
              </Banner>
            ) : (
              <p>
                <Pill variant="green">
                  {current.run_count === 1 ? 'One delivery a day' : 'Two deliveries a day'}
                </Pill>{' '}
                to <b>{current.delivery_point}</b>, in effect from {current.effective_from}.
              </p>
            )}

            {configs.length > 1 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>Until</th>
                      <th>Runs</th>
                      <th>Delivery point</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((c) => (
                      <tr key={c.id}>
                        <td>{c.effective_from}</td>
                        <td>{c.effective_until ?? '—'}</td>
                        <td>{c.run_count}</td>
                        <td>{c.delivery_point}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Authorised delivery receivers"
            hint="Who at this institution may accept custody of a delivery"
          >
            <Banner kind="info">
              This is a <b>capability</b>, not a role. It grants the handover action for this
              institution and widens nothing else. A Parent is never eligible.
            </Banner>
            {staff.length === 0 ? (
              <EmptyState text="No active staff at this institution." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th style={{ textAlign: 'right' }}>Receiver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff
                      .filter(
                        (u) =>
                          u.active !== false &&
                          (u.role === 'school_admin' || u.role === 'classroom_staff'),
                      )
                      .map((u) => {
                        const isReceiver = receivers.includes(u.user_id);
                        return (
                          <tr key={u.user_id}>
                            <td>{u.full_name}</td>
                            <td>{u.role.replace(/_/g, ' ')}</td>
                            <td style={{ textAlign: 'right' }}>
                              {!mayManageReceivers ? (
                                <Pill variant={isReceiver ? 'green' : 'slate'}>
                                  {isReceiver ? 'Authorised' : 'Not authorised'}
                                </Pill>
                              ) : (
                                <Btn
                                  variant={isReceiver ? 'ghost' : 'brand'}
                                  disabled={busy || !selected}
                                  onClick={() =>
                                    void run(
                                      () =>
                                        setDeliveryReceiver(selected!.id, u.user_id, !isReceiver),
                                      isReceiver
                                        ? 'Receiver authorisation removed.'
                                        : 'Authorised to receive deliveries.',
                                    )
                                  }
                                >
                                  {isReceiver ? 'Remove authorisation' : 'Authorise'}
                                </Btn>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {editing && selected && (
        <ConfigDialog
          institution={selected}
          busy={busy}
          onClose={() => setEditing(false)}
          onSave={(input) =>
            run(
              () => setDeliveryConfig({ institutionId: selected.id, ...input }),
              'Delivery configuration saved. It applies from its effective date forward.',
            )
          }
        />
      )}
    </>
  );
}

function ConfigDialog({
  institution,
  busy,
  onClose,
  onSave,
}: {
  institution: Institution;
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    from: string;
    runCount: number;
    deliveryPoint: string;
    windows: Array<{ run: number; from: string; to: string }>;
    periodRuns: Record<string, number>;
  }) => Promise<boolean>;
}) {
  const today = operationalToday();
  const [from, setFrom] = useState(today);
  const [runCount, setRunCount] = useState(1);
  const [point, setPoint] = useState('');
  const [w1From, setW1From] = useState('07:00');
  const [w1To, setW1To] = useState('08:30');
  const [w2From, setW2From] = useState('11:00');
  const [w2To, setW2To] = useState('12:30');
  const [periodRuns, setPeriodRuns] = useState<Record<AppPeriod, number>>({
    breakfast: 1,
    snack: 1,
    lunch: 1,
    afternoon_snack: 1,
  });

  const valid = point.trim().length > 0;

  return (
    <Modal
      title={`Delivery configuration — ${institution.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="brand"
            disabled={!valid || busy}
            onClick={() =>
              void onSave({
                from,
                runCount,
                deliveryPoint: point,
                windows:
                  runCount === 1
                    ? [{ run: 1, from: w1From, to: w1To }]
                    : [
                        { run: 1, from: w1From, to: w1To },
                        { run: 2, from: w2From, to: w2To },
                      ],
                periodRuns: Object.fromEntries(
                  PERIOD_ORDER.map((p) => [p, runCount === 1 ? 1 : periodRuns[p]]),
                ),
              })
            }
          >
            {busy ? 'Saving…' : 'Save configuration'}
          </Btn>
        </>
      }
    >
      <Field label="Effective from">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <Field label="Agreed delivery point">
        <input
          value={point}
          onChange={(e) => setPoint(e.target.value)}
          placeholder="e.g. Main reception"
        />
      </Field>
      <Field label="Deliveries per day">
        <select value={runCount} onChange={(e) => setRunCount(Number(e.target.value))}>
          <option value={1}>One</option>
          <option value={2}>Two</option>
        </select>
      </Field>

      <Field label="Run 1 window">
        <div className="row-2">
          <input type="time" value={w1From} onChange={(e) => setW1From(e.target.value)} />
          <input type="time" value={w1To} onChange={(e) => setW1To(e.target.value)} />
        </div>
      </Field>

      {runCount === 2 && (
        <>
          <Field label="Run 2 window">
            <div className="row-2">
              <input type="time" value={w2From} onChange={(e) => setW2From(e.target.value)} />
              <input type="time" value={w2To} onChange={(e) => setW2To(e.target.value)} />
            </div>
          </Field>
          <Field label="Which run carries which sitting">
            <div className="check-col">
              {PERIOD_ORDER.map((p) => (
                <label key={p} className="check">
                  <span style={{ minWidth: 140, display: 'inline-block' }}>{PERIOD_LABEL[p]}</span>
                  <select
                    value={periodRuns[p]}
                    aria-label={`${PERIOD_LABEL[p]} run`}
                    onChange={(e) => setPeriodRuns({ ...periodRuns, [p]: Number(e.target.value) })}
                  >
                    <option value={1}>Run 1</option>
                    <option value={2}>Run 2</option>
                  </select>
                </label>
              ))}
            </div>
          </Field>
          <p className="hint">
            Every sitting this institution actually serves must be on exactly one run. The database
            refuses a configuration that leaves one off, or puts one on both.
          </p>
        </>
      )}

      {runCount === 1 && (
        <p className="hint">
          With one delivery, every sitting this institution serves travels together on run 1.
        </p>
      )}
    </Modal>
  );
}
