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
  PageHead,
  Pill,
  Spinner,
  StatCard,
} from '../components/ui';
import { Icon } from '../components/icons';
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
    const avg =
      valid.length > 0 ? meanConsumption(valid) : null;
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
          <Link to="/students" className="btn ghost">
            <Icon name="arrowLeft" size={14} /> All students
          </Link>
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
          <Icon name="alertTriangle" size={14} /> Safety notes (interim — not the
          authoritative allergy record):{' '}
          {notes.map((n) => n.text).join(' · ')}
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

      <Card title="Placement" hint="the authoritative institution and class assignment">
        <table>
          <tbody>
            <tr>
              <td className="cell-sub">Institution</td>
              <td className="cell-name">
                {institution ? (
                  <Link to={`/institutions/${institution.id}`}>{institution.name}</Link>
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
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
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
                    <option value="">Not eligible</option>
                    <option value={ELIGIBLE_STATUS}>{ELIGIBLE_STATUS}</option>
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
        hint="parent access derives from these links"
        actions={
          canManage ? (
            <Link to="/guardians" className="btn ghost">
              Manage links <Icon name="arrowRight" size={14} />
            </Link>
          ) : undefined
        }
      >
        {guardians.length === 0 ? (
          <EmptyState text="No guardian accounts are linked to this student yet — until one is, no parent can see this child." />
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

      <Card title="Meal history" hint="the same Classroom Meal Records parents and analytics read">
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

      <Btn variant="ghost" onClick={() => void load()} disabled={busy} style={{ marginBottom: 24 }}>
        Refresh
      </Btn>
    </div>
  );
}
