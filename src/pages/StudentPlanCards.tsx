import { useCallback, useEffect, useState } from 'react';
import {
  assignStudentMealPlan,
  dietaryForStudent,
  endStudentMealPlan,
  institutionMealPlans,
  listMealPlans,
  studentMealPlans,
  submitDietaryRequirement,
} from '../lib/api';
import { PERIOD_LABEL, PERIOD_ORDER } from '../lib/periods';
import { operationalToday } from '../lib/format';
import { can } from '../lib/rbac';
import { useRole } from '../lib/auth';
import type {
  DietaryRequirement,
  DietaryRequirementType,
  MealPlan,
  Student,
  StudentMealPlan,
} from '../lib/types';
import { Banner, Btn, Card, EmptyState, Field, Modal, Pill, Spinner } from './../components/ui';

const TYPE_LABEL: Record<string, string> = {
  ALLERGY: 'Allergy',
  DIETARY_RESTRICTION: 'Dietary restriction',
  OTHER_MEAL_REQUIREMENT: 'Other meal requirement',
};

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: 'amber',
  NEEDS_CLARIFICATION: 'amber',
  APPROVED: 'green',
  REJECTED: 'slate',
  ENDED: 'slate',
};

/**
 * A child's entitlement and their dietary record, on their own profile.
 *
 * Two different authorities sit side by side here, and the difference is the
 * point:
 *
 *   * The Meal Plan is LunchBox's. It drives production and, later, commercial
 *     truth, so an Institution Admin READS it and never changes it.
 *   * The dietary requirement is the Institution's to RAISE — they are the ones
 *     who know the child — and LunchBox's to accept. Submitting is not
 *     approving.
 *
 * Both boundaries are enforced in the database. What this component does is
 * avoid offering an action that would only be refused.
 */
export default function StudentPlanCards({ student }: { student: Student }) {
  const role = useRole();
  const mayManagePlan = can(role, 'mealplans', 'update');
  const maySubmitDietary = can(role, 'dietary', 'create');

  const [assignments, setAssignments] = useState<StudentMealPlan[] | null>(null);
  const [available, setAvailable] = useState<MealPlan[]>([]);
  const [dietary, setDietary] = useState<DietaryRequirement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<
    { kind: 'assign' } | { kind: 'end'; row: StudentMealPlan } | { kind: 'dietary' } | null
  >(null);

  const load = useCallback(async () => {
    const [a, d] = await Promise.all([studentMealPlans(student.id), dietaryForStudent(student.id)]);
    if (a.error) setError(a.error);
    setAssignments(a.data ?? []);
    setDietary(d.data ?? []);

    if (mayManagePlan) {
      const [all, allowed] = await Promise.all([
        listMealPlans(),
        institutionMealPlans(student.institution_id),
      ]);
      const ids = new Set(allowed.data ?? []);
      setAvailable((all.data ?? []).filter((p) => p.active && ids.has(p.id)));
    }
  }, [student.id, student.institution_id, mayManagePlan]);

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

  const today = operationalToday();
  const current = (assignments ?? []).find(
    (a) => a.effective_from <= today && (!a.effective_until || a.effective_until >= today),
  );
  const future = (assignments ?? []).filter((a) => a.effective_from > today);

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      <Card
        title="Meal Plan"
        hint="which sittings this child receives"
        actions={
          mayManagePlan ? (
            <Btn variant="brand" onClick={() => setDialog({ kind: 'assign' })}>
              {current ? 'Schedule plan change' : 'Assign Meal Plan'}
            </Btn>
          ) : null
        }
      >
        {assignments === null ? (
          <Spinner />
        ) : !current && future.length === 0 ? (
          <>
            <Banner kind="warn">
              PLAN REQUIRED — this child has no Meal Plan. Until one is assigned they cannot be
              counted into production at an institution where Student Meal Plans are enforced.
            </Banner>
            {!mayManagePlan && (
              <p className="hint">
                LunchBox sets Meal Plans. Ask your LunchBox contact to assign one.
              </p>
            )}
          </>
        ) : (
          <>
            {current && (
              <p>
                <Pill variant="green">{current.meal_plan_name ?? 'Meal Plan'}</Pill> in effect from{' '}
                {current.effective_from}
                {current.effective_until ? ` until ${current.effective_until}` : ''}
              </p>
            )}
            {future.length > 0 && (
              <p>
                <Pill variant="amber">Scheduled</Pill>{' '}
                {future
                  .map((f) => `${f.meal_plan_name ?? 'Plan'} from ${f.effective_from}`)
                  .join(', ')}
              </p>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>From</th>
                    <th>Until</th>
                    {mayManagePlan && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(assignments ?? []).map((a) => (
                    <tr key={a.id}>
                      <td>{a.meal_plan_name ?? '—'}</td>
                      <td>{a.effective_from}</td>
                      <td>{a.effective_until ?? '—'}</td>
                      {mayManagePlan && (
                        <td style={{ textAlign: 'right' }}>
                          {!a.effective_until && (
                            <Btn variant="ghost" onClick={() => setDialog({ kind: 'end', row: a })}>
                              End plan
                            </Btn>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">
              History is never rewritten: changing a plan ends the old one and opens a new one, so
              what a past month meant stays true.
            </p>
          </>
        )}
      </Card>

      <Card
        title="Dietary and meal requirements"
        hint="factual requirements, reviewed by LunchBox"
        actions={
          maySubmitDietary ? (
            <Btn variant="brand" onClick={() => setDialog({ kind: 'dietary' })}>
              Submit dietary / meal requirement
            </Btn>
          ) : null
        }
      >
        {student.medical_notes && student.medical_notes.length > 0 && (
          <Banner kind="warn">
            LEGACY SAFETY NOTE EXISTS — REVIEW REQUIRED. This child carries older free-text notes.
            They are <b>not</b> an authoritative dietary record and nothing has been derived from
            them. Read them and, if they describe a real requirement, submit it here.
          </Banner>
        )}

        {dietary === null ? (
          <Spinner />
        ) : dietary.length === 0 ? (
          <EmptyState text="No dietary or meal requirements recorded." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Requirement</th>
                  <th>In force</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dietary.map((d) => (
                  <tr key={d.id}>
                    <td>{TYPE_LABEL[d.requirement_type]}</td>
                    <td>
                      {d.requirement_text}
                      {d.review_note && <div className="cell-sub">LunchBox: {d.review_note}</div>}
                    </td>
                    <td>
                      {d.effective_from}
                      {d.effective_until ? ` – ${d.effective_until}` : ''}
                    </td>
                    <td>
                      <Pill variant={STATUS_TONE[d.review_status] ?? 'slate'}>
                        {d.review_status.replace(/_/g, ' ').toLowerCase()}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">
          A requirement is a factual operational statement. It carries no severity and no diagnosis,
          and the software draws no conclusion from it — a person decides each meal.
        </p>
      </Card>

      {dialog?.kind === 'assign' && (
        <AssignDialog
          plans={available}
          busy={busy}
          onClose={() => setDialog(null)}
          onAssign={(planId, from, note) =>
            run(
              () => assignStudentMealPlan({ studentId: student.id, planId, from, note }),
              'Meal Plan assigned.',
            )
          }
        />
      )}

      {dialog?.kind === 'end' && (
        <EndDialog
          row={dialog.row}
          busy={busy}
          onClose={() => setDialog(null)}
          onEnd={(until, reason) =>
            run(() => endStudentMealPlan(dialog.row.id, until, reason), 'Meal Plan ended.')
          }
        />
      )}

      {dialog?.kind === 'dietary' && (
        <DietaryDialog
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={(type, text, source) =>
            run(
              () => submitDietaryRequirement({ studentId: student.id, type, text, source }),
              'Submitted to LunchBox for review.',
            )
          }
        />
      )}
    </>
  );
}

function AssignDialog({
  plans,
  busy,
  onClose,
  onAssign,
}: {
  plans: MealPlan[];
  busy: boolean;
  onClose: () => void;
  onAssign: (planId: string, from: string, note: string | null) => Promise<boolean>;
}) {
  const [planId, setPlanId] = useState('');
  const [from, setFrom] = useState(operationalToday());
  const [note, setNote] = useState('');

  return (
    <Modal
      title="Assign Meal Plan"
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="brand"
            disabled={!planId || busy}
            onClick={() => void onAssign(planId, from, note || null)}
          >
            {busy ? 'Saving…' : 'Assign'}
          </Btn>
        </>
      }
    >
      {plans.length === 0 ? (
        <Banner kind="warn">
          No Meal Plans are available at this child&rsquo;s institution yet. Make one available on
          the Meal Plans screen first.
        </Banner>
      ) : (
        <>
          <Field label="Meal Plan">
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} autoFocus>
              <option value="">Select…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} —{' '}
                  {PERIOD_ORDER.filter((x) => p.periods.includes(x))
                    .map((x) => PERIOD_LABEL[x])
                    .join(', ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Effective from">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <p className="hint">
            A future date schedules the change. Any plan currently open is ended the day before, so
            the two never overlap.
          </p>
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </>
      )}
    </Modal>
  );
}

function EndDialog({
  row,
  busy,
  onClose,
  onEnd,
}: {
  row: StudentMealPlan;
  busy: boolean;
  onClose: () => void;
  onEnd: (until: string, reason: string | null) => Promise<boolean>;
}) {
  const [until, setUntil] = useState(operationalToday());
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={`End ${row.meal_plan_name ?? 'Meal Plan'}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="danger" disabled={busy} onClick={() => void onEnd(until, reason || null)}>
            {busy ? 'Saving…' : 'End plan'}
          </Btn>
        </>
      }
    >
      <Banner kind="info">
        Ending a plan closes it on the date you choose. Everything it covered up to that date stays
        exactly as it was.
      </Banner>
      <Field label="Last day covered">
        <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
      </Field>
      <Field label="Reason (optional — recorded in Audit)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

function DietaryDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (type: DietaryRequirementType, text: string, source: string | null) => Promise<boolean>;
}) {
  const [type, setType] = useState<DietaryRequirementType>('ALLERGY');
  const [text, setText] = useState('');
  const [source, setSource] = useState('');

  return (
    <Modal
      title="Submit dietary / meal requirement"
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="brand"
            disabled={busy || !text.trim()}
            onClick={() => void onSubmit(type, text, source || null)}
          >
            {busy ? 'Submitting…' : 'Submit for review'}
          </Btn>
        </>
      }
    >
      <Banner kind="info">
        Describe the requirement factually — what this child must not be served, or must be served
        instead. LunchBox reviews it and then decides each meal individually. Submitting is not
        approval, and nothing changes for this child until it is reviewed.
      </Banner>
      <Field label="Type">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DietaryRequirementType)}
          autoFocus
        >
          <option value="ALLERGY">Allergy</option>
          <option value="DIETARY_RESTRICTION">Dietary restriction</option>
          <option value="OTHER_MEAL_REQUIREMENT">Other meal requirement</option>
        </select>
      </Field>
      <Field label="Requirement">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. No dairy in any meal."
        />
      </Field>
      <Field label="Where this came from (optional)">
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. parent enrolment form"
        />
      </Field>
    </Modal>
  );
}
