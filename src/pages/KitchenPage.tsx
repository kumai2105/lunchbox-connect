import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  activeDrivers,
  advanceIssue,
  assignManifestDriver,
  completePacking,
  completeProduction,
  confirmSpecialPacked,
  confirmSpecialProduced,
  finalDemandForDate,
  kitchenSpecialMeals,
  listIssues,
  manifestLines,
  manifestsForDate,
  mealProductionDemand,
  productionRuns,
  releaseManifest,
  reportIssue,
  specialLines,
  startPacking,
  startProduction,
  type MealDemandRow,
} from '../lib/api';
import { groupDemandByRevision } from '../lib/kitchen';
import type { AppPeriod } from '../lib/types';
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
  StatCard,
} from '../components/ui';
import { IssueActionDialog, IssueCloseDialog } from '../components/issues';
import type {
  DeliveryManifest,
  FinalDemand,
  KitchenSpecialMeal,
  ManifestLine,
  OperationalIssue,
  ProductionRun,
  SpecialLine,
} from '../lib/types';
import { Icon, type IconName } from '../components/icons';
import { todayISO } from '../lib/format';

const PERIOD_META: Record<AppPeriod, { label: string; icon: IconName }> = {
  breakfast: { label: 'Breakfast', icon: 'sunrise' },
  snack: { label: 'Morning snack', icon: 'apple' },
  lunch: { label: 'Lunch', icon: 'utensils' },
  afternoon_snack: { label: 'Afternoon snack', icon: 'cookie' },
};

/**
 * Kitchen production demand (§33/§34/§35/§56). Demand is per PUBLISHED MEAL:
 * the kitchen sees how many of each actual meal to make. Whether a date is a
 * service day is decided entirely by what is published for it — no weekend
 * rule. Counts only, never student identity.
 */
export default function KitchenPage() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<MealDemandRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRows(null);
    void mealProductionDemand(date).then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [date]);

  // Aggregate by the exact MEAL REVISION being produced (§34). Two recipes/
  // revisions that share a display name are separate production lines — same
  // name does not mean same recipe. A revision made at several sites for the
  // same period is one line with the summed headcount.
  const byMeal = useMemo(() => groupDemandByRevision(rows ?? []), [rows]);

  const totalPortions = byMeal.reduce((s, m) => s + m.total, 0);
  const totalSafetyNotes = byMeal.reduce((s, m) => s + m.safetyNotes, 0);
  const isServiceDay = (rows?.length ?? 0) > 0;

  return (
    <div>
      <PageHead title="Kitchen production" hint="what to make, per meal, for a chosen day" />

      <Banner kind="info">
        These counts come from the children entitled to be served against the <b>published</b>{' '}
        schedule. Kitchen staff never see who the children are — counts only, and for a special meal
        the minimum needed to hand the right tray to the right child. Whether a day has service is
        decided by what is published for it, not by the day of the week.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="toolbar">
        <Field label="Production date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <div className="stat-grid">
        <StatCard icon="utensils" label="Distinct meals" value={byMeal.length} trend="to prepare" />
        <StatCard
          icon="users"
          label="Total eligible servings"
          value={totalPortions}
          trend="summed across meals"
        />
        <StatCard
          icon="alertTriangle"
          label="Safety notes (interim)"
          value={totalSafetyNotes}
          trend="students with any interim note — not an allergy record"
        />
      </div>

      <Card title="Make list" hint="one line per meal — quantities are eligible headcount">
        {!rows ? (
          <Spinner />
        ) : !isServiceDay ? (
          <EmptyState text="Nothing is published for this date — no production scheduled." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Meal</th>
                <th>Make (eligible)</th>
                <th className="col-secondary">Safety notes</th>
                <th className="col-secondary">Sites</th>
              </tr>
            </thead>
            <tbody>
              {byMeal.map((m) => (
                <tr key={`${m.period}-${m.meal_revision_id}`}>
                  <td className="cell-name">
                    <span className="period-cell">
                      <Icon name={PERIOD_META[m.period].icon} size={15} />{' '}
                      {PERIOD_META[m.period].label}
                    </span>
                  </td>
                  <td>{m.meal_name}</td>
                  <td className="mono">
                    <b>{m.total}</b>
                  </td>
                  <td className="col-secondary">
                    {m.safetyNotes > 0 ? (
                      <Pill variant="reduced">{m.safetyNotes}</Pill>
                    ) : (
                      <span className="cell-sub">—</span>
                    )}
                  </td>
                  <td className="col-secondary cell-sub">
                    {m.sites
                      .map((s) => `${s.institution_name} (${s.eligible_students})`)
                      .join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ProductionWorkflow date={date} />
    </div>
  );
}

/**
 * PRODUCTION → PACKING → RELEASE.
 *
 * The normal path is confirmation, not data entry: the quantity is already
 * known, so `Mark production complete` MEANS "the exact Final Demand was
 * produced" and asks for no number. Reporting a problem is a secondary button,
 * because a shortage is an abnormal event here rather than a daily reconciliation.
 *
 * Special meals are confirmed one at a time by reference. "We made the three
 * specials" is a weaker assurance than "this child's meal was made", and the
 * difference is exactly the child who gets the wrong tray — so the database
 * refuses to complete either stage while any single line is unconfirmed.
 */
function ProductionWorkflow({ date }: { date: string }) {
  const [final, setFinal] = useState<FinalDemand[] | null>(null);
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [lines, setLines] = useState<SpecialLine[]>([]);
  const [specials, setSpecials] = useState<KitchenSpecialMeal[]>([]);
  const [manifests, setManifests] = useState<DeliveryManifest[]>([]);
  const [mLines, setMLines] = useState<Record<string, ManifestLine[]>>({});
  const [drivers, setDrivers] = useState<Array<{ user_id: string; full_name: string }>>([]);
  // The dispatcher's in-progress choice per manifest, before they commit it.
  const [driverChoice, setDriverChoice] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<OperationalIssue[]>([]);
  const [issueFor, setIssueFor] = useState<{ id: string; stage: 'PRODUCTION' | 'PACKING' } | null>(
    null,
  );
  const [workIssue, setWorkIssue] = useState<{
    kind: 'action' | 'close';
    issue: OperationalIssue;
  } | null>(null);
  const [labelsFor, setLabelsFor] = useState<DeliveryManifest | null>(null);

  const load = useCallback(async () => {
    const f = await finalDemandForDate(date);
    if (f.error) {
      setError(f.error);
      setFinal([]);
      return;
    }
    const fd = f.data ?? [];
    setFinal(fd);
    const ids = fd.map((x) => x.id);
    const [r, l, sp, m, dv, is] = await Promise.all([
      productionRuns(ids),
      specialLines(ids),
      kitchenSpecialMeals(date),
      manifestsForDate(date),
      activeDrivers(),
      listIssues(date),
    ]);
    setRuns(r.data ?? []);
    setLines(l.data ?? []);
    setSpecials(sp.data ?? []);
    setManifests(m.data ?? []);
    setDrivers(dv.data ?? []);
    setIssues(is.data ?? []);
    const map: Record<string, ManifestLine[]> = {};
    await Promise.all(
      (m.data ?? []).map(async (x) => {
        const ml = await manifestLines(x.id);
        map[x.id] = ml.data ?? [];
      }),
    );
    setMLines(map);
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
    setIssueFor(null);
    setWorkIssue(null);
    await load();
    return true;
  }

  if (final === null) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      <Card title="Production and packing" hint="exact Final Demand — no quantity to re-enter">
        {final.length === 0 ? (
          <EmptyState text="Nothing is finalised for this date yet. Production begins once LunchBox finalises demand." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Sitting</th>
                <th>Required</th>
                <th>Production</th>
                <th>Packing</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {final.map((f) => {
                const r = runs.find((x) => x.final_demand_id === f.id);
                const prod = r?.production_state ?? 'READY';
                const pack = r?.packing_state ?? 'WAITING_FOR_PRODUCTION';
                // Two sites both serving Lunch produce two rows that are
                // otherwise identical, and the actions beside them must not be
                // applied to the wrong site's food.
                const where = `${f.institution_name} ${PERIOD_META[f.period].label}`;
                return (
                  <tr key={f.id}>
                    <td>{f.institution_name}</td>
                    <td>{PERIOD_META[f.period].label}</td>
                    <td className="mono">
                      <b>{f.total_quantity}</b>{' '}
                      <span className="cell-sub">
                        {f.standard_quantity} standard + {f.special_quantity} special
                      </span>
                    </td>
                    <td>{prod.replace(/_/g, ' ')}</td>
                    <td>{pack.replace(/_/g, ' ')}</td>
                    <td style={{ textAlign: 'right' }}>
                      {prod === 'READY' && (
                        <Btn
                          variant="brand"
                          disabled={busy}
                          onClick={() =>
                            void run(() => startProduction(f.id), 'Production started.')
                          }
                          aria-label={`Start production — ${where}`}
                        >
                          Start production
                        </Btn>
                      )}
                      {prod === 'IN_PRODUCTION' && (
                        <Btn
                          variant="brand"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => completeProduction(f.id),
                              'Production complete — the exact required quantity was produced.',
                            )
                          }
                          aria-label={`Mark production complete — ${where}`}
                        >
                          Mark production complete
                        </Btn>
                      )}
                      {prod === 'COMPLETE' && pack === 'WAITING_FOR_PRODUCTION' && (
                        <Btn
                          variant="brand"
                          disabled={busy}
                          onClick={() => void run(() => startPacking(f.id), 'Packing started.')}
                          aria-label={`Start packing — ${where}`}
                        >
                          Start packing
                        </Btn>
                      )}
                      {pack === 'PACKING' && (
                        <Btn
                          variant="brand"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => completePacking(f.id),
                              'Packing complete — the exact required packs are ready.',
                            )
                          }
                          aria-label={`Mark packing complete — ${where}`}
                        >
                          Mark packing complete
                        </Btn>
                      )}{' '}
                      <Btn
                        variant="ghost"
                        onClick={() =>
                          setIssueFor({
                            id: f.id,
                            stage: prod === 'COMPLETE' ? 'PACKING' : 'PRODUCTION',
                          })
                        }
                      >
                        Report issue
                      </Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {lines.length > 0 && (
        <Card
          title="Special meals"
          hint="each one confirmed individually — by reference, not by count"
        >
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>For</th>
                <th>Meal</th>
                <th>Preparation</th>
                <th style={{ textAlign: 'right' }}>Confirm</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const meta = specials.find((s) => s.reference === l.reference);
                return (
                  <tr key={l.id}>
                    <td className="mono">
                      <b>{l.reference}</b>
                    </td>
                    <td>
                      {meta ? (
                        <>
                          {meta.child_label}{' '}
                          <span className="cell-sub">
                            {meta.institution_name}
                            {meta.class_name ? ` · ${meta.class_name}` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                    </td>
                    <td>{meta?.meal_name ?? '—'}</td>
                    <td>{l.prep_note ?? meta?.prep_note ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!l.produced_at ? (
                        <Btn
                          variant="brand"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => confirmSpecialProduced(l.id),
                              `${l.reference} confirmed as made.`,
                            )
                          }
                        >
                          Confirm made
                        </Btn>
                      ) : !l.packed_at ? (
                        <Btn
                          variant="brand"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => confirmSpecialPacked(l.id),
                              `${l.reference} confirmed as packed.`,
                            )
                          }
                        >
                          Confirm packed
                        </Btn>
                      ) : (
                        <Pill variant="green">Packed</Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {manifests.length > 0 && (
        <Card
          title="Dispatch"
          hint="name a driver, then release once everything on the run is packed"
        >
          {drivers.length === 0 && (
            <Banner kind="warn">
              No active Driver account exists yet, so no delivery can be released. Create one under
              Users &amp; roles first.
            </Banner>
          )}
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Run</th>
                <th>Window</th>
                <th>State</th>
                <th>Driver</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {manifests.map((m) => {
                // A driver may be changed while the run is still in the yard.
                // Once it has been released the person carrying it is a fact
                // about what happened, and the database refuses to rewrite the
                // rest of the chain around a different name.
                const changeable = m.state === 'PREPARING' || m.state === 'READY_FOR_DISPATCH';
                const assignedName = m.driver_user_id
                  ? (drivers.find((d) => d.user_id === m.driver_user_id)?.full_name ?? 'Assigned')
                  : null;
                const choice = driverChoice[m.id] ?? m.driver_user_id ?? '';
                return (
                  <tr key={m.id}>
                    <td>{m.institution_name}</td>
                    <td>{m.run_number}</td>
                    <td className="cell-sub">
                      {m.window_from
                        ? `${m.window_from.slice(0, 5)}–${(m.window_to ?? '').slice(0, 5)}`
                        : '—'}
                    </td>
                    <td>{m.state.replace(/_/g, ' ')}</td>
                    <td>
                      {assignedName && <Pill variant="green">{assignedName}</Pill>}
                      {changeable && drivers.length > 0 && (
                        <div style={{ marginTop: assignedName ? 6 : 0 }}>
                          <select
                            aria-label={`Driver for ${m.institution_name} run ${m.run_number}`}
                            value={choice}
                            onChange={(e) =>
                              setDriverChoice({ ...driverChoice, [m.id]: e.target.value })
                            }
                          >
                            <option value="">Choose a Driver…</option>
                            {drivers.map((d) => (
                              <option key={d.user_id} value={d.user_id}>
                                {d.full_name}
                              </option>
                            ))}
                          </select>{' '}
                          <Btn
                            size="sm"
                            variant={m.driver_user_id ? 'ghost' : 'brand'}
                            disabled={busy || !choice || choice === m.driver_user_id}
                            onClick={() =>
                              void run(
                                () => assignManifestDriver(m.id, choice),
                                m.driver_user_id ? 'Driver changed.' : 'Driver assigned.',
                              )
                            }
                          >
                            {m.driver_user_id ? 'Change driver' : 'Assign driver'}
                          </Btn>
                        </div>
                      )}
                      {!assignedName && !changeable && <span className="muted">—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Btn variant="ghost" onClick={() => setLabelsFor(m)}>
                        View / print labels
                      </Btn>{' '}
                      {m.state === 'READY_FOR_DISPATCH' &&
                        (m.driver_user_id ? (
                          <Btn
                            variant="brand"
                            disabled={busy}
                            onClick={() =>
                              void run(() => releaseManifest(m.id), 'Released to the driver.')
                            }
                          >
                            Release to driver
                          </Btn>
                        ) : (
                          // Said before the click rather than after it. The
                          // database refuses this too, but a disabled button
                          // with no explanation is a dead end.
                          <span className="muted">Assign a Driver before releasing</span>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {issues.length > 0 && (
        <Card title="Issues" hint="what was raised for this day, and what LunchBox did about it">
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
                  <td style={{ textAlign: 'right' }}>
                    {i.status === 'OPEN' && (
                      <Btn
                        size="sm"
                        variant="brand"
                        disabled={busy}
                        onClick={() => setWorkIssue({ kind: 'action', issue: i })}
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
                        onClick={() => setWorkIssue({ kind: 'close', issue: i })}
                      >
                        Close issue
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            A production or packing issue is internal — the institution never sees it, and it closes
            once actioned. A delivery issue waits for the institution to acknowledge the resolution.
          </p>
        </Card>
      )}

      {workIssue?.kind === 'action' && (
        <IssueActionDialog
          issue={workIssue.issue}
          busy={busy}
          onClose={() => setWorkIssue(null)}
          onAction={(resolution) =>
            run(
              () => advanceIssue(workIssue.issue.id, 'LUNCHBOX_ACTIONED', resolution),
              'Issue actioned.',
            )
          }
        />
      )}

      {workIssue?.kind === 'close' && (
        <IssueCloseDialog
          issue={workIssue.issue}
          busy={busy}
          onClose={() => setWorkIssue(null)}
          onConfirm={(note) =>
            run(() => advanceIssue(workIssue.issue.id, 'CLOSED', note), 'Issue closed.')
          }
        />
      )}

      {issueFor && (
        <IssueDialog
          stage={issueFor.stage}
          busy={busy}
          onClose={() => setIssueFor(null)}
          onReport={(category, description) =>
            run(
              () =>
                reportIssue({
                  stage: issueFor.stage,
                  category,
                  description,
                  date,
                  finalDemandId: issueFor.id,
                }),
              'Issue recorded.',
            )
          }
        />
      )}

      {labelsFor && (
        <LabelsDialog
          manifest={labelsFor}
          lines={mLines[labelsFor.id] ?? []}
          specials={specials.filter((s) => s.institution_name === labelsFor.institution_name)}
          onClose={() => setLabelsFor(null)}
        />
      )}
    </>
  );
}

const PRODUCTION_CATEGORIES = [
  'Operational / Equipment',
  'Ingredient / Supply',
  'Special Meal',
  'Other',
];

function IssueDialog({
  stage,
  busy,
  onClose,
  onReport,
}: {
  stage: string;
  busy: boolean;
  onClose: () => void;
  onReport: (category: string, description: string) => Promise<boolean>;
}) {
  const [category, setCategory] = useState(PRODUCTION_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  return (
    <Modal
      title={`Report a ${stage.toLowerCase()} issue`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="brand"
            disabled={busy || !description.trim()}
            onClick={() => void onReport(category, description)}
          >
            {busy ? 'Saving…' : 'Report issue'}
          </Btn>
        </>
      }
    >
      <Banner kind="info">
        This is the exception path. Normal service is the exact required quantity, so an issue here
        is a real event rather than a daily adjustment.
      </Banner>
      <Field label="Category">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {PRODUCTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="What happened">
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
    </Modal>
  );
}

/**
 * Labels are generated FROM the authoritative records — never retyped. The
 * special label carries the minimum needed to hand the right tray to the right
 * child: first name and last initial plus a unique reference, and the factual
 * preparation restriction. No guardian data, no diagnosis, no severity.
 */
function LabelsDialog({
  manifest,
  lines,
  specials,
  onClose,
}: {
  manifest: DeliveryManifest;
  lines: ManifestLine[];
  specials: KitchenSpecialMeal[];
  onClose: () => void;
}) {
  return (
    <Modal
      title={`Labels — ${manifest.institution_name}, run ${manifest.run_number}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Close
          </Btn>
          <Btn variant="brand" onClick={() => window.print()}>
            Print
          </Btn>
        </>
      }
    >
      <div className="label-sheet">
        {lines.map((l) => (
          <div key={l.id} className="label">
            <div className="label-brand">LunchBox Connect</div>
            <div className="label-main">{manifest.institution_name}</div>
            <div>{PERIOD_META[l.period].label}</div>
            <div className="cell-sub">
              {manifest.service_date} · run {manifest.run_number}
            </div>
            <div className="label-qty">{l.standard_quantity} standard</div>
          </div>
        ))}
        {specials.map((s) => (
          <div key={s.reference} className="label label-special">
            <div className="label-brand">SPECIAL MEAL</div>
            <div className="label-main">{s.child_label}</div>
            <div>
              {s.institution_name}
              {s.class_name ? ` · ${s.class_name}` : ''}
            </div>
            <div>{s.meal_name}</div>
            {s.prep_note && <div className="label-prep">{s.prep_note}</div>}
            <div className="cell-sub">
              {manifest.service_date} · {PERIOD_META[s.period].label}
            </div>
            <div className="label-qty mono">{s.reference}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
