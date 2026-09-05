import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ELIGIBLE_STATUS,
  getStudent,
  guardiansForStudent,
  listClasses,
  listInstitutions,
  servingHistoryForStudent,
  setOperationalStatus,
  studentPhotoUrl,
  updateStudent,
  uploadStudentPhoto,
  type ClassWithMeta,
} from '../lib/api';
import type { AppUser, Institution, ServingRecord, Student } from '../lib/types';
import {
  Avatar,
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
import { Icon } from '../components/icons';
import StudentPlanCards from './StudentPlanCards';
import { initials } from '../lib/format';
import { statusLabel, statusPillClass } from '../lib/status';
import {
  BEHAVIOR_LABEL,
  meanConsumption,
  LOW_INTAKE_REASON_LABEL,
  consumptionHumanLabel,
  isValidPreferenceObservation,
} from '../lib/mealAnalytics';
import { can } from '../lib/rbac';
import { useRole } from '../lib/auth';

const PERIOD_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  snack: 'Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

/**
 * Student Profile (blueprint Part 15) — the authoritative Student view. Every
 * other surface (class roster, parent view, analytics) references this same
 * record; nothing here is a per-portal copy. Which actions render is decided by
 * the role's approved permissions, and the backend re-checks all of them.
 */
export default function StudentProfilePage() {
  const { id = '' } = useParams();
  const role = useRole();

  const [student, setStudent] = useState<Student | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [guardians, setGuardians] = useState<AppUser[]>([]);
  const [history, setHistory] = useState<ServingRecord[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // §16: a child's own details are ordinary corrections — a misspelt name, a
  // missing ID, a grade that moved up. There was nowhere in the product to
  // make them, so the only remedy was a database edit.
  const [showEdit, setShowEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [edit, setEdit] = useState({ given_name: '', family_name: '', student_no: '', grade: '' });

  const canManage = can(role, 'students', 'update');
  // 'set' is the approved action key for operational status (rbac.ts) — the
  // single approved value is Super Admin only, and RLS re-checks it.
  const canSetEligibility = can(role, 'status', 'set');

  async function load() {
    const [st, inst, cls, gu, hist] = await Promise.all([
      getStudent(id),
      listInstitutions(),
      listClasses(),
      guardiansForStudent(id),
      servingHistoryForStudent(id),
    ]);
    setError(st.error ?? inst.error ?? cls.error ?? gu.error ?? hist.error);
    setStudent(st.data);
    setInstitutions(inst.data ?? []);
    setClasses(cls.data ?? []);
    setGuardians(gu.data ?? []);
    setHistory(hist.data ?? []);
    setPhotoUrl(await studentPhotoUrl(st.data?.photo_path ?? null));
  }

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    void (async () => {
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const stats = useMemo(() => {
    const valid = history.filter((r) => isValidPreferenceObservation(r));
    const avg = valid.length > 0 ? meanConsumption(valid) : null;
    return {
      recorded: history.length,
      valid: valid.length,
      avg,
      refusals: history.filter((r) => r.behavior === 'refused').length,
      concerns: history.filter((r) => r.concern_observed).length,
    };
  }, [history]);

  async function onPhoto(file: File | undefined) {
    if (!file || !student) return;
    setBusy(true);
    const res = await uploadStudentPhoto(student.id, file);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await load();
  }

  async function onSaveDetails() {
    if (!student) return;
    setBusy(true);
    setEditError(null);
    const res = await updateStudent(student.id, {
      given_name: edit.given_name.trim(),
      family_name: edit.family_name.trim(),
      // A setting that issues no student numbers stores NULL rather than an
      // empty string — the column is nullable by design (§7).
      student_no: edit.student_no.trim() || null,
      grade: edit.grade.trim() || null,
    });
    setBusy(false);
    if (res.error) {
      setEditError(res.error);
      return;
    }
    setStudent(res.data);
    setShowEdit(false);
  }

  async function onClassChange(classId: string) {
    if (!student) return;
    setBusy(true);
    const res = await updateStudent(student.id, { class_id: classId || null });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStudent(res.data);
  }

  async function onEligibilityChange(next: string | null) {
    if (!student) return;
    setBusy(true);
    const res = await setOperationalStatus(student.id, next);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStudent(res.data);
  }

  if (loading) return <Spinner />;
  if (error && !student) return <EmptyState text={`Could not load this student: ${error}`} />;
  if (!student) {
    return (
      <EmptyState text="This student does not exist, or your account is not authorized to see them." />
    );
  }

  const institution = institutions.find((i) => i.id === student.institution_id);
  const currentClass = classes.find((c) => c.id === student.class_id);
  const notes = student.medical_notes ?? [];

  return (
    <div>
      <PageHead
        title={`${student.given_name} ${student.family_name}`}
        hint={student.student_no ?? undefined}
        actions={
          <>
            {canManage && (
              <Btn
                variant="ghost"
                onClick={() => {
                  setEditError(null);
                  setEdit({
                    given_name: student.given_name,
                    family_name: student.family_name,
                    student_no: student.student_no ?? '',
                    grade: student.grade ?? '',
                  });
                  setShowEdit(true);
                }}
              >
                Edit details
              </Btn>
            )}
            <Link to="/students" className="btn ghost">
              <Icon name="arrowLeft" size={14} /> All students
            </Link>
          </>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      <div className="profile-head">
        <div className="profile-identity">
          <Avatar
            photoUrl={photoUrl}
            initials={initials(`${student.given_name} ${student.family_name}`)}
            size="lg"
          />
          <div>
            <h3 className="profile-name">
              {student.given_name} {student.family_name}
            </h3>
            <div className="cell-sub">{student.student_no}</div>
            <div className="profile-pills">
              {/* operational_status is the authoritative eligibility gate; the
                  legacy enrollment_status is no longer presented as truth. */}
              <Pill variant={statusPillClass(student.operational_status)}>
                {statusLabel(student.operational_status)}
              </Pill>
            </div>
            {canManage && (
              <label className="btn ghost sm profile-photo-btn">
                {busy ? 'Working…' : student.photo_path ? 'Replace photo' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => void onPhoto(e.target.files?.[0])}
                  disabled={busy}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <Banner kind="warn">
          <Icon name="alertTriangle" size={14} /> Safety notes (interim — not the authoritative
          allergy record): {notes.map((n) => n.text).join(' · ')}
        </Banner>
      )}

      <div className="stat-grid">
        <StatCard
          icon="clipboardList"
          label="Meals recorded"
          value={stats.recorded}
          trend="all time"
        />
        <StatCard
          icon="checkCircle"
          label="Average intake"
          value={stats.avg !== null ? `${stats.avg}%` : '—'}
          trend={`${stats.valid} valid observations`}
        />
        <StatCard icon="xCircle" label="Refusals" value={stats.refusals} trend="recorded" />
        <StatCard
          icon="alertTriangle"
          label="Concerns flagged"
          value={stats.concerns}
          trend="recorded"
        />
      </div>

      <Card title="Placement" hint="where this child is, and whether they are in the meal service">
        <table>
          <tbody>
            <tr>
              <td className="cell-sub">Institution</td>
              <td className="cell-name">
                {/* Only link where the role may actually open the Institution
                    page; otherwise show the name as plain fact. */}
                {institution ? (
                  can(role, 'institutions', 'view') ? (
                    <Link to={`/institutions/${institution.id}`}>{institution.name}</Link>
                  ) : (
                    institution.name
                  )
                ) : (
                  '—'
                )}
              </td>
            </tr>
            <tr>
              <td className="cell-sub">Class</td>
              <td>
                {canManage ? (
                  <select
                    value={student.class_id ?? ''}
                    onChange={(e) => void onClassChange(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Unassigned</option>
                    {classes
                      .filter((c) => c.institution_id === student.institution_id)
                      // An archived class cannot take a student. Their current
                      // one stays listed even if archived, so the control does
                      // not misreport them as unassigned.
                      .filter((c) => c.active || c.id === student.class_id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.active ? '' : ' (archived)'}
                        </option>
                      ))}
                  </select>
                ) : (
                  (currentClass?.name ?? 'Unassigned')
                )}
              </td>
            </tr>
            <tr>
              <td className="cell-sub">Operational status</td>
              <td>
                {canSetEligibility ? (
                  <select
                    value={student.operational_status ?? ''}
                    onChange={(e) => void onEligibilityChange(e.target.value || null)}
                    disabled={busy}
                  >
                    <option value="">Not in the meal service</option>
                    <option value={ELIGIBLE_STATUS}>Active — in the meal service</option>
                  </select>
                ) : (
                  statusLabel(student.operational_status)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card
        title="Guardians"
        hint="a parent sees this child because of a link listed here"
        actions={
          // "Manage" only where guardian mutation is actually permitted.
          // A School Admin has read-only guardian visibility, so the link is
          // labelled for what it does: view.
          can(role, 'guardians', 'view') ? (
            <Link to="/guardians" className="btn ghost">
              {can(role, 'guardians', 'create') ? 'Manage links' : 'View guardian links'}{' '}
              <Icon name="arrowRight" size={14} />
            </Link>
          ) : undefined
        }
      >
        {guardians.length === 0 ? (
          <EmptyState
            text={
              can(role, 'guardians', 'create')
                ? 'No guardian accounts are linked to this student yet — until one is, no parent can see this child.'
                : 'No guardian accounts are linked to this student yet — until one is, no parent can see this child. Linking is handled by LunchBox Connect.'
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Guardian</th>
                <th>Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {guardians.map((g) => (
                <tr key={g.user_id}>
                  <td className="cell-name">{g.full_name}</td>
                  <td className="cell-sub">{g.email}</td>
                  <td className="cell-sub">{g.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <StudentPlanCards student={student} />

      <Card title="Meal history" hint="every meal recorded for this child">
        {history.length === 0 ? (
          <EmptyState text="No meal observations have been recorded for this student yet." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Period</th>
                <th>Result</th>
                <th className="col-secondary">Behaviour</th>
                <th className="col-secondary">Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.serving_date}</td>
                  <td className="cell-sub">{PERIOD_LABEL[r.period] ?? r.period}</td>
                  <td>
                    {r.served_status === 'not_served' ? (
                      <Pill variant="slate">Not served</Pill>
                    ) : (
                      <Pill
                        variant={
                          r.consumption_pct === null
                            ? 'slate'
                            : r.consumption_pct >= 50
                              ? 'free'
                              : 'reduced'
                        }
                      >
                        {consumptionHumanLabel(r.consumption_pct)}
                      </Pill>
                    )}
                  </td>
                  <td className="cell-sub col-secondary">
                    {r.behavior ? BEHAVIOR_LABEL[r.behavior] : '—'}
                  </td>
                  <td className="cell-sub col-secondary">
                    {r.low_intake_reason ? LOW_INTAKE_REASON_LABEL[r.low_intake_reason] : '—'}
                  </td>
                  <td>
                    {r.concern_observed ? (
                      <span className="concern-flag">
                        <Icon name="alertTriangle" size={13} />
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {!canManage && (
        <Banner kind="info">
          Your role has read access to this student. Editing placement, eligibility and photos is
          restricted, and the database enforces that independently of this screen.
        </Banner>
      )}

      {showEdit && (
        <Modal
          title={`Edit ${student.given_name} ${student.family_name}`}
          onClose={() => setShowEdit(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowEdit(false)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void onSaveDetails()}
                disabled={busy || !edit.given_name.trim() || !edit.family_name.trim()}
              >
                {busy ? 'Saving…' : 'Save'}
              </Btn>
            </>
          }
        >
          {editError && <Banner kind="err">{editError}</Banner>}
          <Banner kind="info">
            This corrects the one authoritative record for this child — the same row the class
            roster, the kitchen count, the parent's app and the analytics all read. It does not
            touch anything already recorded about the meals they were served.
          </Banner>
          <div className="form-row">
            <Field label="Given name">
              <input
                value={edit.given_name}
                onChange={(e) => setEdit({ ...edit, given_name: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Family name">
              <input
                value={edit.family_name}
                onChange={(e) => setEdit({ ...edit, family_name: e.target.value })}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Student no. (optional)">
              <input
                value={edit.student_no}
                onChange={(e) => setEdit({ ...edit, student_no: e.target.value })}
                placeholder="leave empty if your setting issues none"
              />
            </Field>
            <Field label="Grade (optional)">
              <input
                value={edit.grade}
                onChange={(e) => setEdit({ ...edit, grade: e.target.value })}
              />
            </Field>
          </div>
          <Banner kind="info">
            Class is changed on the Placement card below, and whether the child is in the meal
            service is set there too. Which institution a child belongs to is not editable: moving a
            child between institutions would move their meal history with them.
          </Banner>
        </Modal>
      )}

      <Btn variant="ghost" onClick={() => void load()} disabled={busy} style={{ marginBottom: 24 }}>
        Refresh
      </Btn>
    </div>
  );
}
