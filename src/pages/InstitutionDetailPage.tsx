import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  getInstitution,
  listClasses,
  listStudents,
  staffForInstitution,
  type ClassWithMeta,
} from '../lib/api';
import type { AppUser, Institution, Student } from '../lib/types';
import {
  Avatar,
  Banner,
  Card,
  EmptyState,
  PageHead,
  Pill,
  Spinner,
  StatCard,
} from '../components/ui';
import { Icon } from '../components/icons';
import InstitutionServiceTab from './InstitutionServiceTab';
import { initials } from '../lib/format';
import { statusLabel, statusPillClass } from '../lib/status';

type Tab = 'overview' | 'service' | 'classes' | 'students' | 'staff';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'service', label: 'Service' },
  { key: 'classes', label: 'Classes' },
  { key: 'students', label: 'Students' },
  { key: 'staff', label: 'Staff' },
];

/**
 * Institution Detail (blueprint Part 12) — the system-level overview of one
 * Institution. Every section reads the SAME authoritative records the
 * Classes/Students/Users pages read, filtered to this institution; there is no
 * institution-specific copy of any entity.
 */
export default function InstitutionDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';

  const [institution, setInstitution] = useState<Institution | null>(null);
  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    void (async () => {
      const [inst, cls, studs, stf] = await Promise.all([
        getInstitution(id),
        listClasses(),
        listStudents({ institutionId: id }),
        staffForInstitution(id),
      ]);
      if (!active) return;
      setError(inst.error ?? cls.error ?? studs.error ?? stf.error);
      setInstitution(inst.data);
      setClasses((cls.data ?? []).filter((c) => c.institution_id === id));
      setStudents(studs.data ?? []);
      setStaff(stf.data ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const eligible = useMemo(
    () => students.filter((s) => s.operational_status !== null).length,
    [students],
  );
  const allergyFlagged = useMemo(
    () => students.filter((s) => (s.medical_notes ?? []).length > 0).length,
    [students],
  );

  if (loading) return <Spinner />;
  if (error && !institution)
    return <EmptyState text={`Could not load this institution: ${error}`} />;
  if (!institution) {
    return (
      <EmptyState text="This institution does not exist, or your account is not authorized to see it." />
    );
  }

  return (
    <div>
      <PageHead
        title={institution.name}
        hint={institution.kind}
        actions={
          <Link to="/institutions" className="btn ghost">
            <Icon name="arrowLeft" size={14} /> All institutions
          </Link>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      <div className="stat-grid">
        <StatCard
          icon="folder"
          label="Classes"
          value={classes.length}
          trend="in this institution"
        />
        <StatCard icon="users" label="Students" value={students.length} trend="on the roster" />
        <StatCard
          icon="checkCircle"
          label="Operationally eligible"
          value={eligible}
          trend="enter the meal chain"
        />
        <StatCard icon="user" label="Staff accounts" value={staff.length} trend="scoped here" />
      </div>

      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setParams(t.key === 'overview' ? {} : { tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <Card title="Institution record" hint="the authoritative row every portal reads">
            <table>
              <tbody>
                <tr>
                  <td className="cell-sub">Name</td>
                  <td className="cell-name">{institution.name}</td>
                </tr>
                <tr>
                  <td className="cell-sub">Type</td>
                  <td>
                    <Pill variant="slate">{institution.kind}</Pill>
                  </td>
                </tr>
                <tr>
                  <td className="cell-sub">Added</td>
                  <td>{new Date(institution.created_at).toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td className="cell-sub">Allergy-flagged students</td>
                  <td className="mono">{allergyFlagged}</td>
                </tr>
              </tbody>
            </table>
          </Card>
          <Banner kind="info">
            Deliveries and institution-scoped reporting are not shown here yet — the delivery state
            machine and the institution report set are still NOT_YET_DEFINED in the spec pack, and
            this page will not fabricate either.
          </Banner>
        </>
      )}

      {tab === 'service' && id && <InstitutionServiceTab institutionId={id} />}

      {tab === 'classes' && (
        <Card
          title="Classes"
          hint="a Class always belongs to exactly one Institution"
          actions={
            <Link to={`/classes?institution=${id}`} className="btn ghost">
              Manage classes <Icon name="arrowRight" size={14} />
            </Link>
          }
        >
          {classes.length === 0 ? (
            <EmptyState text="No classes have been created for this institution yet." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Grade</th>
                  <th>Students</th>
                  <th>Assigned staff</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-name">{c.name}</td>
                    <td>{c.grade ?? '—'}</td>
                    <td className="mono">{c.student_count}</td>
                    <td className="cell-sub">
                      {c.teacher_id
                        ? (staff.find((u) => u.user_id === c.teacher_id)?.full_name ?? 'Assigned')
                        : 'Unassigned'}
                    </td>
                    <td>
                      <Link to={`/today?class=${c.id}`} className="btn ghost sm">
                        Open Today <Icon name="arrowRight" size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'students' && (
        <Card
          title="Students"
          hint="same authoritative Student records as the Students page"
          actions={
            <Link to={`/students?institution=${id}`} className="btn ghost">
              Manage students <Icon name="arrowRight" size={14} />
            </Link>
          }
        >
          {students.length === 0 ? (
            <EmptyState text="No students are enrolled at this institution yet." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Student</th>
                  <th>Class</th>
                  <th>Operational status</th>
                  <th>Enrollment</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Avatar initials={initials(`${s.given_name} ${s.family_name}`)} size="sm" />
                    </td>
                    <td className="cell-name">
                      <Link to={`/students/${s.id}`}>
                        {s.given_name} {s.family_name}
                      </Link>
                      <span className="cell-sub"> {s.student_no}</span>
                    </td>
                    <td>{classes.find((c) => c.id === s.class_id)?.name ?? 'Unassigned'}</td>
                    <td>
                      <Pill variant={statusPillClass(s.operational_status)}>
                        {statusLabel(s.operational_status)}
                      </Pill>
                    </td>
                    <td className="cell-sub">{s.enrollment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'staff' && (
        <Card
          title="Staff accounts"
          hint="institution-scoped users"
          actions={
            <Link to="/users" className="btn ghost">
              Users &amp; roles <Icon name="arrowRight" size={14} />
            </Link>
          }
        >
          {staff.length === 0 ? (
            <EmptyState text="No staff accounts are scoped to this institution yet." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Assigned classes</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => {
                  const assigned = classes.filter((c) => c.teacher_id === u.user_id);
                  return (
                    <tr key={u.user_id}>
                      <td className="cell-name">{u.full_name}</td>
                      <td className="cell-sub">{u.email}</td>
                      <td>
                        <Pill variant={u.role === 'school_admin' ? 'brand' : 'slate'}>
                          {u.role.toUpperCase()}
                        </Pill>
                      </td>
                      <td className="cell-sub">
                        {assigned.length ? assigned.map((c) => c.name).join(', ') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
