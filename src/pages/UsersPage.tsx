import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  adminSetPassword,
  createAccount,
  listInstitutions,
  listKitchens,
  listUsers,
  setUserActive,
  updateUserProfile,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { roleLabel } from '../lib/roleLabel';
import { provisionableRoles } from '../lib/roles';
import type { AppRole, AppUser, Kitchen } from '../lib/types';
import {
  Btn,
  Banner,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHead,
  PasswordInput,
  Pill,
  Spinner,
} from '../components/ui';

// Only roles whose product actually exists (see provisionableRoles). Issuing a
// Driver or Finance account today would hand somebody a sign-in whose only
// screen says the module is not built.
const ROLES: AppRole[] = provisionableRoles();

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: AppUser }
  | { kind: 'password'; user: AppUser }
  | { kind: 'lifecycle'; user: AppUser; activate: boolean }
  | null;

export default function UsersPage() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'parent' as AppRole,
    institutionId: '',
    kitchenId: '',
    phone: '',
  });
  // The lifecycle / password / edit dialogs each need one or two fields; they
  // are small enough to share one bag rather than three more useStates.
  const [scratch, setScratch] = useState({ reason: '', password: '', fullName: '', phone: '' });

  async function reload() {
    const fresh = await listUsers();
    if (fresh.error) setError(fresh.error);
    setUsers(fresh.data ?? []);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const [u, i, k] = await Promise.all([listUsers(), listInstitutions(), listKitchens()]);
      if (!active) return;
      if (u.error || i.error || k.error) setError(u.error ?? i.error ?? k.error);
      setUsers(u.data ?? []);
      setInstitutions(i.data ?? []);
      setKitchens(k.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  // kitchen is a LunchBox Connect entity, not an Institution (docs/13 Decision 031).
  const needsInstitution = ['school_admin', 'classroom_staff'].includes(form.role);
  const needsKitchen = form.role === 'kitchen';

  const scopeOf = (u: AppUser) =>
    u.institution_id
      ? (institutions.find((i) => i.id === u.institution_id)?.name ?? '—')
      : u.kitchen_id
        ? (kitchens.find((k) => k.id === u.kitchen_id)?.name ?? '—') + ' (Kitchen)'
        : 'Whole platform';

  const shown = useMemo(
    () => (users ?? []).filter((u) => showInactive || u.active),
    [users, showInactive],
  );
  const inactiveCount = (users ?? []).filter((u) => !u.active).length;

  // A Super Admin may act on anyone; an Institution Admin only on their own
  // classroom staff. This mirrors app_may_manage_account() so the interface
  // does not offer buttons the database will refuse — but the database is
  // still the boundary, and it re-checks every one of these calls.
  const mayManage = (u: AppUser) =>
    me?.role === 'super_admin' ||
    (me?.role === 'school_admin' &&
      u.role === 'classroom_staff' &&
      u.institution_id !== null &&
      u.institution_id === me.institution_id);

  function openDialog(next: Dialog) {
    setDialogError(null);
    setNotice(null);
    if (next?.kind === 'edit') {
      setScratch({
        reason: '',
        password: '',
        fullName: next.user.full_name,
        phone: next.user.phone ?? '',
      });
    } else {
      setScratch({ reason: '', password: '', fullName: '', phone: '' });
    }
    setDialog(next);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDialogError(null);
    const res = await createAccount({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      role: form.role,
      institutionId: needsInstitution ? form.institutionId || null : null,
      kitchenId: needsKitchen ? form.kitchenId || null : null,
      phone: form.phone.trim() || null,
      // The account must actually be usable with the password set here, so it
      // is confirmed on creation. Accounts are administrator-issued by product
      // decision: no invitation email is sent.
      authenticate: true,
    });
    setBusy(false);
    if (res.error) {
      setDialogError(res.error);
      return;
    }
    setDialog(null);
    setForm({
      email: '',
      password: '',
      fullName: '',
      role: 'parent',
      institutionId: '',
      kitchenId: '',
      phone: '',
    });
    setNotice('Account created. Give the person their email address and the password you set.');
    await reload();
  }

  async function onSaveDetails(user: AppUser) {
    setBusy(true);
    setDialogError(null);
    const res = await updateUserProfile(user.user_id, scratch.fullName, scratch.phone || null);
    setBusy(false);
    if (res.error) {
      setDialogError(res.error);
      return;
    }
    setDialog(null);
    setNotice(`Updated ${scratch.fullName.trim()}.`);
    await reload();
  }

  async function onSetPassword(user: AppUser) {
    setBusy(true);
    setDialogError(null);
    const res = await adminSetPassword(user.user_id, scratch.password, scratch.reason || null);
    setBusy(false);
    if (res.error) {
      setDialogError(res.error);
      return;
    }
    setDialog(null);
    setNotice(
      res.data?.warning ??
        `A new password is set for ${user.full_name}. Give it to them directly — it is not emailed, and it cannot be looked up again.`,
    );
  }

  async function onSetActive(user: AppUser, activate: boolean) {
    setBusy(true);
    setDialogError(null);
    const res = await setUserActive(user.user_id, activate, scratch.reason || null);
    setBusy(false);
    if (res.error) {
      // The database's refusal, verbatim — it explains WHY, and the action is
      // never quietly turned into something else.
      setDialogError(res.error);
      return;
    }
    setDialog(null);
    setNotice(
      res.data?.warning ??
        (activate
          ? `${user.full_name} can sign in again. Class assignments removed at deactivation were not restored — reassign them if they are still needed.`
          : `${user.full_name} can no longer sign in or read anything. Nothing was deleted.`),
    );
    await reload();
  }

  if (error && !users) return <EmptyState text={`Could not load users: ${error}`} />;

  return (
    <div>
      <PageHead
        title="Users & roles"
        hint="create accounts, correct details, issue passwords, and deactivate people who have left"
        actions={
          <Btn variant="brand" onClick={() => openDialog({ kind: 'create' })}>
            + Create account
          </Btn>
        }
      />
      {notice && <Banner kind="ok">{notice}</Banner>}
      {error && users && <Banner kind="err">{error}</Banner>}
      <Banner kind="info">
        Accounts are <b>deactivated, never deleted</b>. A person who has recorded a meal, published
        a note or approved anything is named in that history, and deleting them would either destroy
        the record or leave it pointing at nobody. Deactivating stops them signing in and stops them
        reading anything, immediately.
      </Banner>

      {!users ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState text="No accounts yet." />
      ) : (
        <Card>
          {inactiveCount > 0 && (
            <div style={{ padding: '12px 18px 0' }}>
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show deactivated accounts ({inactiveCount})
              </label>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Scope</th>
                <th>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.user_id} className={u.active ? undefined : 'row-muted'}>
                  <td className="cell-name">
                    {u.full_name}
                    <span className="cell-sub"> {u.email}</span>
                  </td>
                  <td>
                    <Pill variant={u.role === 'super_admin' ? 'brand' : 'slate'}>
                      {roleLabel(u.role)}
                    </Pill>
                  </td>
                  <td className="cell-sub">{scopeOf(u)}</td>
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
                    {mayManage(u) && (
                      <>
                        <Btn variant="ghost" onClick={() => openDialog({ kind: 'edit', user: u })}>
                          Edit
                        </Btn>
                        <Btn
                          variant="ghost"
                          onClick={() => openDialog({ kind: 'password', user: u })}
                        >
                          Set password
                        </Btn>
                        <Btn
                          variant="ghost"
                          onClick={() =>
                            openDialog({ kind: 'lifecycle', user: u, activate: !u.active })
                          }
                        >
                          {u.active ? 'Deactivate' : 'Reactivate'}
                        </Btn>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {dialog?.kind === 'create' && (
        <Modal
          title="Create account"
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={(e) => void onCreate(e as unknown as FormEvent)}
                disabled={
                  busy ||
                  !form.email.trim() ||
                  !form.fullName.trim() ||
                  form.password.length < 8 ||
                  (needsInstitution && !form.institutionId) ||
                  (needsKitchen && !form.kitchenId)
                }
              >
                {busy ? 'Creating…' : 'Create account'}
              </Btn>
            </>
          }
        >
          <form onSubmit={(e) => void onCreate(e)}>
            {dialogError && <Banner kind="err">{dialogError}</Banner>}
            <Banner kind="info">
              This provisions a working account with the password you set —{' '}
              <b>no invitation email is sent</b>. Share it with the person directly. They can change
              it themselves from their own profile once they are signed in, and you can issue a new
              one at any time from this screen.
            </Banner>
            <div className="form-row">
              <Field label="Full name">
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  autoFocus
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Password (min 8)">
                <PasswordInput
                  value={form.password}
                  onChange={(v) => setForm({ ...form, password: v })}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Role">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-row">
              {needsKitchen ? (
                <Field label="Kitchen (required — LunchBox Connect entity, not an institution)">
                  <select
                    value={form.kitchenId}
                    onChange={(e) => setForm({ ...form, kitchenId: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {kitchens.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field
                  label={
                    needsInstitution ? 'Institution (required for staff)' : 'Institution (optional)'
                  }
                >
                  <select
                    value={form.institutionId}
                    onChange={(e) => setForm({ ...form, institutionId: e.target.value })}
                    disabled={!needsInstitution}
                  >
                    <option value="">{needsInstitution ? 'Select…' : 'Not applicable'}</option>
                    {institutions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Phone (optional)">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal
          title={`Edit ${dialog.user.full_name}`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void onSaveDetails(dialog.user)}
                disabled={busy || !scratch.fullName.trim()}
              >
                {busy ? 'Saving…' : 'Save'}
              </Btn>
            </>
          }
        >
          {dialogError && <Banner kind="err">{dialogError}</Banner>}
          <div className="form-row">
            <Field label="Full name">
              <input
                value={scratch.fullName}
                onChange={(e) => setScratch({ ...scratch, fullName: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                value={scratch.phone}
                onChange={(e) => setScratch({ ...scratch, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Email (sign-in identity)">
            <input value={dialog.user.email} readOnly disabled />
          </Field>
          <div style={{ height: 12 }} />
          <Banner kind="info">
            The email address is what this person signs in with, and it is held by the sign-in
            service as well as here. Changing it correctly means moving both together and confirming
            the new address — that workflow does not exist yet, so it is not editable. To move
            someone to a new address, create their new account and deactivate this one.
          </Banner>
          <Banner kind="info">
            Role and scope are not editable either. They decide what this account is allowed to
            read, and a session issued under the old role would carry the new one's reach. Create a
            correctly-scoped account instead, and deactivate this one.
          </Banner>
        </Modal>
      )}

      {dialog?.kind === 'password' && (
        <Modal
          title={`Set a password for ${dialog.user.full_name}`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void onSetPassword(dialog.user)}
                disabled={busy || scratch.password.length < 8}
              >
                {busy ? 'Setting…' : 'Set password'}
              </Btn>
            </>
          }
        >
          {dialogError && <Banner kind="err">{dialogError}</Banner>}
          <Banner kind="info">
            Their current password <b>cannot be looked up</b> — the platform stores a one-way hash
            of it, not the password itself. You are issuing a replacement. Tell them what it is;
            they can change it themselves afterwards from their own profile.
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
              placeholder="e.g. forgotten password, requested by phone"
            />
          </Field>
          <div style={{ height: 12 }} />
          <Banner kind="warn">
            The audit trail records <b>that</b> you issued a password and why — never the password
            itself.
          </Banner>
        </Modal>
      )}

      {dialog?.kind === 'lifecycle' && (
        <Modal
          title={
            dialog.activate
              ? `Reactivate ${dialog.user.full_name}`
              : `Deactivate ${dialog.user.full_name}`
          }
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Btn>
              <Btn
                variant={dialog.activate ? 'brand' : 'danger'}
                onClick={() => void onSetActive(dialog.user, dialog.activate)}
                disabled={busy}
              >
                {busy ? 'Working…' : dialog.activate ? 'Reactivate' : 'Deactivate'}
              </Btn>
            </>
          }
        >
          {dialogError && <Banner kind="err">{dialogError}</Banner>}
          {dialog.activate ? (
            <Banner kind="info">
              {dialog.user.full_name} will be able to sign in again with the same password, and will
              see exactly what their role allows — nothing more. Any class assignments that were
              removed when they were deactivated are <b>not</b> restored; assign them again if they
              are still needed.
            </Banner>
          ) : (
            <Banner kind="warn">
              {dialog.user.full_name} will not be able to sign in, and any session they already hold
              stops reading and writing immediately. Classroom class assignments are ended.
              <b> Nothing is deleted</b> — their account, and every record that names them, stays
              exactly as it is, and you can reactivate them at any time.
            </Banner>
          )}
          <Field
            label={dialog.activate ? 'Reason (optional)' : 'Reason (optional — recorded in Audit)'}
          >
            <input
              value={scratch.reason}
              onChange={(e) => setScratch({ ...scratch, reason: e.target.value })}
              placeholder={dialog.activate ? 'e.g. returned from leave' : 'e.g. left the nursery'}
              autoFocus
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
