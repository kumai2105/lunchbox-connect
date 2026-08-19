import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listClasses,
  notesForServing,
  recordServing,
  resolveMealServiceId,
  rosterForClass,
  servingForDay,
  studentPhotoUrl,
  upsertServingNote,
  type ClassWithMeta,
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
import { CONSUMPTION_VALUES } from '../lib/types';
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
import { BEHAVIOR_LABEL, LOW_INTAKE_REASON_LABEL, isLowIntake } from '../lib/mealAnalytics';
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
  const [records, setRecords] = useState<ServingRecord[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});
  const [notes, setNotes] = useState<Record<string, ServingNote>>({});
  const [mealServiceId, setMealServiceId] = useState<string | null>(null);
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
      const [r, s, m] = await Promise.all([
        rosterForClass(classId),
        servingForDay(classId, today, period),
        // Traceability now points at the DATED Meal Service for this class's
        // institution, not at a template row addressed by a global
        // calendar-week number. Returns null when nothing is published for
        // the slot; the observation is still recorded, just without a link,
        // because inventing a service would be worse than an honest gap.
        institutionId
          ? resolveMealServiceId(institutionId, today, period)
          : Promise.resolve(null),
      ]);
      if (!active) return;
      if (r.error || s.error) setError(r.error ?? s.error);
      setRoster(r.data ?? []);
      setRecords(s.data ?? []);
      setMealServiceId(m);
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

  const classLabel = classes.find((c) => c.id === classId)?.name ?? classId;
  const recordedCount = roster?.filter((s) => byStudent[s.id]).length ?? 0;
  const student = roster?.[index] ?? null;

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
    if (!roster) return;
    for (let i = fromIndex + 1; i < roster.length; i++) {
      if (!byStudent[roster[i].id]) {
        setIndex(i);
        return;
      }
    }
    for (let i = 0; i < roster.length; i++) {
      if (!byStudent[roster[i].id]) {
        setIndex(i);
        return;
      }
    }
    // everyone recorded — just move forward if possible
    if (fromIndex + 1 < roster.length) setIndex(fromIndex + 1);
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
    setNoteBusy(true);
    let rec: ServingRecord | undefined = byStudent[student.id];
    if (!rec) {
      const ok = await save({
        consumption_pct: draft.pct,
        behavior: draft.behavior,
        low_intake_reason: draft.reason,
        concern_observed: draft.concern, // §25: a note never implies a concern
      });
      if (!ok) {
        setNoteBusy(false);
        return;
      }
      const fresh = await servingForDay(classId, todayISO(), period);
      rec = fresh.data?.find((r) => r.student_id === student.id);
    }
    if (!rec) {
      setNoteBusy(false);
      return;
    }
    // §24: classroom free text is INTERNAL. It reaches a family only after a
    // reviewer publishes it from the Parent-safe updates queue — never directly.
    const res = await upsertServingNote(rec.id, noteBody, false);
    setNoteBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNotes((n) => ({ ...n, [rec!.id]: res.data! }));
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
  const allergyNote = student?.medical_notes?.map((m) => m.text).join(' · ');

  return (
    <div>
      <PageHead
        title="Today — serving"
        hint={`${classLabel} · ${todayISO()}`}
        actions={
          <>
            <span className="today-progress">
              {PERIOD_META.find((p) => p.period === period)?.label} — {recordedCount} /{' '}
              {roster?.length ?? 0} completed
            </span>
            <Btn variant="ghost" size="sm" onClick={() => setParams({})}>
              Switch class
            </Btn>
          </>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      <div className="period-bar">
        {PERIOD_META.map((p) => (
          <button
            key={p.period}
            className={`period-btn${period === p.period ? ' active' : ''}`}
            onClick={() => setPeriod(p.period)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!roster ? (
        <Spinner />
      ) : roster.length === 0 ? (
        <EmptyState text="No eligible students in this class right now." />
      ) : !student ? null : (
        <>
          <div className="roster-strip">
            {roster.map((s, i) => {
              const r = byStudent[s.id];
              const badge: IconName | null = !r
                ? null
                : r.served_status === 'not_served'
                  ? 'clock'
                  : r.concern_observed
                    ? 'alertTriangle'
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
              disabled={index === roster.length - 1}
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
            {allergyNote && (
              <div className="focus-allergy">
                <Icon name="alertTriangle" size={13} /> {allergyNote}
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
                {(Object.keys(LOW_INTAKE_REASON_LABEL) as LowIntakeReason[]).map((r) => (
                  <button
                    key={r}
                    className={draft.reason === r ? 'selected' : ''}
                    onClick={() => void selectReason(r)}
                  >
                    {LOW_INTAKE_REASON_LABEL[r]}
                  </button>
                ))}
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
