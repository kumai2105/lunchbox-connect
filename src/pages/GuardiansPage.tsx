import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  linkGuardian,
  listGuardians,
  listStudents,
  listUsers,
  revokeGuardianAccess,
} from '../lib/api';
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
  // Only a Super Admin may create a guardian link or end one. An Institution
  // Admin sees the links their children already have — who at a nursery may
  // end a guardian relationship, and on whose authority, is NOT_YET_DEFINED,
  // so it is not invented here.
  const canLink = can(role, 'guardians', 'create');
  const canRevoke = can(role, 'guardians', 'delete');

  const [revoking, setRevoking] = useState<GuardianRow | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function onRevoke(row: GuardianRow) {
    setRevokeBusy(true);
    setRevokeError(null);
    const res = await revokeGuardianAccess(row.student_id, row.user_id, revokeReason);
    setRevokeBusy(false);
    if (res.error) {
      setRevokeError(res.error);
      return;
    }
    const childName = `${row.student?.given_name ?? ''} ${row.student?.family_name ?? ''}`.trim();
    setRevoking(null);
    setRevokeReason('');
    setNotice(
      `Access ended. This person can no longer see ${childName || 'this child'}. Their account, the child, and every meal record are untouched.`,
    );
    await load();
  }

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
        hint="who is allowed to see which child"
        actions={
          canLink ? (
            <Btn variant="brand" onClick={() => setShowLink(true)}>
              + Link guardian
            </Btn>
          ) : undefined
        }
      />
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}
      {!canLink && (
        <Banner kind="info">
          Read-only. Linking guardians, and creating Parent accounts from here, are{' '}
          <b>not available yet</b>.
        </Banner>
      )}
      <Card title="Guardian links">
        {!sorted.length && !rows ? (
          <Spinner />
        ) : sorted.length === 0 ? (
          <EmptyState
            text={
              canLink
                ? 'No guardian links yet — link a parent account to a student to start the chain.'
                : 'No guardian links yet. Linking a parent account to a student is handled by LunchBox Connect.'
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Student no.</th>
                {/* "(user)" is how the schema refers to the row, not how a
                    nursery manager refers to a person. The column holds a
                    guardian's name. */}
                <th>Guardian</th>
                {canRevoke && <th />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={`${r.user_id}-${r.student_id}`}>
                  <td className="cell-name">
                    {r.student?.given_name} {r.student?.family_name}
                  </td>
                  <td className="mono cell-sub">{r.student?.student_no ?? ''}</td>
                  {/* This screen exists to answer "who is allowed to see which
                      child", so the guardian is one half of its answer, not a
                      footnote to the student. Muted grey is kept only for the
                      fallback, which is an opaque id and genuinely secondary. */}
                  <td>
                    {parentUsers.find((u) => u.user_id === r.user_id)?.full_name ?? (
                      <span className="mono cell-sub">{`${r.user_id.slice(0, 8)}…`}</span>
                    )}
                  </td>
                  {canRevoke && (
                    <td className="row-actions">
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRevokeError(null);
                          setNotice(null);
                          setRevokeReason('');
                          setRevoking(r);
                        }}
                      >
                        End access
                      </Btn>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {revoking && (
        <Modal
          title="End this guardian's access"
          onClose={() => setRevoking(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setRevoking(null)}>
                Cancel
              </Btn>
              <Btn
                variant="danger"
                onClick={() => void onRevoke(revoking)}
                disabled={revokeBusy || revokeReason.trim().length === 0}
              >
                {revokeBusy ? 'Ending…' : 'End access'}
              </Btn>
            </>
          }
        >
          {revokeError && <Banner kind="err">{revokeError}</Banner>}
          <Banner kind="warn">
            <b>
              {parentUsers.find((u) => u.user_id === revoking.user_id)?.full_name ?? 'This person'}
            </b>{' '}
            will immediately stop seeing {revoking.student?.given_name}{' '}
            {revoking.student?.family_name} — the menu, the meal records, everything. It takes
            effect at once, including for a session they already have open.
          </Banner>
          <Banner kind="info">
            Nothing else is touched. Their account survives (they may be a guardian to other
            children), the child survives, and every observation, note and meal record stays exactly
            as it is. Link them again at any time.
          </Banner>
          <Field label="Reason (required — recorded in Audit)">
            <input
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. no longer the child's guardian — confirmed by the nursery"
              autoFocus
            />
          </Field>
          <p className="tmc-meta">
            A reason is required because this removes a person's sight of a child. That is never
            recorded anonymously.
          </p>
        </Modal>
      )}

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
