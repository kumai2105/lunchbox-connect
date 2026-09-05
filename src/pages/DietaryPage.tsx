import { useCallback, useEffect, useState } from 'react';
import {
  dietaryReviewQueue,
  endDietaryRequirement,
  getStudent,
  listMeals,
  resolveSpecialMeal,
  reviewDietaryRequirement,
  unresolvedDecisions,
  demandForDate,
} from '../lib/api';
import { PERIOD_LABEL } from '../lib/periods';
import { operationalToday } from '../lib/format';
import type {
  DemandRow,
  DietaryRequirement,
  MealLibraryItem,
  UnresolvedDecision,
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

const TYPE_LABEL: Record<string, string> = {
  ALLERGY: 'Allergy',
  DIETARY_RESTRICTION: 'Dietary restriction',
  OTHER_MEAL_REQUIREMENT: 'Other meal requirement',
};

/**
 * DIETARY REVIEW AND SPECIAL MEALS.
 *
 * Two queues, because they are two different decisions:
 *
 *   1. Is this requirement accepted? (review)
 *   2. Given an accepted requirement, what does this child actually eat for
 *      THIS service? (resolution)
 *
 * The second is the one that blocks production. A child with an approved
 * requirement and no recorded decision stops the day being finalised, and that
 * is deliberate: nobody should be cooking while it is unknown what one of the
 * children is being served.
 *
 * Nothing here claims a meal is "safe". The software records a human's
 * decision and who made it; it does not evaluate ingredient text.
 */
export default function DietaryPage() {
  const [queue, setQueue] = useState<DietaryRequirement[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [date, setDate] = useState(operationalToday());
  const [services, setServices] = useState<DemandRow[]>([]);
  const [pending, setPending] = useState<Record<string, UnresolvedDecision[]>>({});
  const [meals, setMeals] = useState<MealLibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: 'review'; req: DietaryRequirement }
    | { kind: 'resolve'; serviceId: string; row: UnresolvedDecision; mealName: string | null }
    | null
  >(null);

  const load = useCallback(async () => {
    const q = await dietaryReviewQueue();
    if (q.error) setError(q.error);
    setQueue(q.data ?? []);

    // Name each child once rather than per row.
    const ids = [...new Set((q.data ?? []).map((r) => r.student_id))];
    const resolved: Record<string, string> = {};
    await Promise.all(
      ids.map(async (id) => {
        const s = await getStudent(id);
        if (s.data) resolved[id] = `${s.data.given_name} ${s.data.family_name}`;
      }),
    );
    setNames(resolved);
  }, []);

  const loadDay = useCallback(async () => {
    const d = await demandForDate(date);
    if (d.error) {
      setError(d.error);
      setServices([]);
      return;
    }
    const rows = d.data ?? [];
    setServices(rows);
    const map: Record<string, UnresolvedDecision[]> = {};
    await Promise.all(
      rows
        .filter((r) => r.unresolved_decisions > 0)
        .map(async (r) => {
          const u = await unresolvedDecisions(r.meal_service_id);
          map[r.meal_service_id] = u.data ?? [];
        }),
    );
    setPending(map);
  }, [date]);

  useEffect(() => {
    void load();
    void listMeals().then((r) => setMeals((r.data ?? []).filter((m) => m.active)));
  }, [load]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

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
    await Promise.all([load(), loadDay()]);
    return true;
  }

  const blocking = services.filter((s) => s.unresolved_decisions > 0);

  return (
    <>
      <PageHead
        title="Dietary review"
        hint="Accept a requirement, then decide what the child is actually served"
      />

      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      <Banner kind="info">
        This record is deliberately factual:{' '}
        <b>no severity, no diagnosis, no automatic conclusion</b> from ingredient text. A meal is
        decided by a person, and this screen records who decided and when.
      </Banner>

      <Card
        title="Meal decisions blocking production"
        hint={`Service date ${date}`}
        actions={<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
      >
        {blocking.length === 0 ? (
          <EmptyState text="Every child with an approved requirement has a recorded meal decision for this date." />
        ) : (
          blocking.map((s) => (
            <div key={s.meal_service_id} style={{ marginBottom: 18 }}>
              <h4>
                {s.institution_name} — {PERIOD_LABEL[s.period]}{' '}
                <span className="muted">{s.meal_name ?? 'no meal resolved'}</span>
              </h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Requirement</th>
                      <th style={{ textAlign: 'right' }}>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pending[s.meal_service_id] ?? []).map((u) => (
                      <tr key={u.student_id}>
                        <td>
                          {u.student_name} <span className="muted">{u.student_no}</span>
                        </td>
                        <td>
                          <Pill variant="amber">{TYPE_LABEL[u.requirement_type]}</Pill>{' '}
                          {u.requirement_text}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Btn
                            variant="brand"
                            onClick={() =>
                              setDialog({
                                kind: 'resolve',
                                serviceId: s.meal_service_id,
                                row: u,
                                mealName: s.meal_name,
                              })
                            }
                          >
                            Decide meal
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card title="Requirements awaiting review">
        {queue === null ? (
          <Spinner />
        ) : queue.length === 0 ? (
          <EmptyState text="Nothing awaiting review." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Requirement</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => (
                  <tr key={r.id}>
                    <td>{names[r.student_id] ?? '…'}</td>
                    <td>
                      <Pill variant="amber">{TYPE_LABEL[r.requirement_type]}</Pill>
                    </td>
                    <td>{r.requirement_text}</td>
                    <td>{r.submitted_at.slice(0, 10)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Btn variant="brand" onClick={() => setDialog({ kind: 'review', req: r })}>
                        Review
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog?.kind === 'review' && (
        <ReviewDialog
          req={dialog.req}
          name={names[dialog.req.student_id] ?? ''}
          busy={busy}
          onClose={() => setDialog(null)}
          onDecide={(status, note) =>
            run(
              () => reviewDietaryRequirement(dialog.req.id, status, note),
              `Requirement ${status.toLowerCase().replace('_', ' ')}.`,
            )
          }
          onEnd={(reason) =>
            run(() => endDietaryRequirement(dialog.req.id, reason), 'Requirement ended.')
          }
        />
      )}

      {dialog?.kind === 'resolve' && (
        <ResolveDialog
          row={dialog.row}
          standardMeal={dialog.mealName}
          meals={meals}
          busy={busy}
          onClose={() => setDialog(null)}
          onResolve={(kind, revisionId, prep) =>
            run(
              () =>
                resolveSpecialMeal({
                  studentId: dialog.row.student_id,
                  serviceId: dialog.serviceId,
                  kind,
                  revisionId,
                  prepNote: prep,
                }),
              kind === 'ALTERNATIVE_ASSIGNED'
                ? 'Special meal assigned.'
                : 'Standard meal confirmed for this child.',
            )
          }
        />
      )}
    </>
  );
}

function ReviewDialog({
  req,
  name,
  busy,
  onClose,
  onDecide,
  onEnd,
}: {
  req: DietaryRequirement;
  name: string;
  busy: boolean;
  onClose: () => void;
  onDecide: (
    status: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED',
    note: string | null,
  ) => Promise<boolean>;
  onEnd: (reason: string | null) => Promise<boolean>;
}) {
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`Review requirement — ${name}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="ghost" disabled={busy} onClick={() => void onEnd(note || null)}>
            End requirement
          </Btn>
          <Btn
            variant="ghost"
            disabled={busy}
            onClick={() => void onDecide('REJECTED', note || null)}
          >
            Reject
          </Btn>
          <Btn
            variant="amber"
            disabled={busy}
            onClick={() => void onDecide('NEEDS_CLARIFICATION', note || null)}
          >
            Needs clarification
          </Btn>
          <Btn
            variant="brand"
            disabled={busy}
            onClick={() => void onDecide('APPROVED', note || null)}
          >
            {busy ? 'Saving…' : 'Approve'}
          </Btn>
        </>
      }
    >
      <p>
        <b>{TYPE_LABEL[req.requirement_type]}</b>
      </p>
      <p>{req.requirement_text}</p>
      {req.source && <p className="hint">Source: {req.source}</p>}
      <p className="hint">In force from {req.effective_from}</p>
      <Banner kind="info">
        Approving means LunchBox accepts this as an operational requirement. It does <b>not</b>{' '}
        decide any individual meal — that is the next decision, per service.
      </Banner>
      <Field label="Note (recorded with the decision)">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

function ResolveDialog({
  row,
  standardMeal,
  meals,
  busy,
  onClose,
  onResolve,
}: {
  row: UnresolvedDecision;
  standardMeal: string | null;
  meals: MealLibraryItem[];
  busy: boolean;
  onClose: () => void;
  onResolve: (
    kind: 'STANDARD_CONFIRMED' | 'ALTERNATIVE_ASSIGNED',
    revisionId: string | null,
    prep: string | null,
  ) => Promise<boolean>;
}) {
  const [revisionId, setRevisionId] = useState('');
  const [prep, setPrep] = useState('');

  return (
    <Modal
      title={`Meal decision — ${row.student_name}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="ghost"
            disabled={busy}
            onClick={() => void onResolve('STANDARD_CONFIRMED', null, null)}
          >
            Confirm standard meal
          </Btn>
          <Btn
            variant="brand"
            disabled={busy || !revisionId}
            onClick={() => void onResolve('ALTERNATIVE_ASSIGNED', revisionId, prep || null)}
          >
            {busy ? 'Saving…' : 'Assign special meal'}
          </Btn>
        </>
      }
    >
      <p>
        <Pill variant="amber">{TYPE_LABEL[row.requirement_type]}</Pill> {row.requirement_text}
      </p>
      <Banner kind="info">
        The standard meal for this service is <b>{standardMeal ?? 'not resolved'}</b>. Confirming it
        is a decision that is recorded against you — it is not a default.
      </Banner>
      <Field label="Alternative meal (from the Meal Library)">
        <select value={revisionId} onChange={(e) => setRevisionId(e.target.value)}>
          <option value="">Select…</option>
          {meals
            .filter((m) => m.current_revision_id)
            .map((m) => (
              <option key={m.id} value={m.current_revision_id as string}>
                {m.name}
              </option>
            ))}
        </select>
      </Field>
      <p className="hint">
        The alternative must already exist in the Meal Library. If it does not, add it there first —
        nothing invisible goes on a child&rsquo;s tray.
      </p>
      <Field label="Preparation note (factual, printed on the special label)">
        <input value={prep} onChange={(e) => setPrep(e.target.value)} />
      </Field>
    </Modal>
  );
}
