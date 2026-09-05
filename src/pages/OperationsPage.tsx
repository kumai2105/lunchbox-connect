import { useCallback, useEffect, useState } from 'react';
import {
  adjustFinalDemand,
  advanceIssue,
  buildManifests,
  classroomCompletion,
  closeOperationalDay,
  correctOperationalRecord,
  demandDrift,
  demandForDate,
  finalDemandForDate,
  finalizeDemand,
  keepFinalDemand,
  listIssues,
  manifestsForDate,
  reconciliation,
} from '../lib/api';
import { PERIOD_LABEL } from '../lib/periods';
import { operationalToday } from '../lib/format';
import { useRole } from '../lib/auth';
import type {
  DeliveryManifest,
  DemandDriftRow,
  DemandRow,
  FinalDemand,
  OperationalIssue,
  ReconciliationRow,
} from '../lib/types';
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
import { IssueActionDialog, IssueCloseDialog } from '../components/issues';

/**
 * OPERATIONS — the day, from calculated demand to a closed logistics day.
 *
 * The layout follows the operator's actual sequence: see what is required,
 * freeze it, build the deliveries, then reconcile. Reconciliation is shaped to
 * make an ORDINARY day look ordinary — required 80, produced 80, packed 80,
 * handed over — because exact fulfilment is the standard here, not an outcome
 * worth celebrating with a variance report.
 */
export default function OperationsPage() {
  const [date, setDate] = useState(operationalToday());
  const [demand, setDemand] = useState<DemandRow[] | null>(null);
  const [final, setFinal] = useState<FinalDemand[]>([]);
  const [drift, setDrift] = useState<DemandDriftRow[]>([]);
  const [recon, setRecon] = useState<ReconciliationRow[]>([]);
  const [completion, setCompletion] = useState<
    Array<{ institution_name: string; period: string; entitled: number; recorded: number }>
  >([]);
  const [issues, setIssues] = useState<OperationalIssue[]>([]);
  const [manifests, setManifests] = useState<DeliveryManifest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const role = useRole();
  const isSuper = role === 'super_admin';
  const [dialog, setDialog] = useState<
    | { kind: 'drift'; row: DemandDriftRow }
    | { kind: 'close' }
    | { kind: 'action'; issue: OperationalIssue }
    | { kind: 'closeIssue'; issue: OperationalIssue }
    | {
        kind: 'correct';
        entity: string;
        id: string;
        field: string;
        fieldLabel: string;
        subject: string;
        currentValue: string;
      }
    | null
  >(null);

  const load = useCallback(async () => {
    setError(null);
    const [d, f, dr, rc, cc, is, mf] = await Promise.all([
      demandForDate(date),
      finalDemandForDate(date),
      demandDrift(date),
      reconciliation(date),
      classroomCompletion(date),
      listIssues(date),
      manifestsForDate(date),
    ]);
    if (d.error) setError(d.error);
    setDemand(d.data ?? []);
    setFinal(f.data ?? []);
    setDrift(dr.data ?? []);
    setRecon(rc.data ?? []);
    setCompletion(
      (cc.data ?? []).map((r) => ({
        institution_name: r.institution_name,
        period: r.period,
        entitled: Number(r.entitled),
        recorded: Number(r.recorded),
      })),
    );
    setIssues(is.data ?? []);
    setManifests(mf.data ?? []);
  }, [date]);

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
    setDialog(null);
    await load();
    return true;
  }

  const finalizedServiceIds = new Set(final.map((f) => f.meal_service_id));
  const institutions = [...new Set(recon.map((r) => r.institution_id))];

  return (
    <>
      <PageHead
        title="Operations"
        hint="Calculated demand, finalisation, delivery build and reconciliation"
        actions={<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
      />

      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      {drift.length > 0 && (
        <Card title="Late operational change">
          <Banner kind="warn">
            Something upstream changed after these were finalised. Nothing has been rewritten — the
            Kitchen is still working to the frozen figures. Decide explicitly.
          </Banner>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Sitting</th>
                  <th>Finalised</th>
                  <th>Recalculated</th>
                  <th style={{ textAlign: 'right' }}>Decision</th>
                </tr>
              </thead>
              <tbody>
                {drift.map((r) => (
                  <tr key={r.final_demand_id}>
                    <td>{r.institution_name}</td>
                    <td>{PERIOD_LABEL[r.period]}</td>
                    <td>
                      {r.finalized_total} ({r.finalized_standard} + {r.finalized_special})
                    </td>
                    <td>
                      <b>
                        {r.recalculated_total} ({r.recalculated_standard} + {r.recalculated_special}
                        )
                      </b>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Btn variant="brand" onClick={() => setDialog({ kind: 'drift', row: r })}>
                        Decide
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Required today">
        {demand === null ? (
          <Spinner />
        ) : demand.length === 0 ? (
          <EmptyState text="No published Meal Service for this date." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Sitting</th>
                  <th>Meal</th>
                  <th>Required</th>
                  <th>Standard</th>
                  <th>Special</th>
                  <th>Entitlement</th>
                  <th style={{ textAlign: 'right' }}>Finalise</th>
                </tr>
              </thead>
              <tbody>
                {demand.map((r) => (
                  <tr key={r.meal_service_id}>
                    <td>{r.institution_name}</td>
                    <td>{PERIOD_LABEL[r.period]}</td>
                    <td>{r.meal_name ?? '—'}</td>
                    <td>
                      <b>{r.total_required}</b>
                    </td>
                    <td>{r.standard_required}</td>
                    <td>{r.special_required}</td>
                    <td>
                      {r.plan_enforced ? (
                        <Pill variant="green">Meal Plans</Pill>
                      ) : (
                        <Pill variant="slate">Legacy</Pill>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {finalizedServiceIds.has(r.meal_service_id) ? (
                        <Pill variant="green">Finalised</Pill>
                      ) : r.unresolved_decisions > 0 ? (
                        <Pill variant="amber">
                          {r.unresolved_decisions} meal decision
                          {r.unresolved_decisions === 1 ? '' : 's'} outstanding
                        </Pill>
                      ) : (
                        <Btn
                          variant="brand"
                          disabled={busy}
                          onClick={() =>
                            void run(() => finalizeDemand(r.meal_service_id), 'Demand finalised.')
                          }
                        >
                          Finalise demand
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {institutions.length > 0 && (
        <Card
          title="Deliveries"
          hint="Manifests derive from finalised demand and the institution's delivery configuration"
        >
          {institutions.map((id) => {
            const row = recon.find((r) => r.institution_id === id);
            return (
              <div key={id} style={{ marginBottom: 10 }}>
                <b>{row?.institution_name}</b>{' '}
                <Btn
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(() => buildManifests(id, date), 'Delivery manifests built.')
                  }
                >
                  Build manifests
                </Btn>
              </div>
            );
          })}

          {manifests.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Run</th>
                    <th>Delivery point</th>
                    <th>State</th>
                    {isSuper && <th style={{ textAlign: 'right' }}>Correct</th>}
                  </tr>
                </thead>
                <tbody>
                  {manifests.map((m) => (
                    <tr key={m.id}>
                      <td>{m.institution_name}</td>
                      <td>{m.run_number}</td>
                      <td>{m.delivery_point ?? '—'}</td>
                      <td>{m.state.replace(/_/g, ' ')}</td>
                      {isSuper && (
                        <td style={{ textAlign: 'right' }}>
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDialog({
                                kind: 'correct',
                                entity: 'delivery_manifests',
                                id: m.id,
                                field: 'delivery_point',
                                fieldLabel: 'Delivery point',
                                subject: `${m.institution_name} run ${m.run_number}`,
                                currentValue: m.delivery_point ?? '',
                              })
                            }
                          >
                            Correct record
                          </Btn>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card title="Reconciliation" hint="One row per institution and sitting">
        {recon.length === 0 ? (
          <EmptyState text="Nothing finalised for this date yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Sitting</th>
                  <th>Entitled</th>
                  <th>Required</th>
                  <th>Production</th>
                  <th>Packing</th>
                  <th>Delivery</th>
                  <th>Special</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {recon.map((r, i) => (
                  <tr key={`${r.institution_id}-${r.period}-${i}`}>
                    <td>{r.institution_name}</td>
                    <td>{PERIOD_LABEL[r.period]}</td>
                    <td>{r.entitled_students}</td>
                    <td>
                      <b>{r.required_total}</b>{' '}
                      <span className="muted">
                        ({r.required_standard} + {r.required_special})
                      </span>
                    </td>
                    <td>{r.production_state.replace(/_/g, ' ')}</td>
                    <td>{r.packing_state.replace(/_/g, ' ')}</td>
                    <td>{r.dispatch_state.replace(/_/g, ' ')}</td>
                    <td>
                      {Number(r.specials_packed)}/{Number(r.specials_total)}
                    </td>
                    <td>
                      {Number(r.open_issues) === 0 ? (
                        <Pill variant="green">0</Pill>
                      ) : (
                        <Pill variant="amber">{Number(r.open_issues)}</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Classroom recording" hint="Reported separately — logistics does not wait on it">
        {completion.length === 0 ? (
          <EmptyState text="No published service for this date." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Sitting</th>
                  <th>Entitled</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {completion.map((r, i) => (
                  <tr key={i}>
                    <td>{r.institution_name}</td>
                    <td>{PERIOD_LABEL[r.period as keyof typeof PERIOD_LABEL]}</td>
                    <td>{r.entitled}</td>
                    <td>
                      {r.recorded} / {r.entitled}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">
          The denominator counts only children entitled to that sitting. A morning-only child never
          reduces lunch completion.
        </p>
      </Card>

      <Card
        title="Issues"
        hint="Open → actioned → (the institution acknowledges a delivery issue) → closed"
      >
        {issues.length === 0 ? (
          <EmptyState text="No issues raised for this date." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Category</th>
                  <th>What happened</th>
                  <th>What was done</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id}>
                    <td>{i.stage}</td>
                    <td>{i.category}</td>
                    <td>{i.description}</td>
                    <td>{i.resolution ?? <span className="muted">—</span>}</td>
                    <td>
                      <Pill variant={i.status === 'CLOSED' ? 'green' : 'amber'}>
                        {i.status.replace(/_/g, ' ')}
                      </Pill>
                    </td>
                    <td style={{ textAlign: 'right' }} className="row-actions">
                      {i.status === 'OPEN' && (
                        <Btn
                          size="sm"
                          variant="brand"
                          disabled={busy}
                          onClick={() => setDialog({ kind: 'action', issue: i })}
                        >
                          Action issue
                        </Btn>
                      )}
                      {(i.status === 'LUNCHBOX_ACTIONED' ||
                        i.status === 'INSTITUTION_ACKNOWLEDGED') && (
                        <Btn
                          size="sm"
                          variant="brand"
                          disabled={busy}
                          onClick={() => setDialog({ kind: 'closeIssue', issue: i })}
                        >
                          Close issue
                        </Btn>
                      )}
                      {i.status === 'LUNCHBOX_ACTIONED' && i.stage === 'DELIVERY' && (
                        <span className="muted"> awaiting the institution</span>
                      )}
                      {isSuper && i.status !== 'CLOSED' && (
                        <>
                          {' '}
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDialog({
                                kind: 'correct',
                                entity: 'operational_issues',
                                id: i.id,
                                field: 'description',
                                fieldLabel: 'What happened',
                                subject: `${i.stage} — ${i.category}`,
                                currentValue: i.description,
                              })
                            }
                          >
                            Correct description
                          </Btn>{' '}
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDialog({
                                kind: 'correct',
                                entity: 'operational_issues',
                                id: i.id,
                                field: 'category',
                                fieldLabel: 'Category',
                                subject: `${i.stage} — ${i.category}`,
                                currentValue: i.category,
                              })
                            }
                          >
                            Correct category
                          </Btn>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">
          A delivery issue is closed after the institution has acknowledged the resolution. An
          internal production or packing issue never reaches them and closes once actioned.
        </p>
      </Card>

      <Card title="End of day">
        <p className="hint">
          Closing asserts every production, packing and delivery step reached a final state and
          every special meal is accounted for. An issue already accepted at handover stays open and
          stays visible.
        </p>
        <Btn variant="brand" disabled={busy} onClick={() => setDialog({ kind: 'close' })}>
          Close operational day
        </Btn>
      </Card>

      {dialog?.kind === 'drift' && (
        <DriftDialog
          row={dialog.row}
          busy={busy}
          onClose={() => setDialog(null)}
          onApply={(reason) =>
            run(
              () => adjustFinalDemand(dialog.row.final_demand_id, reason),
              'Demand adjusted. The previous figures are preserved.',
            )
          }
          onKeep={(reason) =>
            run(
              () => keepFinalDemand(dialog.row.final_demand_id, reason),
              'Finalised demand kept, and the decision recorded.',
            )
          }
        />
      )}

      {dialog?.kind === 'action' && (
        <IssueActionDialog
          issue={dialog.issue}
          busy={busy}
          onClose={() => setDialog(null)}
          onAction={(resolution) =>
            run(
              () => advanceIssue(dialog.issue.id, 'LUNCHBOX_ACTIONED', resolution),
              dialog.issue.stage === 'DELIVERY'
                ? 'Issue actioned. The institution can now acknowledge it.'
                : 'Issue actioned.',
            )
          }
        />
      )}

      {dialog?.kind === 'closeIssue' && (
        <IssueCloseDialog
          issue={dialog.issue}
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={(note) =>
            run(() => advanceIssue(dialog.issue.id, 'CLOSED', note), 'Issue closed.')
          }
        />
      )}

      {dialog?.kind === 'correct' && (
        <CorrectDialog
          subject={dialog.subject}
          fieldLabel={dialog.fieldLabel}
          currentValue={dialog.currentValue}
          busy={busy}
          onClose={() => setDialog(null)}
          onCorrect={(value, reason) =>
            run(
              () =>
                correctOperationalRecord({
                  entity: dialog.entity,
                  id: dialog.id,
                  field: dialog.field,
                  value,
                  reason,
                }),
              'Record corrected. The previous value is preserved in Audit.',
            )
          }
        />
      )}

      {dialog?.kind === 'close' && (
        <CloseDialog
          date={date}
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={(note) =>
            run(() => closeOperationalDay(date, note), 'Operational day closed.')
          }
        />
      )}
    </>
  );
}

function DriftDialog({
  row,
  busy,
  onClose,
  onApply,
  onKeep,
}: {
  row: DemandDriftRow;
  busy: boolean;
  onClose: () => void;
  onApply: (reason: string) => Promise<boolean>;
  onKeep: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={`Late change — ${row.institution_name}, ${PERIOD_LABEL[row.period]}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="ghost"
            disabled={busy || !reason.trim()}
            onClick={() => void onKeep(reason)}
          >
            Keep finalised demand
          </Btn>
          <Btn
            variant="brand"
            disabled={busy || !reason.trim()}
            onClick={() => void onApply(reason)}
          >
            {busy ? 'Applying…' : 'Apply demand adjustment'}
          </Btn>
        </>
      }
    >
      <p>
        Finalised: <b>{row.finalized_total}</b> ({row.finalized_standard} standard +{' '}
        {row.finalized_special} special)
      </p>
      <p>
        Recalculated now: <b>{row.recalculated_total}</b> ({row.recalculated_standard} standard +{' '}
        {row.recalculated_special} special)
      </p>
      <Banner kind="info">
        Applying an adjustment <b>supersedes</b> the frozen snapshot rather than overwriting it, so
        what the Kitchen actually cooked to stays readable.
      </Banner>
      <Field label="Reason (required either way)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

/**
 * CORRECT RECORD — deliberately not a row editor.
 *
 * Every call site names ONE entity and ONE field, both from the database's own
 * allow-list. There is no field picker here, because a field picker is how a
 * correction facility becomes a database console with an audit row attached.
 * The previous value is shown, not editable, and the reason is required.
 */
function CorrectDialog({
  subject,
  fieldLabel,
  currentValue,
  busy,
  onClose,
  onCorrect,
}: {
  subject: string;
  fieldLabel: string;
  currentValue: string;
  busy: boolean;
  onClose: () => void;
  onCorrect: (value: string, reason: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(currentValue);
  const [reason, setReason] = useState('');
  const valid =
    value.trim().length > 0 && value.trim() !== currentValue && reason.trim().length > 0;
  return (
    <Modal
      title={`Correct record — ${subject}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="brand"
            disabled={!valid || busy}
            onClick={() => void onCorrect(value.trim(), reason)}
          >
            {busy ? 'Correcting…' : 'Correct record'}
          </Btn>
        </>
      }
    >
      <Banner kind="info">
        The original value is <b>kept in Audit</b> alongside the correction, who made it and why.
        Nothing is overwritten silently. Demand is corrected by adjusting it, and a completed
        handover by raising an issue — neither is correctable here.
      </Banner>
      <Field label={`${fieldLabel} — current value`}>
        <input value={currentValue} readOnly />
      </Field>
      <Field label={`${fieldLabel} — corrected value`}>
        <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </Field>
      <Field label="Reason (required)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {!valid && (
        <p className="hint">
          A corrected value that differs from the current one, and a reason, are both required.
        </p>
      )}
    </Modal>
  );
}

function CloseDialog({
  date,
  busy,
  onClose,
  onConfirm,
}: {
  date: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string | null) => Promise<boolean>;
}) {
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`Close ${date}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="brand" disabled={busy} onClick={() => void onConfirm(note || null)}>
            {busy ? 'Closing…' : 'Close operational day'}
          </Btn>
        </>
      }
    >
      <p className="hint">
        Classroom intake recording is reported separately and does not block closure — it belongs to
        the institution&rsquo;s afternoon, not to LunchBox&rsquo;s logistics.
      </p>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
