import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listClasses,
  mealsForDates,
  notesForServing,
  recordServing,
  rosterForClass,
  serviceRoster,
  servingForDay,
  studentPhotoUrl,
  setConcernObserved,
  upsertServingNote,
  type ClassWithMeta,
  type DayMeal,
  type MealObservationInput,
} from '../lib/api';
import type {
  AppPeriod,
  ConsumptionPct,
  EatingBehavior,
  LowIntakeReason,
  ServingNote,
  ServingRecord,
  Student,
} from '../lib/types';
import { CONSUMPTION_VALUES, NON_PREFERENCE_LOW_INTAKE_REASONS } from '../lib/types';
import {
  Avatar,
  Btn,
  Banner,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHead,
  Spinner,
} from '../components/ui';
import {
  BEHAVIOR_LABEL,
  LOW_INTAKE_REASON_LABEL,
  isLowIntake,
  isNonPreferenceReason,
} from '../lib/mealAnalytics';
import { initials, todayISO } from '../lib/format';
import { Icon, type IconName } from '../components/icons';

// §19: meal-time configuration is not an approved feature, so no fabricated
// clock times are shown. Periods are ordered, not time-stamped.
const PERIOD_META: Array<{ period: AppPeriod; label: string }> = [
  { period: 'breakfast', label: 'Breakfast' },
  { period: 'snack', label: 'Snack' },
  { period: 'lunch', label: 'Lunch' },
  { period: 'afternoon_snack', label: 'Afternoon snack' },
];

interface Draft {
  pct: ConsumptionPct | null;
  behavior: EatingBehavior | null;
  reason: LowIntakeReason | null;
  concern: boolean;
}

const BLANK_DRAFT: Draft = { pct: null, behavior: null, reason: null, concern: false };

function draftFromRecord(rec: ServingRecord | undefined): Draft {
  if (!rec) return BLANK_DRAFT;
  return {
    pct: rec.consumption_pct,
    behavior: rec.behavior,
    reason: rec.low_intake_reason,
    concern: rec.concern_observed,
  };
}

export default function TodayPage() {
  const [params, setParams] = useSearchParams();
  const classId = params.get('class') ?? '';

  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [roster, setRoster] = useState<Student[] | null>(null);
  /**
   * Which children on this roster are entitled to the CURRENT sitting, and
   * what each one actually receives. A child whose Meal Plan excludes this
   * period is not recorded here at all — they are not absent, not 0%, and not
   * an incomplete entry. `null` while unknown, so the register never briefly
   * renders a child it is about to remove.
   */
  const [entitlement, setEntitlement] = useState<Record<
    string,
    { entitled: boolean; mealName: string | null; specialRef: string | null; pending: boolean }
  > | null>(null);
  const [records, setRecords] = useState<ServingRecord[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});
  const [notes, setNotes] = useState<Record<string, ServingNote>>({});
  // §2/§35: the periods a class can record are exactly the ones with a PUBLISHED
  // Meal Service for the institution on this date — never a fixed four. A
  // 3-meal nursery simply has no Afternoon Snack service, so it is neither
  // shown nor recordable.
  const [dayServices, setDayServices] = useState<DayMeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [period, setPeriod] = useState<AppPeriod>('breakfast');
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  useEffect(() => {
    void listClasses().then((res) => {
      if (res.error) setError(res.error);
      setClasses(res.data ?? []);
    });
  }, []);

  // The dated schedule is per institution, so the Meal Service lookup needs
  // the institution the selected class belongs to. Declared before the effect
  // that reads it.
  const institutionId = classes.find((c) => c.id === classId)?.institution_id ?? null;

  useEffect(() => {
    if (!classId) return;
    let active = true;
    void (async () => {
      const today = todayISO();
      const [r, s, svc] = await Promise.all([
        rosterForClass(classId),
        servingForDay(classId, today, period),
        // The published, dated Meal Services for this class's institution today.
        // These decide which periods are recordable AND carry the service id
        // each observation must link to. Nothing published ⇒ nothing to record.
        institutionId
          ? mealsForDates(today, today, institutionId)
          : Promise.resolve({ data: [] as DayMeal[], error: null }),
      ]);
      if (!active) return;
      if (r.error || s.error || svc.error) setError(r.error ?? s.error ?? svc.error);
      setRoster(r.data ?? []);
      setRecords(s.data ?? []);
      setDayServices(svc.data ?? []);
      setIndex(0);

      const urls: Record<string, string | null> = {};
      await Promise.all(
        (r.data ?? []).map(async (st) => {
          urls[st.id] = await studentPhotoUrl(st.photo_path);
        }),
      );
      if (active) setPhotoUrls(urls);
    })();
    return () => {
      active = false;
    };
    // institutionId belongs here: it is derived from `classes`, which loads
    // asynchronously. Without it, a page opened with ?class= already set
    // resolves institutionId as null on the first run and never retries, so
    // every observation that session would be saved with no Meal Service link.
  }, [classId, period, institutionId]);

  const byStudent = useMemo(() => {
    const map: Record<string, ServingRecord> = {};
    records.forEach((r) => (map[r.student_id] = r));
    return map;
  }, [records]);

  // Only periods that actually have a published Meal Service today (§2/§35).
  const availablePeriods = useMemo(
    () => PERIOD_META.filter((p) => (dayServices ?? []).some((s) => s.period === p.period)),
    [dayServices],
  );
  const currentService = (dayServices ?? []).find((s) => s.period === period) ?? null;
  const mealServiceId = currentService?.service_id ?? null;

  // Keep the selected period on a published one. If the current selection has
  // no service (e.g. a nursery with no Afternoon Snack), fall back to the first
  // period that does — never leave the register pointed at an unpublished slot.
  useEffect(() => {
    if (!dayServices) return;
    if (availablePeriods.length > 0 && !availablePeriods.some((p) => p.period === period)) {
      setPeriod(availablePeriods[0].period);
    }
  }, [dayServices, availablePeriods, period]);

  // service_roster() is the single source for "who is on this service and what
  // do they get" — the same function the Parent view resolves through, so the
  // two cannot disagree about a child's entitlement.
  useEffect(() => {
    let active = true;
    if (!mealServiceId) {
      setEntitlement(null);
      return;
    }
    void serviceRoster(mealServiceId).then((res) => {
      if (!active) return;
      const map: Record<
        string,
        { entitled: boolean; mealName: string | null; specialRef: string | null; pending: boolean }
      > = {};
      (res.data ?? []).forEach((r) => {
        map[r.student_id] = {
          entitled: r.entitled,
          mealName: r.actual_meal_name,
          specialRef: r.special_reference,
          pending: r.decision_pending,
        };
      });
      setEntitlement(map);
    });
    return () => {
      active = false;
    };
  }, [mealServiceId]);

  const classLabel = classes.find((c) => c.id === classId)?.name ?? classId;

  /**
   * THE REGISTER'S ROSTER. Entitlement-filtered, and everything below counts
   * from this rather than from the class list: the strip, the completion
   * count, the next/previous navigation and the current child.
   *
   * Before entitlement is known this is empty rather than the full class, so
   * the register never shows a child for one frame and then removes them.
   */
  const servingRoster = useMemo(() => {
    if (!roster) return null;
    if (!entitlement) return [];
    return roster.filter((s) => entitlement[s.id]?.entitled);
  }, [roster, entitlement]);

  /** Children on the class list who are simply not on this sitting. */
  const notOnThisSitting = useMemo(() => {
    if (!roster || !entitlement) return [];
    return roster.filter((s) => entitlement[s.id] && !entitlement[s.id].entitled);
  }, [roster, entitlement]);

  const recordedCount = servingRoster?.filter((s) => byStudent[s.id]).length ?? 0;
  const student = servingRoster?.[index] ?? null;
  const noServiceToday = dayServices !== null && availablePeriods.length === 0;

  useEffect(() => {
    setDraft(draftFromRecord(student ? byStudent[student.id] : undefined));
  }, [student, byStudent]);

  async function refreshRecords() {
    const fresh = await servingForDay(classId, todayISO(), period);
    if (fresh.data) setRecords(fresh.data);
    const n = await notesForServing(fresh.data?.map((x) => x.id) ?? []);
    const map: Record<string, ServingNote> = {};
    (n.data ?? []).forEach((note) => (map[note.serving_record_id] = note));
    setNotes(map);
  }

  async function save(input: Partial<MealObservationInput>) {
    if (!student) return;
    setSaving(true);
    const res = await recordServing(
      classId,
      [
        {
          student_id: student.id,
          period,
          served_status: 'served',
          meal_service_id: mealServiceId,
          ...input,
        },
      ],
      todayISO(),
    );
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    await refreshRecords();
    return true;
  }

  function goToNextUnrecorded(fromIndex: number) {
    if (!servingRoster) return;
    for (let i = fromIndex + 1; i < servingRoster.length; i++) {
      if (!byStudent[servingRoster[i].id]) {
        setIndex(i);
        return;
      }
    }
    for (let i = 0; i < servingRoster.length; i++) {
      if (!byStudent[servingRoster[i].id]) {
        setIndex(i);
        return;
      }
    }
    // everyone recorded — just move forward if possible
    if (fromIndex + 1 < servingRoster.length) setIndex(fromIndex + 1);
  }

  async function selectPct(pct: ConsumptionPct) {
    setDraft((d) => ({ ...d, pct, reason: isLowIntake(pct) ? d.reason : null }));
  }

  async function selectBehavior(behavior: EatingBehavior) {
    const nextDraft = { ...draft, behavior };
    setDraft(nextDraft);
    // Fast path: normal/adequate intake saves immediately on behavior tap
    // (docs/13 Decision 032 §20 — "tap % → tap behaviour → done").
    if (!isLowIntake(nextDraft.pct)) {
      const ok = await save({
        consumption_pct: nextDraft.pct,
        behavior,
        low_intake_reason: null,
        concern_observed: nextDraft.concern,
      });
      if (ok) goToNextUnrecorded(index);
    }
  }

  /**
   * Saves a LOW-intake result with no reason at all.
   *
   * A low-intake reason is OPTIONAL in the approved rules, but the screen only
   * ever saved from `selectReason`, so after "0% → Refused" the staff member
   * had no way forward except to pick a reason they may not have. That made an
   * optional field mandatory in practice — and invited a guessed reason, which
   * is worse than none. Reason chips remain available as quick context.
   */
  async function saveWithoutReason() {
    const ok = await save({
      consumption_pct: draft.pct,
      behavior: draft.behavior,
      low_intake_reason: null,
      concern_observed: draft.concern,
    });
    if (ok) goToNextUnrecorded(index);
  }

  async function selectReason(reason: LowIntakeReason) {
    const nextDraft = { ...draft, reason };
    setDraft(nextDraft);
    const ok = await save({
      consumption_pct: nextDraft.pct,
      behavior: nextDraft.behavior,
      low_intake_reason: reason,
      concern_observed: nextDraft.concern,
    });
    if (ok) goToNextUnrecorded(index);
  }

  async function markNotServed() {
    const ok = await save({
      served_status: 'not_served',
      consumption_pct: null,
      behavior: null,
      low_intake_reason: null,
      concern_observed: draft.concern,
    });
    if (ok) goToNextUnrecorded(index);
  }

  // §6: Absent / Unwell / Asleep are recorded in ONE tap, with no contradictory
  // eating behaviour or consumption reading. The meal was served (available) but
  // the child did not eat it for a non-preference reason, so it is excluded from
  // intake analytics and never rendered to a parent as "Ate independently".
  async function saveException(reason: LowIntakeReason) {
    const ok = await save({
      served_status: 'served',
      consumption_pct: null,
      behavior: null,
      low_intake_reason: reason,
      concern_observed: false,
    });
    if (ok) goToNextUnrecorded(index);
  }

  async function saveExceptionNow() {
    const ok = await save({
      consumption_pct: draft.pct,
      behavior: draft.behavior,
      low_intake_reason: draft.reason,
      concern_observed: draft.concern,
    });
    if (ok) goToNextUnrecorded(index);
  }

  function openNoteModal() {
    if (!student) return;
    const rec = byStudent[student.id];
    const note = rec ? notes[rec.id] : undefined;
    setNoteBody(note?.body ?? '');
    setNoteOpen(true);
  }

  async function saveNote() {
    if (!student) return;
    const rec: ServingRecord | undefined = byStudent[student.id];
    // A note must NEVER fabricate a meal outcome. Creating a record here just to
    // obtain an id used to write an outcome-free SERVED row — a meal that looks
    // recorded but says nothing. The database now refuses that row outright, so
    // the honest behaviour is to ask for the result first.
    if (!rec) {
      setError('Record the meal result first — a note cannot stand in for an outcome.');
      return;
    }
    setNoteBusy(true);
    // §25: the concern flag is its own narrow write. It is saved even when the
    // note body is unchanged, and it overwrites no other meal-result field.
    if (draft.concern !== rec.concern_observed) {
      const flagged = await setConcernObserved(rec.id, draft.concern);
      if (flagged.error) {
        setError(flagged.error);
        setNoteBusy(false);
        return;
      }
    }
    // §24: classroom free text is INTERNAL. It reaches a family only after a
    // reviewer publishes it from the Parent-safe updates queue — never directly.
    const res = await upsertServingNote(rec.id, noteBody, false);
    setNoteBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNotes((n) => ({ ...n, [rec.id]: res.data! }));
    setNoteOpen(false);
  }

  if (!classId) {
    return (
      <div>
        <PageHead title="Today — serving" hint="choose a class to open the register" />
        <Card>
          <div className="filters">
            <select
              value=""
              onChange={(e) => setParams({ class: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--line)' }}
            >
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </Card>
      </div>
    );
  }

  const rec = student ? byStudent[student.id] : undefined;
  // INTERIM free-text safety notes (0029). NOT an allergy record: the
  // structured child Allergy/Dietary model is BLOCKED_BY_SPEC (§42).
  const safetyNote = student?.medical_notes?.map((m) => m.text).join(' · ');

  return (
    <div>
      <PageHead
        title="Today — serving"
        hint={`${classLabel} · ${todayISO()}`}
        actions={
          <>
            <span className="today-progress">
              {PERIOD_META.find((p) => p.period === period)?.label} — {recordedCount} /{' '}
              {servingRoster?.length ?? 0} completed
            </span>
            <Btn variant="ghost" size="sm" onClick={() => setParams({})}>
              Switch class
            </Btn>
          </>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      {availablePeriods.length > 0 && (
        <div className="period-bar">
          {availablePeriods.map((p) => (
            <button
              key={p.period}
              className={`period-btn${period === p.period ? ' active' : ''}`}
              onClick={() => setPeriod(p.period)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {currentService && (
        <Banner kind="info">
          Serving <b>{currentService.dish_name}</b> for{' '}
          {PERIOD_META.find((p) => p.period === period)?.label.toLowerCase()}.
        </Banner>
      )}

      {noServiceToday ? (
        // §1/§35: no published Meal Service for this institution today, so
        // there is nothing to record. A consumption observation is never
        // created against a meal that does not exist.
        //
        // Role-correct copy: Classroom Staff cannot reach the institution's
        // Service tab, so telling them to publish from it is an instruction they
        // have no way to follow. State the fact and name who can help.
        <EmptyState
          text={`No published Meal is available for ${todayISO()} — there is nothing to record for this class today. Contact your LunchBox Connect administrator.`}
        />
      ) : !servingRoster ? (
        <Spinner />
      ) : servingRoster.length === 0 ? (
        <EmptyState text="No eligible students in this class right now." />
      ) : !student ? null : (
        <>
          <div className="roster-strip">
            {servingRoster.map((s, i) => {
              const r = byStudent[s.id];
              // An ABSENT/UNWELL/SLEEPING child is stored as served_status
              // 'served' — the meal WAS available — with the reason carrying the
              // fact that the child did not eat it. That is the correct data
              // model and it is not changed here. But it meant the roster chip
              // fell through to 'checkCircle': a child who was not even in the
              // room showed the same green tick as a child who ate the lot, so
              // the one glance the strip exists to give was factually wrong, and
              // a teacher scanning for who still needs recording saw a class
              // that looked done.
              //
              // isNonPreferenceReason() is the same predicate analytics already
              // uses to exclude these from intake figures, reused rather than
              // restated so the two can never drift into disagreeing about what
              // counts as eating.
              const badge: IconName | null = !r
                ? null
                : r.served_status === 'not_served'
                  ? 'clock'
                  : r.concern_observed
                    ? 'alertTriangle'
                    : isNonPreferenceReason(r.low_intake_reason)
                      ? 'x'
                      : r.behavior === 'refused'
                        ? 'xCircle'
                        : 'checkCircle';
              return (
                <button
                  key={s.id}
                  className={`roster-chip${i === index ? ' active' : ''}`}
                  onClick={() => setIndex(i)}
                >
                  <Avatar
                    photoUrl={photoUrls[s.id]}
                    initials={initials(`${s.given_name} ${s.family_name}`)}
                    size="sm"
                  />
                  <span className={`status-badge${badge ? ` sb-${badge}` : ''}`}>
                    {badge ? <Icon name={badge} size={12} /> : '·'}
                  </span>
                  <span className="name">{s.given_name}</span>
                </button>
              );
            })}
          </div>

          {/* What this child actually receives. A special meal REPLACES the
              standard one, so the register must name it — serving the standard
              meal to a child with an approved alternative is the failure this
              indicator exists to prevent. */}
          {student && entitlement?.[student.id]?.specialRef && (
            <Banner kind="warn">
              <b>SPECIAL MEAL — DO NOT SERVE THE STANDARD MEAL.</b>{' '}
              {student.given_name} receives{' '}
              <b>{entitlement[student.id].mealName ?? 'an alternative meal'}</b> (
              {entitlement[student.id].specialRef}).
            </Banner>
          )}

          {student && entitlement?.[student.id]?.pending && (
            <Banner kind="warn">
              A meal decision for {student.given_name} has not been confirmed by LunchBox yet.
              Do not serve the standard meal until it is.
            </Banner>
          )}

          {notOnThisSitting.length > 0 && (
            <Card
              title="Not included in this meal plan"
              hint="these children are not part of this sitting — nothing to record"
            >
              <p className="cell-sub">
                {notOnThisSitting.map((s) => `${s.given_name} ${s.family_name}`).join(', ')}
              </p>
              <p className="hint">
                This is not an absence and not a missed meal. Their Meal Plan does not include this
                sitting, so they are not counted in completion or in production.
              </p>
            </Card>
          )}

          <div className="focus-nav">
            <button
              className="focus-nav-btn"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              ←
            </button>
            <Btn variant="ghost" size="sm" onClick={() => goToNextUnrecorded(-1)}>
              Next unrecorded
            </Btn>
            <button
              className="focus-nav-btn"
              disabled={index === servingRoster.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              →
            </button>
          </div>

          <div className="focus-card">
            <Avatar
              photoUrl={photoUrls[student.id]}
              initials={initials(`${student.given_name} ${student.family_name}`)}
              size="lg"
            />
            <div className="focus-name">
              {student.given_name} {student.family_name}
            </div>
            <div className="focus-sub">{student.student_no}</div>
            {safetyNote && (
              <div className="focus-safety-note">
                <Icon name="alertTriangle" size={13} /> {safetyNote}
              </div>
            )}

            {rec?.served_status === 'not_served' ? (
              <Banner kind="warn">
                Marked not served. Tap a portion below to record it instead.
              </Banner>
            ) : null}

            <div className="plate">
              {CONSUMPTION_VALUES.map((v) => (
                <button
                  key={v}
                  className={`plate-quarter${draft.pct === v ? ' selected' : ''}`}
                  onClick={() => void selectPct(v)}
                  aria-label={`${v}% eaten`}
                >
                  {draft.pct === v && (
                    <span className="fill" style={{ transform: `scaleY(${v / 100})` }} />
                  )}
                  <span>{v}%</span>
                </button>
              ))}
            </div>

            {/* §6: one-tap exceptions — no % or behaviour required, and never
                combined with an eating behaviour. Recorded as served-but-excluded. */}
            <div className="chip-choice exception-row">
              <span className="tmc-meta">Or mark:</span>
              {NON_PREFERENCE_LOW_INTAKE_REASONS.map((r) => (
                <button
                  key={r}
                  className={rec?.low_intake_reason === r ? 'selected' : ''}
                  onClick={() => void saveException(r)}
                  disabled={saving}
                >
                  {LOW_INTAKE_REASON_LABEL[r]}
                </button>
              ))}
            </div>

            {draft.pct !== null && (
              <div className="chip-choice">
                {(['ate_independently', 'needed_encouragement', 'refused'] as EatingBehavior[]).map(
                  (b) => (
                    <button
                      key={b}
                      className={`${b === 'refused' ? 'danger' : b === 'needed_encouragement' ? 'warn' : ''} ${draft.behavior === b ? 'selected' : ''}`}
                      onClick={() => void selectBehavior(b)}
                    >
                      {BEHAVIOR_LABEL[b]}
                    </button>
                  ),
                )}
              </div>
            )}

            {isLowIntake(draft.pct) && draft.behavior && (
              <div className="chip-choice">
                {/* §6: only preference reasons here. Absent / Unwell / Asleep are
                    NOT eating outcomes and live on the one-tap exception row above,
                    so "0% → Ate independently → Absent" can no longer be formed. */}
                {(Object.keys(LOW_INTAKE_REASON_LABEL) as LowIntakeReason[])
                  .filter((r) => !NON_PREFERENCE_LOW_INTAKE_REASONS.includes(r))
                  .map((r) => (
                    <button
                      key={r}
                      className={draft.reason === r ? 'selected' : ''}
                      onClick={() => void selectReason(r)}
                    >
                      {LOW_INTAKE_REASON_LABEL[r]}
                    </button>
                  ))}
                {/* The reason is OPTIONAL: this is the way through without one. */}
                <button
                  className="brand"
                  onClick={() => void saveWithoutReason()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save · no reason'}
                </button>
              </div>
            )}

            <div className="chip-choice">
              <button
                className={draft.concern ? 'warn selected' : ''}
                onClick={() => {
                  setDraft((d) => ({ ...d, concern: !d.concern }));
                  openNoteModal();
                }}
              >
                {draft.concern ? (
                  <>
                    <Icon name="alertTriangle" size={13} /> Concern flagged
                  </>
                ) : (
                  'Flag a concern'
                )}
              </button>
              <button onClick={openNoteModal}>
                {notes[rec?.id ?? '']?.body ? 'Edit note' : 'Add note'}
              </button>
              <button
                className="not-served-btn"
                onClick={() => void markNotServed()}
                disabled={saving}
              >
                Meal not served
              </button>
            </div>
          </div>
        </>
      )}

      {noteOpen && (
        <Modal
          title="Note"
          onClose={() => setNoteOpen(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setNoteOpen(false)}>
                Cancel
              </Btn>
              <Btn variant="brand" onClick={() => void saveNote()} disabled={noteBusy}>
                {noteBusy ? 'Saving…' : 'Save'}
              </Btn>
            </>
          }
        >
          <Field label="Note text">
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              autoFocus
              placeholder="what did you observe?"
            />
          </Field>
          <p className="tmc-meta">
            This note is internal. It reaches the family only if a reviewer publishes it from
            Parent-safe updates.
          </p>
          {draft.pct !== null && (
            <Btn
              variant="ghost"
              style={{ marginTop: 12 }}
              onClick={() => {
                setNoteOpen(false);
                void saveExceptionNow();
              }}
            >
              Save meal result too
            </Btn>
          )}
        </Modal>
      )}
    </div>
  );
}
