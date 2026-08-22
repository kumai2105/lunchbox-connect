import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  classStaffForInstitution,
  createAccount,
  getInstitution,
  listClasses,
  listStudents,
  staffForInstitution,
  updateInstitution,
  type ClassWithMeta,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import type { AppUser, Institution, Student } from '../lib/types';
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
import InstitutionServiceTab from './InstitutionServiceTab';
import InstitutionCalendarTab from './InstitutionCalendarTab';
import { initials } from '../lib/format';
import { statusLabel, statusPillClass } from '../lib/status';

type Tab = 'overview' | 'service' | 'calendar' | 'classes' | 'students' | 'staff';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'service', label: 'Service' },
  { key: 'calendar', label: 'Calendar' },
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
  const { profile } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [invite, setInvite] = useState({ fullName: '', email: '', password: '' });
  // Institution identity is Super Admin configuration too: a nursery gets
  // renamed, or was first recorded under the wrong type. 0033/0041 already
  // permit the update — nothing in the UI reached it, so the only remedy was a
  // database edit.
  const [showEdit, setShowEdit] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ name: string; kind: Institution['kind'] }>({
    name: '',
    kind: 'nursery',
  });
  // §17: Super Admin anywhere, or the Nursery Admin OF THIS institution.
  const canInviteStaff =
    profile?.role === 'super_admin' ||
    (profile?.role === 'school_admin' && profile?.institution_id === id);
  // Only the Super Admin owns the institution record itself (0033).
  const canEditInstitution = profile?.role === 'super_admin';

  async function onInvite() {
    setInviteBusy(true);
    setInviteMsg(null);
    const res = await createAccount({
      email: invite.email.trim(),
      password: invite.password,
      fullName: invite.fullName.trim(),
      role: 'classroom_staff',
      institutionId: id,
      authenticate: true,
    });
    setInviteBusy(false);
    if (res.error) {
      setInviteMsg(`Error: ${res.error}`);
      return;
    }
    setInviteMsg(`Created ${invite.email}.`);
    setInvite({ fullName: '', email: '', password: '' });
    const stf = await staffForInstitution(id);
    setStaff(stf.data ?? []);
  }

  async function onSaveInstitution() {
    setEditBusy(true);
    setEditMsg(null);
    const res = await updateInstitution(id, edit.name.trim(), edit.kind);
    setEditBusy(false);
    if (res.error) {
      setEditMsg(`Error: ${res.error}`);
      return;
    }
    setInstitution(res.data);
    setShowEdit(false);
  }
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';

  const [institution, setInstitution] = useState<Institution | null>(null);
  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [memberships, setMemberships] = useState<Array<{ class_id: string; class_name: string; user_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    void (async () => {
      const [inst, cls, studs, stf, mem] = await Promise.all([
        getInstitution(id),
        listClasses(),
        listStudents({ institutionId: id }),
        staffForInstitution(id),
        classStaffForInstitution(id),
      ]);
      if (!active) return;
      setError(inst.error ?? cls.error ?? studs.error ?? stf.error ?? mem.error);
      setInstitution(inst.data);
      setClasses((cls.data ?? []).filter((c) => c.institution_id === id));
      setStudents(studs.data ?? []);
      setStaff(stf.data ?? []);
      setMemberships(mem.data ?? []);
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
  const safetyNoteCount = useMemo(
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
          <Card
            title="Institution record"
            hint="the authoritative row every portal reads"
            actions={
              canEditInstitution ? (
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setEditMsg(null);
                    setEdit({ name: institution.name, kind: institution.kind });
                    setShowEdit(true);
                  }}
                >
                  Edit institution
                </Btn>
              ) : undefined
            }
          >
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
                  <td className="cell-sub">Students with safety notes</td>
                  <td className="mono">{safetyNoteCount}</td>
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

      {tab === 'calendar' && id && <InstitutionCalendarTab institutionId={id} />}

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
                      {(() => {
                        // Real staffing is the class_staff membership set (§16),
                        // not the single legacy teacher_id. A class may have
                        // several permitted staff, or none.
                        const names = memberships
                          .filter((m) => m.class_id === c.id)
                          .map((m) => staff.find((u) => u.user_id === m.user_id)?.full_name ?? 'Staff');
                        return names.length > 0 ? names.join(', ') : 'Unassigned';
                      })()}
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
            canInviteStaff ? (
              <Btn variant="brand" size="sm" onClick={() => setShowInvite(true)}>
                <Icon name="user" size={14} /> Provision classroom staff
              </Btn>
            ) : undefined
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
                  // Real assignments via class_staff (§16), not the retired teacher_id.
                  const assigned = memberships.filter((m) => m.user_id === u.user_id);
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
                        {assigned.length ? assigned.map((m) => m.class_name).join(', ') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {showEdit && institution && (
        <Modal
          title="Edit institution"
          onClose={() => setShowEdit(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowEdit(false)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void onSaveInstitution()}
                disabled={editBusy || edit.name.trim().length === 0}
              >
                {editBusy ? 'Saving…' : 'Save institution'}
              </Btn>
            </>
          }
        >
          {editMsg && <Banner kind="err">{editMsg}</Banner>}
          <Banner kind="info">
            Changes the institution record every portal reads. It does not touch this institution's
            service plan, menu assignment, calendar or already-published meals — those are
            effective-dated and live on the Service and Calendar tabs.
          </Banner>
          <Field label="Name">
            <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </Field>
          <Field label="Type">
            <select
              value={edit.kind}
              onChange={(e) => setEdit({ ...edit, kind: e.target.value as Institution['kind'] })}
            >
              <option value="nursery">Nursery</option>
              <option value="school">School</option>
            </select>
          </Field>
        </Modal>
      )}

      {showInvite && (
        <Modal
          title="Provision classroom staff"
          onClose={() => setShowInvite(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowInvite(false)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void onInvite()}
                disabled={inviteBusy || !invite.email || !invite.fullName || invite.password.length < 8}
              >
                {inviteBusy ? 'Creating…' : 'Create account'}
              </Btn>
            </>
          }
        >
          {inviteMsg && <Banner kind={inviteMsg.startsWith('Error') ? 'err' : 'info'}>{inviteMsg}</Banner>}
          <Banner kind="info">
            Creates a working Classroom Staff account scoped to this institution with the temporary
            password below — <b>no invitation email is sent from here</b>. Share it securely; the
            user signs in and should change it. Email-delivered self-activation is
            <b> BLOCKED_BY_SPEC</b>. Assign them to classes from the Classes or Staff screen.
          </Banner>
          <Field label="Full name">
            <input value={invite.fullName} onChange={(e) => setInvite({ ...invite, fullName: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          </Field>
          <Field label="Temporary password (min 8 chars)">
            <input type="text" value={invite.password} onChange={(e) => setInvite({ ...invite, password: e.target.value })} />
          </Field>
        </Modal>
      )}
    </div>
  );
}
