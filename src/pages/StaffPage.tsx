import { useEffect, useMemo, useState } from 'react';
import {
  addClassStaff,
  classStaffForInstitution,
  createAccount,
  listClasses,
  listInstitutions,
  removeClassStaff,
  staffForInstitution,
  type ClassWithMeta,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import type { AppUser, Institution } from '../lib/types';
import { Banner, Btn, Card, EmptyState, Field, Modal, PageHead, Pill, Spinner } from '../components/ui';
import { Icon } from '../components/icons';

type Membership = { class_id: string; class_name: string; user_id: string };

/**
 * Staff management (§4/§17). An institution-scoped page a Nursery Admin can
 * actually reach — the invite/provision flow previously lived only inside the
 * super-admin Institution Detail route. A Nursery Admin manages classroom staff
 * for their OWN institution here; a Super Admin picks an institution first. The
 * Edge Function and RLS enforce the same institution boundary server-side.
 */
export default function StaffPage() {
  const { profile } = useAuth();
  const isSuper = profile?.role === 'super_admin';

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState<string>(
    isSuper ? '' : (profile?.institution_id ?? ''),
  );
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showProvision, setShowProvision] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });

  const [assignFor, setAssignFor] = useState<AppUser | null>(null);
  const [addClassId, setAddClassId] = useState('');

  useEffect(() => {
    if (!isSuper) return;
    void listInstitutions().then((r) => setInstitutions(r.data ?? []));
  }, [isSuper]);

  async function reload(inst: string) {
    if (!inst) {
      setStaff([]);
      setClasses([]);
      setMemberships([]);
      return;
    }
    setLoading(true);
    const [s, c, m] = await Promise.all([
      staffForInstitution(inst),
      listClasses(),
      classStaffForInstitution(inst),
    ]);
    setError(s.error ?? c.error ?? m.error);
    setStaff((s.data ?? []).filter((u) => u.role === 'classroom_staff'));
    setClasses((c.data ?? []).filter((cl) => cl.institution_id === inst));
    setMemberships(m.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void reload(institutionId);
  }, [institutionId]);

  async function onProvision() {
    if (!institutionId) return;
    setBusy(true);
    setMsg(null);
    const res = await createAccount({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      role: 'classroom_staff',
      institutionId,
      // The account is usable immediately with the temporary password below;
      // no email is dispatched from here (see the note in the modal).
      authenticate: true,
    });
    setBusy(false);
    if (res.error) {
      setMsg(`Error: ${res.error}`);
      return;
    }
    setMsg(`Account created for ${form.email}. Share the temporary password securely.`);
    setForm({ fullName: '', email: '', password: '' });
    await reload(institutionId);
  }

  async function onAddClass() {
    if (!assignFor || !addClassId) return;
    const res = await addClassStaff(addClassId, assignFor.user_id);
    if (res.error) return setError(res.error);
    setAddClassId('');
    const m = await classStaffForInstitution(institutionId);
    setMemberships(m.data ?? []);
  }

  async function onRemoveClass(classId: string, userId: string) {
    const res = await removeClassStaff(classId, userId);
    if (res.error) return setError(res.error);
    const m = await classStaffForInstitution(institutionId);
    setMemberships(m.data ?? []);
  }

  const assignedFor = useMemo(
    () => (u: AppUser) => memberships.filter((m) => m.user_id === u.user_id),
    [memberships],
  );

  return (
    <div>
      <PageHead
        title="Staff"
        hint="provision classroom staff and assign them to classes — your institution only"
        actions={
          institutionId ? (
            <Btn
              variant="brand"
              onClick={() => {
                setMsg(null);
                setShowProvision(true);
              }}
            >
              <Icon name="user" size={14} /> Provision classroom staff
            </Btn>
          ) : undefined
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      {isSuper && (
        <Card bodyClassName="filters">
          <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
            <option value="">Select an institution…</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Card>
      )}

      {!institutionId ? (
        <EmptyState text="Select an institution to manage its staff." />
      ) : loading ? (
        <Spinner />
      ) : staff.length === 0 ? (
        <EmptyState text="No classroom staff for this institution yet. Provision one above." />
      ) : (
        <Card>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Assigned classes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => {
                const assigned = assignedFor(u);
                return (
                  <tr key={u.user_id}>
                    <td className="cell-name">{u.full_name}</td>
                    <td className="cell-sub">{u.email}</td>
                    <td>
                      {assigned.length === 0 ? (
                        <span className="cell-sub">Unassigned</span>
                      ) : (
                        <ul className="staff-chips">
                          {assigned.map((m) => (
                            <li key={m.class_id}>
                              <span>{m.class_name}</span>
                              <button
                                className="chip-x"
                                onClick={() => void onRemoveClass(m.class_id, u.user_id)}
                              >
                                remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAssignFor(u);
                          setAddClassId('');
                        }}
                      >
                        Assign class
                      </Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {showProvision && (
        <Modal
          title="Provision classroom staff"
          onClose={() => setShowProvision(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowProvision(false)}>
                Close
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void onProvision()}
                disabled={busy || !form.email || !form.fullName || form.password.length < 8}
              >
                {busy ? 'Creating…' : 'Create account'}
              </Btn>
            </>
          }
        >
          {msg && <Banner kind={msg.startsWith('Error') ? 'err' : 'info'}>{msg}</Banner>}
          <Banner kind="info">
            This creates a working classroom-staff account for <b>your institution</b> with the
            temporary password you set below — <b>no invitation email is sent from here</b>. Share
            the password securely; the user signs in and should change it. An email-delivered
            self-activation flow is <b>BLOCKED_BY_SPEC</b> until the sending mechanism is decided.
          </Banner>
          <Field label="Full name">
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Temporary password (min 8 — share securely)">
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
        </Modal>
      )}

      {assignFor && (
        <Modal
          title={`Assign ${assignFor.full_name} to a class`}
          onClose={() => setAssignFor(null)}
          footer={
            <Btn variant="ghost" onClick={() => setAssignFor(null)}>
              Done
            </Btn>
          }
        >
          <p className="tmc-meta">
            A staff member may cover several classes; a class may have several staff.
          </p>
          <div className="staff-chips" style={{ marginBottom: 12 }}>
            {assignedFor(assignFor).map((m) => (
              <Pill key={m.class_id} variant="slate">
                {m.class_name}
              </Pill>
            ))}
          </div>
          <Field label="Add to class">
            <select value={addClassId} onChange={(e) => setAddClassId(e.target.value)}>
              <option value="">— choose class —</option>
              {classes
                .filter((c) => !assignedFor(assignFor).some((m) => m.class_id === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Btn variant="brand" onClick={() => void onAddClass()} disabled={!addClassId}>
            Add to class
          </Btn>
        </Modal>
      )}
    </div>
  );
}
