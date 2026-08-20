import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { linkGuardian, listGuardians, listStudents, listUsers } from '../lib/api';
import type { AppUser, Student } from '../lib/types';
import { useRole } from '../lib/auth';
import { can } from '../lib/rbac';
import { Banner, Btn, Card, EmptyState, Field, Modal, PageHead, Spinner } from '../components/ui';

interface GuardianRow {
  user_id: string;
  student_id: string;
  student?: { given_name?: string; family_name?: string; student_no?: string } | null;
}

/** Parents / guardians registry (docs/06 §§29; scoped roles only, via RLS). */
export default function GuardiansPage() {
  const [rows, setRows] = useState<GuardianRow[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [parentUsers, setParentUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const role = useRole();
  // §5: exact Nursery guardian actions are NOT_YET_DEFINED. Only Super Admin may
  // link/create; a Nursery Admin gets read-only visibility of existing links,
  // and the Parent association/provisioning workflow is BLOCKED_BY_SPEC.
  const canLink = can(role, 'guardians', 'create');

  async function load() {
    // student_parents embeds the authoritative student record (no copies)
    const [g, s, u] = await Promise.all([listGuardians(), listStudents(), listUsers()]);
    if (g.error || s.error || u.error) setError(g.error ?? s.error ?? u.error);
    setRows((g.data ?? []) as GuardianRow[]);
    setStudents(s.data ?? []);
    setParentUsers((u.data ?? []).filter((x) => x.role === 'parent'));
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(
    () =>
      [...(rows ?? [])].sort((a, b) =>
        (a.student?.family_name ?? '').localeCompare(b.student?.family_name ?? ''),
      ),
    [rows],
  );

  async function onLink(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await linkGuardian(studentId, userId);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setShowLink(false);
    setStudentId('');
    setUserId('');
    await load();
  }

  return (
    <div>
      <PageHead
        title="Parents / guardians"
        hint="linked to children through the authoritative student record"
        actions={
          canLink ? (
            <Btn variant="brand" onClick={() => setShowLink(true)}>
              + Link guardian
            </Btn>
          ) : undefined
        }
      />
      {error && <Banner kind="err">{error}</Banner>}
      {!canLink && (
        <Banner kind="info">
          Read-only. The exact Nursery guardian workflow — linking, creating, or
          provisioning Parent accounts — is <b>BLOCKED_BY_SPEC</b> and not yet defined.
        </Banner>
      )}
      <Card title="Guardian links">
        {!sorted.length && !rows ? (
          <Spinner />
        ) : sorted.length === 0 ? (
          <EmptyState text="No guardian links yet — link a parent account to a student to start the chain." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Student no.</th>
                <th>Guardian (user)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={`${r.user_id}-${r.student_id}`}>
                  <td className="cell-name">
                    {r.student?.given_name} {r.student?.family_name}
                  </td>
                  <td className="mono cell-sub">{r.student?.student_no ?? ''}</td>
                  <td className="mono cell-sub">
                    {parentUsers.find((u) => u.user_id === r.user_id)?.full_name ??
                      `${r.user_id.slice(0, 8)}…`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showLink && (
        <Modal
          title="Link guardian to student"
          onClose={() => setShowLink(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowLink(false)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={(e) => void onLink(e as unknown as FormEvent)}
                disabled={busy || !studentId || !userId}
              >
                {busy ? 'Linking…' : 'Link'}
              </Btn>
            </>
          }
        >
          {parentUsers.length === 0 ? (
            <Banner kind="warn">
              No PARENT-role accounts exist yet. Create one from Users & roles first.
            </Banner>
          ) : (
            <form onSubmit={(e) => void onLink(e)}>
              <Field label="Student">
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} autoFocus>
                  <option value="">Select…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.given_name} {s.family_name} ({s.student_no})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Parent / guardian account">
                <select value={userId} onChange={(e) => setUserId(e.target.value)}>
                  <option value="">Select…</option>
                  {parentUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </Field>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
