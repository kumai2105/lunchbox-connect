import { useEffect, useState, type FormEvent } from 'react';
import { createAccount, listInstitutions, listKitchens, listUsers } from '../lib/api';
import type { AppRole, AppUser, Kitchen } from '../lib/types';
import {
  Btn,
  Banner,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHead,
  Pill,
  Spinner,
} from '../components/ui';

const ROLES: AppRole[] = [
  'super_admin',
  'school_admin',
  'operations_manager',
  'finance_owner',
  'viewer',
  'parent',
  'classroom_staff',
  'kitchen',
  'driver',
];

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'parent' as AppRole,
    institutionId: '',
    kitchenId: '',
    phone: '',
  });

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createAccount({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      role: form.role,
      institutionId: needsInstitution ? form.institutionId || null : null,
      kitchenId: needsKitchen ? form.kitchenId || null : null,
      phone: form.phone.trim() || null,
      // §5: the account must actually be usable with the password set here —
      // confirm it so the person can sign in immediately. Accounts are issued
      // by an administrator by decision, not pending one: there is no email
      // invitation flow and no self-service reset. This matches the copy in the
      // modal and the other provisioning entry points.
      authenticate: true,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setShowCreate(false);
    setForm({
      email: '',
      password: '',
      fullName: '',
      role: 'parent',
      institutionId: '',
      kitchenId: '',
      phone: '',
    });
    const fresh = await listUsers();
    setUsers(fresh.data ?? users);
  }

  if (error && !users) return <EmptyState text={`Could not load users: ${error}`} />;

  return (
    <div>
      <PageHead
        title="Users & roles"
        hint="accounts are created here; the Edge Function provisions auth + profile atomically"
        actions={
          <Btn
            variant="brand"
            onClick={() => {
              setError(null);
              setShowCreate(true);
            }}
          >
            + Create account
          </Btn>
        }
      />
      <Banner kind="info">
        The first SUPER_ADMIN is seeded via the SQL editor (runbook step 7). Every other account —
        all nine roles — flows through this screen.
      </Banner>

      {!users ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState text="No accounts yet." />
      ) : (
        <Card>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Scope</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td className="cell-name">
                    {u.full_name}
                    <span className="cell-sub"> {u.email}</span>
                  </td>
                  <td>
                    <Pill variant={u.role === 'super_admin' ? 'brand' : 'slate'}>
                      {u.role.toUpperCase()}
                    </Pill>
                  </td>
                  <td className="cell-sub">
                    {u.institution_id
                      ? (institutions.find((i) => i.id === u.institution_id)?.name ?? '—')
                      : u.kitchen_id
                        ? (kitchens.find((k) => k.id === u.kitchen_id)?.name ?? '—') + ' (Kitchen)'
                        : 'All / none'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate && (
        <Modal
          title="Create account"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={(e) => void onSubmit(e as unknown as FormEvent)}
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
          <form onSubmit={(e) => void onSubmit(e)}>
            {error && <Banner kind="err">{error}</Banner>}
            <Banner kind="info">
              This provisions a working account with the password you set — <b>no invitation
              email is sent</b>. Share it securely; the person can sign in immediately.
              Passwords are issued by an administrator: there is <b>no self-service reset</b>,
              so keep a record of what you set.
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
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              <Field label="Role">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.toUpperCase()}
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
    </div>
  );
}
