import { useEffect, useMemo, useState } from 'react';
import {
  addClassStaff,
  classStaffForInstitution,
  createAccount,
  listClasses,
  listInstitutions,
  removeClassStaff,
  adminSetPassword,
  setUserActive,
  staffForInstitution,
  updateUserProfile,
  type ClassWithMeta,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import type { AppUser, Institution } from '../lib/types';
import {
  Banner,
  Btn,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHead,
  PasswordInput,
  Pill,
  Spinner,
} from '../components/ui';
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

  /**
   * THE SAME AUTHORITY A SUPER ADMIN HAS, ON THE SCREEN THIS ROLE CAN REACH.
   *
   * app_may_manage_account() has always let a Nursery Admin deactivate, rename
   * and re-password THEIR OWN classroom staff. Nothing served it: Users &
   * roles is Super-Admin-only, so the authority existed in the database with
   * no way for the person holding it to use it. This is that way.
   *
   * A Super Admin who has drilled into an institution gets the same controls
   * here, over the same people — it is one rule, not two.
   */
  const [staffDialog, setStaffDialog] = useState<
    | { kind: 'edit'; user: AppUser }
    | { kind: 'password'; user: AppUser }
    | { kind: 'lifecycle'; user: AppUser; activate: boolean }
    | null
  >(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [scratch, setScratch] = useState({ fullName: '', phone: '', password: '', reason: '' });
  const [showInactive, setShowInactive] = useState(true);

  function openStaffDialog(next: typeof staffDialog) {
    setDialogError(null);
    setMsg(null);
    setScratch({
      fullName: next?.kind === 'edit' ? next.user.full_name : '',
      phone: next?.kind === 'edit' ? (next.user.phone ?? '') : '',
      password: '',
      reason: '',
    });
    setStaffDialog(next);
  }

  async function onSaveStaffDetails(u: AppUser) {
    setDialogBusy(true);
    setDialogError(null);
    const res = await updateUserProfile(u.user_id, scratch.fullName, scratch.phone || null);
    setDialogBusy(false);
    if (res.error) return setDialogError(res.error);
    setStaffDialog(null);
    setMsg(`Updated ${scratch.fullName.trim()}.`);
    await reload(institutionId);
  }

  async function onSetStaffPassword(u: AppUser) {
    setDialogBusy(true);
    setDialogError(null);
    const res = await adminSetPassword(u.user_id, scratch.password, scratch.reason || null);
    setDialogBusy(false);
    if (res.error) return setDialogError(res.error);
    setStaffDialog(null);
    setMsg(
      res.data?.warning ??
        `A new password is set for ${u.full_name}. Give it to them directly — it cannot be looked up again.`,
    );
  }

  async function onSetStaffActive(u: AppUser, activate: boolean) {
    setDialogBusy(true);
    setDialogError(null);
    const res = await setUserActive(u.user_id, activate, scratch.reason || null);
    setDialogBusy(false);
    if (res.error) return setDialogError(res.error);
    setStaffDialog(null);
    setMsg(
      res.data?.warning ??
        (activate
          ? `${u.full_name} can sign in again. Their old class assignments were not restored — assign them again if they are still needed.`
          : `${u.full_name} can no longer sign in, and their class assignments have ended. Nothing was deleted.`),
    );
    await reload(institutionId);
  }

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
      // The account is usable immediately with the password set below; no email
      // is dispatched from here (see the note in the modal).
      authenticate: true,
    });
    setBusy(false);
    if (res.error) {
      setMsg(`Error: ${res.error}`);
      return;
    }
    setMsg(`Account created for ${form.email}. Share the password securely.`);
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
      {msg && !showProvision && (
        <Banner kind={msg.startsWith('Error') ? 'err' : 'ok'}>{msg}</Banner>
      )}
      <Banner kind="info">
        Staff are <b>deactivated, never deleted</b>. A person who has recorded a meal is named in
        that record, so the account has to keep existing for the record to keep meaning anything.
        Deactivating stops them signing in immediately, and ends their class assignments.
      </Banner>

      {isSuper && (
        <Card bodyClassName="filters">
          <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
            <option value="">Select an institution…</option>
            {/* An archived institution takes on no new people — migration 0046
                refuses the write even from the service role the Edge Function
                uses. Listing it here would offer a refusal. */}
            {institutions
              .filter((i) => i.active)
              .map((i) => (
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
          {staff.some((u) => !u.active) && (
            <div style={{ padding: '12px 18px 0' }}>
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show deactivated staff ({staff.filter((u) => !u.active).length})
              </label>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Assigned classes</th>
                <th>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staff
                .filter((u) => showInactive || u.active)
                .map((u) => {
                  const assigned = assignedFor(u);
                  return (
                    <tr key={u.user_id} className={u.active ? undefined : 'row-muted'}>
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
                        {u.active ? (
                          <Pill variant="green">Active</Pill>
                        ) : (
                          <Pill variant="slate">Deactivated</Pill>
                        )}
                        {!u.active && u.deactivated_reason && (
                          <div className="cell-sub">{u.deactivated_reason}</div>
                        )}
                      </td>
                      <td className="row-actions">
                        {u.active && (
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
                        )}
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => openStaffDialog({ kind: 'edit', user: u })}
                        >
                          Edit
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => openStaffDialog({ kind: 'password', user: u })}
                        >
                          Set password
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            openStaffDialog({ kind: 'lifecycle', user: u, activate: !u.active })
                          }
                        >
                          {u.active ? 'Deactivate' : 'Reactivate'}
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
            password you set below — <b>no invitation email is sent from here</b>. Share it
            securely; the person can sign in immediately, and can change it themselves from their
            own account screen afterwards. If they forget it, issue them a new one from this page —
            nobody can look up an existing password.
          </Banner>
          <Field label="Full name">
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Password (min 8)">
            <PasswordInput
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              autoComplete="new-password"
            />
          </Field>
        </Modal>
      )}

      {staffDialog?.kind === 'edit' && (
        <Modal
          title={`Edit ${staffDialog.user.full_name}`}
          onClose={() => setStaffDialog(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setStaffDialog(null)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void onSaveStaffDetails(staffDialog.user)}
                disabled={dialogBusy || !scratch.fullName.trim()}
              >
                {dialogBusy ? 'Saving…' : 'Save'}
              </Btn>
            </>
          }
        >
          {dialogError && <Banner kind="err">{dialogError}</Banner>}
          <Field label="Full name">
            <input
              value={scratch.fullName}
              onChange={(e) => setScratch({ ...scratch, fullName: e.target.value })}
              autoFocus
            />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Phone (optional)">
            <input
              value={scratch.phone}
              onChange={(e) => setScratch({ ...scratch, phone: e.target.value })}
            />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Email (sign-in identity)">
            <input value={staffDialog.user.email} readOnly disabled />
          </Field>
          <div style={{ height: 12 }} />
          <Banner kind="info">
            The email address is what this person signs in with, and it is held by the sign-in
            service as well as here. Changing it correctly means moving both together and confirming
            the new address — that workflow does not exist yet, so it is not editable.
          </Banner>
        </Modal>
      )}

      {staffDialog?.kind === 'password' && (
        <Modal
          title={`Set a password for ${staffDialog.user.full_name}`}
          onClose={() => setStaffDialog(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setStaffDialog(null)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void onSetStaffPassword(staffDialog.user)}
                disabled={dialogBusy || scratch.password.length < 8}
              >
                {dialogBusy ? 'Setting…' : 'Set password'}
              </Btn>
            </>
          }
        >
          {dialogError && <Banner kind="err">{dialogError}</Banner>}
          <Banner kind="info">
            Their current password <b>cannot be looked up</b> — the platform stores a one-way hash
            of it, not the password itself. You are issuing a replacement. Tell them what it is;
            they can change it themselves afterwards from their own account screen.
          </Banner>
          <Field label="New password (min 8)">
            <PasswordInput
              value={scratch.password}
              onChange={(v) => setScratch({ ...scratch, password: v })}
              autoComplete="new-password"
              autoFocus
            />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Reason (optional — recorded in Audit)">
            <input
              value={scratch.reason}
              onChange={(e) => setScratch({ ...scratch, reason: e.target.value })}
              placeholder="e.g. forgotten password"
            />
          </Field>
          <div style={{ height: 12 }} />
          <Banner kind="warn">
            The audit trail records <b>that</b> you issued a password and why — never the password
            itself.
          </Banner>
        </Modal>
      )}

      {staffDialog?.kind === 'lifecycle' && (
        <Modal
          title={
            staffDialog.activate
              ? `Reactivate ${staffDialog.user.full_name}`
              : `Deactivate ${staffDialog.user.full_name}`
          }
          onClose={() => setStaffDialog(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setStaffDialog(null)}>
                Cancel
              </Btn>
              <Btn
                variant={staffDialog.activate ? 'brand' : 'danger'}
                onClick={() => void onSetStaffActive(staffDialog.user, staffDialog.activate)}
                disabled={dialogBusy}
              >
                {dialogBusy ? 'Working…' : staffDialog.activate ? 'Reactivate' : 'Deactivate'}
              </Btn>
            </>
          }
        >
          {dialogError && <Banner kind="err">{dialogError}</Banner>}
          {staffDialog.activate ? (
            <Banner kind="info">
              {staffDialog.user.full_name} will be able to sign in again with the same password.
              Class assignments removed when they were deactivated are <b>not</b> restored — assign
              them again if they are still needed.
            </Banner>
          ) : (
            <Banner kind="warn">
              {staffDialog.user.full_name} will not be able to sign in, and any session they already
              have open stops reading and writing immediately. Their class assignments end.{' '}
              <b>Nothing is deleted</b> — every meal they recorded still names them, and you can
              reactivate them at any time.
            </Banner>
          )}
          <Field label="Reason (optional — recorded in Audit)">
            <input
              value={scratch.reason}
              onChange={(e) => setScratch({ ...scratch, reason: e.target.value })}
              placeholder={staffDialog.activate ? 'e.g. back from leave' : 'e.g. left the setting'}
              autoFocus
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
