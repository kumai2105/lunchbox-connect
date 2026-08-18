import { useEffect, useState, type FormEvent } from 'react';
import { createAccount, listInstitutions, listUsers } from '../lib/api';
import type { AppRole, AppUser } from '../lib/types';
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
  StatusDot,
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
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'parent' as AppRole,
    institutionId: '',
    phone: '',
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      const [u, i] = await Promise.all([listUsers(), listInstitutions()]);
      if (!active) return;
      if (u.error || i.error) setError(u.error ?? i.error);
      setUsers(u.data ?? []);
      setInstitutions(i.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const needsInstitution = ['school_admin', 'classroom_staff', 'kitchen'].includes(form.role);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createAccount({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      role: form.role,
      institutionId: needsInstitution ? form.institutionId || null : null,
      phone: form.phone.trim() || null,
      authenticate: false,
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
          <Btn variant="brand" onClick={() => setShowCreate(true)}>
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
                <th>Status</th>
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
                      : 'All / none'}
                  </td>
                  <td>
                    <StatusDot color="green" /> Active
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
                  (needsInstitution && !form.institutionId)
                }
              >
                {busy ? 'Creating…' : 'Create account'}
              </Btn>
            </>
          }
        >
          <form onSubmit={(e) => void onSubmit(e)}>
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
