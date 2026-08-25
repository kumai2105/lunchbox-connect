import { useCallback, useEffect, useState } from 'react';
import {
  activateStudentMealPlans,
  institutionMealPlans,
  listInstitutions,
  listMealPlans,
  planReadiness,
  retireMealPlan,
  saveMealPlan,
  setInstitutionMealPlans,
} from '../lib/api';
import { PERIOD_LABEL, PERIOD_ORDER } from '../lib/periods';
import type { AppPeriod, Institution, MealPlan, PlanReadinessRow } from '../lib/types';
import { operationalToday } from '../lib/format';
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
 * MEAL PLANS — what a child receives, as distinct from what the site offers.
 *
 * Three things live here because they are one operator task:
 *   1. define the Plans,
 *   2. say which Plans a given Institution may use,
 *   3. switch that Institution over to entitlement-driven production.
 *
 * (3) is the careful one. It refuses while any child who would be served has
 * no valid Plan, and it says exactly who — so the readiness list below is the
 * screen's real content, not a warning banner.
 */
export default function MealPlansPage() {
  const [plans, setPlans] = useState<MealPlan[] | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [dialog, setDialog] = useState<
    | { kind: 'plan'; plan: MealPlan | null }
    | { kind: 'availability'; institution: Institution }
    | { kind: 'activate'; institution: Institution }
    | null
  >(null);

  const load = useCallback(async () => {
    const [p, i] = await Promise.all([listMealPlans(), listInstitutions()]);
    if (p.error) setError(p.error);
    else setPlans(p.data ?? []);
    if (i.data) setInstitutions(i.data.filter((x) => x.active !== false));
  }, []);

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

  return (
    <>
      <PageHead
        title="Meal Plans"
        hint="Which Meal Periods a child receives — separate from the Menu, and separate from what the site offers"
        actions={
          <Btn variant="brand" onClick={() => setDialog({ kind: 'plan', plan: null })}>
            + Create Meal Plan
          </Btn>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      <Banner kind="info">
        A Meal Plan is a <b>service entitlement</b>, not a commercial package — it carries no price
        and no billing. Two children in the same Class may hold different Plans and eat from the
        same Menu.
      </Banner>

      <Card title="Plans">
        {plans === null ? (
          <Spinner />
        ) : plans.length === 0 ? (
          <EmptyState text="No Meal Plans yet. Create one to describe what a child receives." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Meal Periods</th>
                  <th>State</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      {PERIOD_ORDER.filter((x) => p.periods.includes(x))
                        .map((x) => PERIOD_LABEL[x])
                        .join(' · ') || '—'}
                    </td>
                    <td>
                      <Pill variant={p.active ? 'green' : 'slate'}>
                        {p.active ? 'Available' : 'Retired'}
                      </Pill>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Btn variant="ghost" onClick={() => setDialog({ kind: 'plan', plan: p })}>
                        Edit
                      </Btn>
                      <Btn
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => retireMealPlan(p.id, !p.active),
                            p.active ? 'Meal Plan retired.' : 'Meal Plan made available again.',
                          )
                        }
                      >
                        {p.active ? 'Retire' : 'Reinstate'}
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Institutions">
        {institutions.length === 0 ? (
          <EmptyState text="No active institutions." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Student Plans</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td>
                      {i.student_plan_enforced_from ? (
                        <Pill variant="green">Enforced from {i.student_plan_enforced_from}</Pill>
                      ) : (
                        <Pill variant="slate">Not activated — legacy demand</Pill>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Btn
                        variant="ghost"
                        onClick={() => setDialog({ kind: 'availability', institution: i })}
                      >
                        Available Plans
                      </Btn>
                      {!i.student_plan_enforced_from && (
                        <Btn
                          variant="brand"
                          onClick={() => setDialog({ kind: 'activate', institution: i })}
                        >
                          Activate Student Meal Plans
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

      {dialog?.kind === 'plan' && (
        <PlanDialog
          plan={dialog.plan}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={(name, periods) =>
            run(
              () => saveMealPlan({ id: dialog.plan?.id ?? null, name, periods }),
              dialog.plan ? 'Meal Plan saved.' : 'Meal Plan created.',
            )
          }
        />
      )}

      {dialog?.kind === 'availability' && (
        <AvailabilityDialog
          institution={dialog.institution}
          plans={plans ?? []}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={(ids) =>
            run(
              () => setInstitutionMealPlans(dialog.institution.id, ids),
              'Available Meal Plans updated.',
            )
          }
        />
      )}

      {dialog?.kind === 'activate' && (
        <ActivateDialog
          institution={dialog.institution}
          busy={busy}
          onClose={() => setDialog(null)}
          onActivate={(from) =>
            run(
              () => activateStudentMealPlans(dialog.institution.id, from),
              'Student Meal Plans are now authoritative for production at this institution.',
            )
          }
        />
      )}
    </>
  );
}

function PlanDialog({
  plan,
  busy,
  onClose,
  onSave,
}: {
  plan: MealPlan | null;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string, periods: AppPeriod[]) => Promise<boolean>;
}) {
  const [name, setName] = useState(plan?.name ?? '');
  const [periods, setPeriods] = useState<AppPeriod[]>(plan?.periods ?? []);
  const valid = name.trim().length > 0 && periods.length > 0;

  return (
    <Modal
      title={plan ? `Edit ${plan.name}` : 'Create Meal Plan'}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="brand" disabled={!valid || busy} onClick={() => void onSave(name, periods)}>
            {busy ? 'Saving…' : 'Save Meal Plan'}
          </Btn>
        </>
      }
    >
      {plan && (
        <Banner kind="info">
          A Plan already assigned to Students may be <b>renamed</b>, but the Meal Periods it
          contains are fixed — changing them would rewrite what past assignments meant. Create a new
          Plan and schedule a change instead.
        </Banner>
      )}
      <Field label="Plan name">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Meal Periods included">
        <div className="check-row">
          {PERIOD_ORDER.map((p) => (
            <label key={p} className="check">
              <input
                type="checkbox"
                checked={periods.includes(p)}
                onChange={(e) =>
                  setPeriods(e.target.checked ? [...periods, p] : periods.filter((x) => x !== p))
                }
              />
              {PERIOD_LABEL[p]}
            </label>
          ))}
        </div>
      </Field>
      {!valid && <p className="hint">A Plan needs a name and at least one Meal Period.</p>}
    </Modal>
  );
}

function AvailabilityDialog({
  institution,
  plans,
  busy,
  onClose,
  onSave,
}: {
  institution: Institution;
  plans: MealPlan[];
  busy: boolean;
  onClose: () => void;
  onSave: (ids: string[]) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<string[] | null>(null);

  useEffect(() => {
    void institutionMealPlans(institution.id).then((r) => setSelected(r.data ?? []));
  }, [institution.id]);

  return (
    <Modal
      title={`Meal Plans available at ${institution.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="brand"
            disabled={selected === null || busy}
            onClick={() => void onSave(selected ?? [])}
          >
            {busy ? 'Saving…' : 'Save'}
          </Btn>
        </>
      }
    >
      <Banner kind="info">
        Availability is a precondition for assigning a Plan to a child here. Removing a Plan that
        children are still on is refused — end or replace those assignments first.
      </Banner>
      {selected === null ? (
        <Spinner />
      ) : plans.filter((p) => p.active).length === 0 ? (
        <EmptyState text="No available Meal Plans to offer. Create one first." />
      ) : (
        <div className="check-col">
          {plans
            .filter((p) => p.active)
            .map((p) => (
              <label key={p.id} className="check">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id),
                    )
                  }
                />
                {p.name}
                <span className="muted">
                  {' '}
                  —{' '}
                  {PERIOD_ORDER.filter((x) => p.periods.includes(x))
                    .map((x) => PERIOD_LABEL[x])
                    .join(', ')}
                </span>
              </label>
            ))}
        </div>
      )}
    </Modal>
  );
}

/**
 * The activation gate. It deliberately shows the readiness list BEFORE offering
 * the button: the operator's real task is fixing the roster, and a refusal
 * message alone would send them hunting for who is missing.
 */
function ActivateDialog({
  institution,
  busy,
  onClose,
  onActivate,
}: {
  institution: Institution;
  busy: boolean;
  onClose: () => void;
  onActivate: (from: string) => Promise<boolean>;
}) {
  const today = operationalToday();
  const [from, setFrom] = useState(today);
  const [rows, setRows] = useState<PlanReadinessRow[] | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const r = await planReadiness(institution.id, from);
    setRows(r.data ?? []);
    setChecking(false);
  }, [institution.id, from]);

  useEffect(() => {
    void check();
  }, [check]);

  const ready = rows !== null && rows.length === 0;

  return (
    <Modal
      title={`Activate Student Meal Plans — ${institution.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="brand" disabled={!ready || busy} onClick={() => void onActivate(from)}>
            {busy ? 'Activating…' : 'Activate Student Meal Plans'}
          </Btn>
        </>
      }
    >
      <Banner kind="info">
        Before this date, production keeps its existing behaviour for this institution. On and after
        it, a child is produced for only when their Meal Plan includes that sitting.
      </Banner>
      <Field label="Enforce from">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>

      {checking || rows === null ? (
        <Spinner />
      ) : ready ? (
        <Banner kind="ok">
          Every operationally active Student has a valid Meal Plan covering {from}.
        </Banner>
      ) : (
        <>
          <Banner kind="err">
            {rows.length} Student{rows.length === 1 ? '' : 's'} cannot be served on {from} yet.
            Activation is refused until each one has a valid Plan.
          </Banner>
          <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>What is missing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student_id}>
                    <td>
                      {r.student_name} <span className="muted">{r.student_no}</span>
                    </td>
                    <td>{r.class_name ?? '—'}</td>
                    <td>{r.problem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
