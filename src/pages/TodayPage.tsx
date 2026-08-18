import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listClasses,
  notesForServing,
  recordServing,
  rosterForClass,
  servingForDay,
  upsertServingNote,
  type ClassWithMeta,
} from '../lib/api';
import type { AppPeriod, MealOutcome, ServingNote, ServingRecord, Student } from '../lib/types';
import { Btn, Banner, Card, EmptyState, Field, Modal, PageHead, Spinner } from '../components/ui';
import { MEAL_OUTCOMES } from '../lib/rbac';
import { todayISO } from '../lib/format';

const PERIOD_META: Array<{ period: AppPeriod; label: string; time: string }> = [
  { period: 'breakfast', label: 'Breakfast', time: '11:00–11:25' },
  { period: 'snack', label: 'Snack', time: '10:30–10:50' },
  { period: 'lunch', label: 'Lunch', time: '12:15–13:00' },
  { period: 'afternoon_snack', label: 'Afternoon snack', time: '14:30–14:50' },
];

type SaveState = 'ok' | 'pending' | 'err';

interface NoteDraft {
  studentId: string;
  recordId: string | null;
  body: string;
  published: boolean;
}

export default function TodayPage() {
  const [params, setParams] = useSearchParams();
  const classId = params.get('class') ?? '';

  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [roster, setRoster] = useState<Student[] | null>(null);
  const [records, setRecords] = useState<ServingRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, ServingNote>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<AppPeriod>('breakfast');
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listClasses().then((res) => {
      if (res.error) setError(res.error);
      setClasses(res.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    let active = true;
    void (async () => {
      const today = todayISO();
      const [r, s] = await Promise.all([
        rosterForClass(classId),
        servingForDay(classId, today, period),
      ]);
      if (!active) return;
      if (r.error || s.error) setError(r.error ?? s.error);
      setRoster(r.data ?? []);
      setRecords(s.data ?? []);
      const ids = (s.data ?? []).map((x) => x.id);
      const n = await notesForServing(ids);
      const map: Record<string, ServingNote> = {};
      (n.data ?? []).forEach((note) => (map[note.serving_record_id] = note));
      setNotes(map);
    })();
    return () => {
      active = false;
    };
  }, [classId, period]);

  const byStudent = useMemo(() => {
    const map: Record<string, ServingRecord> = {};
    records.forEach((r) => (map[r.student_id] = r));
    return map;
  }, [records]);

  const classLabel = classes.find((c) => c.id === classId)?.name ?? classId;
  const recordedCount = roster?.filter((s) => byStudent[s.id]).length ?? 0;

  async function refreshRecords() {
    const fresh = await servingForDay(classId, todayISO(), period);
    if (fresh.data) setRecords(fresh.data);
    const n = await notesForServing(fresh.data?.map((x) => x.id) ?? []);
    const map: Record<string, ServingNote> = {};
    (n.data ?? []).forEach((note) => (map[note.serving_record_id] = note));
    setNotes(map);
  }

  async function setOutcome(studentId: string, outcome: MealOutcome) {
    setSaveState((s) => ({ ...s, [studentId]: 'pending' }));
    const res = await recordServing(
      classId,
      [{ student_id: studentId, period, outcome }],
      todayISO(),
    );
    if (res.error) {
      setSaveState((s) => ({ ...s, [studentId]: 'err' }));
      setError(res.error);
      return;
    }
    await refreshRecords();
    setSaveState((s) => ({ ...s, [studentId]: 'ok' }));
  }

  async function saveNote() {
    if (!draft) return;
    setBusy(true);
    let recordId = draft.recordId;
    if (!recordId) {
      const existing = byStudent[draft.studentId];
      if (!existing) {
        const res = await recordServing(
          classId,
          [{ student_id: draft.studentId, period, outcome: 'full' }],
          todayISO(),
        );
        if (res.error) {
          setError(res.error);
          setBusy(false);
          return;
        }
        await refreshRecords();
      }
      const fresh = byStudent[draft.studentId];
      recordId = fresh?.id ?? null;
      if (!recordId) {
        // after refreshRecords the state has not re-rendered; look it up directly
        const q = await servingForDay(classId, todayISO(), period);
        recordId = q.data?.find((r) => r.student_id === draft.studentId)?.id ?? null;
      }
    }
    if (!recordId) {
      setError('Outcome must be saved before a note can be attached.');
      setBusy(false);
      return;
    }
    const res = await upsertServingNote(recordId, draft.body, draft.published);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNotes((n) => ({ ...n, [recordId as string]: res.data! }));
    setDraft(null);
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

  return (
    <div>
      <PageHead
        title="Today — serving"
        hint={`${classLabel} · ${todayISO()}`}
        actions={
          <span className="chip brand">
            {recordedCount} of {roster?.length ?? 0} recorded
          </span>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      <Card
        title="Serving register"
        hint="outcome per student per period + optional note"
        actions={
          <>
            <div className="period-bar" style={{ margin: 0 }}>
              {PERIOD_META.map((p) => (
                <button
                  key={p.period}
                  className={`period-btn${period === p.period ? ' active' : ''}`}
                  onClick={() => setPeriod(p.period)}
                >
                  {p.label} <small>{p.time}</small>
                </button>
              ))}
            </div>
            <Btn variant="ghost" onClick={() => setParams({})}>
              Switch class
            </Btn>
          </>
        }
      >
        {!roster ? (
          <Spinner />
        ) : roster.length === 0 ? (
          <EmptyState text="No enrolled students in this class." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Outcome</th>
                <th>Note</th>
                <th>Saved</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => {
                const rec = byStudent[s.id];
                const note = rec ? notes[rec.id] : undefined;
                return (
                  <tr key={s.id}>
                    <td className="cell-name">
                      {s.given_name} {s.family_name}{' '}
                      <span className="cell-sub">{s.student_no}</span>
                    </td>
                    <td>
                      <select
                        className={`outcome ${rec?.outcome ?? ''}`}
                        value={rec?.outcome ?? ''}
                        onChange={(e) => void setOutcome(s.id, e.target.value as MealOutcome)}
                      >
                        <option value="" disabled>
                          — record —
                        </option>
                        {MEAL_OUTCOMES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        title="add / edit note"
                        onClick={() =>
                          setDraft({
                            studentId: s.id,
                            recordId: rec?.id ?? null,
                            body: note?.body ?? '',
                            published: Boolean(note?.published_at),
                          })
                        }
                      >
                        ✎
                      </button>
                    </td>
                    <td className={`save-state ${saveState[s.id] ?? (rec ? 'ok' : '')}`}>
                      {saveState[s.id] === 'pending'
                        ? '… saving'
                        : saveState[s.id] === 'err'
                          ? 'failed'
                          : rec
                            ? '✓ saved'
                            : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {draft && (
        <Modal
          title="Note"
          onClose={() => setDraft(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void saveNote()}
                disabled={busy || !draft.body.trim()}
              >
                {busy ? 'Saving…' : 'Save note'}
              </Btn>
            </>
          }
        >
          <Field label="Note text">
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={3}
              autoFocus
              placeholder="e.g. refused vegetables; not hungry"
            />
          </Field>
          <div className="field" style={{ marginTop: 12 }}>
            <label>
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                style={{ marginRight: 6 }}
              />
              Publish to the child's family
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
