import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  addClassStaff,
  classStaff,
  createClass,
  listClasses,
  listInstitutions,
  listUsers,
  removeClassStaff,
  setClassActive,
  type ClassStaffMember,
  type ClassWithMeta,
} from '../lib/api';
import type { AppUser, Institution } from '../lib/types';
import { useAuth, useRole } from '../lib/auth';
import { can } from '../lib/rbac';
import {
  Banner,
  Btn,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHead,
  Pill,
  Spinner,
} from '../components/ui';

export default function ClassesPage() {
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const role = useRole();

  /**
   * WHOSE CLASSES THIS PAGE IS SHOWING.
   *
   * A Super Admin works across the chain, so their scope comes from the URL —
   * they arrive here by drilling into one institution, or open the page with
   * no filter to see everything.
   *
   * Everyone else IS an institution. An Institution Admin has exactly one, and
   * it is not a filter they chose — it is who they are. Before this, their
   * sidebar "Classes" opened the unfiltered page, which then offered them "←
   * All institutions" and a link to /institutions: two routes their role
   * cannot open, and a question ("which institution?") with one possible
   * answer. Their own institution is the scope, implicitly and always.
   */
  const isGlobalOperator = role === 'super_admin';
  const institutionFilter = isGlobalOperator
    ? (params.get('institution') ?? '')
    : (profile?.institution_id ?? '');
  // Whether the SCOPE was chosen (and can therefore be left) or is inherent.
  const scopeIsChosen = isGlobalOperator && institutionFilter !== '';
  // §5: mutation controls appear only for roles authorized to perform them.
  // Classroom staff reach this page read-only (RLS enforces the same server-side).
  const canCreateClass = can(role, 'classes', 'create');
  const canManageStaff = can(role, 'classes', 'update');

  const [rows, setRows] = useState<ClassWithMeta[] | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [staffUsers, setStaffUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [institutionId, setInstitutionId] = useState(institutionFilter);

  useEffect(() => {
    let active = true;
    void (async () => {
      // Only admins need the staff roster (for the assignment picker) and the
      // institution list; classroom_staff view classes read-only, and
      // listUsers() is admin-scoped, so skip it for them.
      const [c, i, u] = await Promise.all([
        listClasses(),
        canManageStaff ? listInstitutions() : Promise.resolve({ data: [], error: null }),
        canManageStaff ? listUsers() : Promise.resolve({ data: [], error: null }),
      ]);
      if (!active) return;
      if (c.error || i.error || u.error) setError(c.error ?? i.error ?? u.error);
      setRows(c.data ?? []);
      setInstitutions(i.data ?? []);
      setStaffUsers((u.data ?? []).filter((x) => x.role === 'classroom_staff'));
    })();
    return () => {
      active = false;
    };
  }, [canManageStaff]);

  const [managing, setManaging] = useState<ClassWithMeta | null>(null);
  const [members, setMembers] = useState<ClassStaffMember[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<ClassWithMeta | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSetClassActive(c: ClassWithMeta, next: boolean) {
    setArchiveBusy(true);
    setArchiveError(null);
    const res = await setClassActive(c.id, next, archiveReason || null);
    setArchiveBusy(false);
    if (res.error) {
      // The database says exactly what is in the way — "still has 12 students
      // assigned". Show that, rather than a generic failure or a silent
      // downgrade of the action.
      setArchiveError(res.error);
      return;
    }
    setArchiving(null);
    setArchiveReason('');
    setNotice(
      next
        ? `${c.name} is running again.`
        : `${c.name} is archived. Everything recorded against it is still there.`,
    );
    const fresh = await listClasses();
    setRows(fresh.data ?? []);
  }

  async function openStaff(c: ClassWithMeta) {
    setManaging(c);
    setAddUserId('');
    const res = await classStaff(c.id);
    if (res.error) setError(res.error);
    setMembers(res.data ?? []);
  }
  async function onAddStaff() {
    if (!managing || !addUserId) return;
    const res = await addClassStaff(managing.id, addUserId);
    if (res.error) return setError(res.error);
    setAddUserId('');
    await openStaff(managing);
  }
  async function onRemoveStaff(userId: string) {
    if (!managing) return;
    const res = await removeClassStaff(managing.id, userId);
    if (res.error) return setError(res.error);
    await openStaff(managing);
  }

  const inScope = useMemo(
    () =>
      institutionFilter ? (rows ?? []).filter((c) => c.institution_id === institutionFilter) : rows,
    [rows, institutionFilter],
  );
  const archivedCount = (inScope ?? []).filter((c) => !c.active).length;
  const filteredRows = useMemo(
    () => (inScope === null ? null : inScope.filter((c) => showArchived || c.active)),
    [inScope, showArchived],
  );

  const scopedInstitution = institutions.find((i) => i.id === institutionFilter);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createClass({
      institution_id: institutionId,
      name: name.trim(),
      grade: grade || null,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const created = res.data;
    if (!created) return;
    setRows((prev) => [...(prev ?? []), { ...created, student_count: 0 }]);
    setShowCreate(false);
    setName('');
    setGrade('');
  }

  if (error && !rows) return <EmptyState text={`Could not load classes: ${error}`} />;

  return (
    <div>
      <PageHead
        title="Classes"
        hint={
          scopedInstitution
            ? scopedInstitution.name
            : isGlobalOperator
              ? 'across every institution'
              : 'your institution'
        }
        actions={
          <>
            {scopeIsChosen && (
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = '/institutions')}
              >
                ← All institutions
              </Btn>
            )}
            {canCreateClass && (
              <Btn
                variant="brand"
                onClick={() => {
                  setError(null);
                  setInstitutionId(institutionFilter);
                  setShowCreate(true);
                }}
              >
                + Create class
              </Btn>
            )}
          </>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {isGlobalOperator && !institutionFilter && (
        <Banner kind="info">
          A class always belongs to one institution. Open an institution from{' '}
          <a href="/institutions">Institutions</a> and use "Manage classes" to work within its
          scope, or create one here and pick the institution directly.
        </Banner>
      )}
      <Banner kind="info">
        A class that is no longer running is <b>archived, not deleted</b> — the meals its children
        were served were recorded against it. Archiving is refused while students or staff are still
        assigned to it: move them first, so the class is genuinely empty before it closes.
      </Banner>

      {!inScope ? (
        <Spinner />
      ) : inScope.length === 0 ? (
        <EmptyState text="No classes yet." />
      ) : (
        <Card>
          {archivedCount > 0 && (
            <div style={{ padding: '12px 18px 0' }}>
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show archived classes ({archivedCount})
              </label>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>Class</th>
                {!institutionFilter && <th>Institution</th>}
                <th>Grade</th>
                <th>Students</th>
                <th>Assigned staff</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(filteredRows ?? []).map((c) => (
                <tr key={c.id} className={c.active ? undefined : 'row-muted'}>
                  <td className="cell-name">
                    {c.name}
                    {!c.active && (
                      <>
                        {' '}
                        <Pill variant="slate">Archived</Pill>
                      </>
                    )}
                  </td>
                  {!institutionFilter && (
                    <td>{institutions.find((i) => i.id === c.institution_id)?.name ?? '—'}</td>
                  )}
                  <td>{c.grade ?? '—'}</td>
                  <td className="mono">{c.student_count}</td>
                  <td>
                    {canManageStaff && c.active ? (
                      <Btn size="sm" variant="ghost" onClick={() => void openStaff(c)}>
                        Manage staff
                      </Btn>
                    ) : (
                      <span className="cell-sub">—</span>
                    )}
                  </td>
                  <td className="row-actions">
                    {canManageStaff && (
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setArchiveError(null);
                          setNotice(null);
                          setArchiveReason('');
                          setArchiving(c);
                        }}
                      >
                        {c.active ? 'Archive' : 'Reactivate'}
                      </Btn>
                    )}
                    {/* Only a role that may RECORD gets a link into the
                        classroom register. A School Admin has no classroom
                        recording permission (NOT_YET_DEFINED), so offering the
                        link promised an action the route would refuse. */}
                    {can(role, 'today', 'record') && c.active && (
                      <a className="btn ghost sm" href={`/today?class=${c.id}`}>
                        Open Today →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate && (
        <Modal
          title="Create class"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={(e) => void onCreate(e as unknown as FormEvent)}
                disabled={busy || !name.trim() || !institutionId}
              >
                {busy ? 'Saving…' : 'Create class'}
              </Btn>
            </>
          }
        >
          <form onSubmit={(e) => void onCreate(e)}>
            {error && <Banner kind="err">{error}</Banner>}
            <div className="form-row">
              <Field label="Class name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 1-A"
                  autoFocus
                />
              </Field>
              <Field label="Grade">
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. 1"
                />
              </Field>
            </div>
            {/* Only a Super Admin is ever choosing between institutions. For
                everyone else the institution is their own, already set above,
                and a disabled dropdown with one entry asks a question that has
                no second answer. */}
            {isGlobalOperator ? (
              <Field label="Institution">
                <select
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  disabled={Boolean(institutionFilter)}
                >
                  <option value="">Select…</option>
                  {/* An archived institution gains no classes; the database
                      refuses the insert, so it is not offered. */}
                  {institutions
                    .filter((i) => i.active)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </Field>
            ) : (
              <p className="tmc-meta">
                This class will belong to {scopedInstitution?.name ?? 'your institution'}.
              </p>
            )}
          </form>
        </Modal>
      )}
      {archiving && (
        <Modal
          title={archiving.active ? `Archive ${archiving.name}` : `Reactivate ${archiving.name}`}
          onClose={() => setArchiving(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setArchiving(null)}>
                Cancel
              </Btn>
              <Btn
                variant={archiving.active ? 'danger' : 'brand'}
                onClick={() => void onSetClassActive(archiving, !archiving.active)}
                disabled={archiveBusy}
              >
                {archiveBusy ? 'Working…' : archiving.active ? 'Archive' : 'Reactivate'}
              </Btn>
            </>
          }
        >
          {archiveError && <Banner kind="err">{archiveError}</Banner>}
          {archiving.active ? (
            <>
              <Banner kind="warn">
                An archived class takes no students, no staff assignments and no new meal records.
                Everything already recorded against it is kept and stays readable.
              </Banner>
              <Banner kind="info">
                It must be <b>empty first</b>. If students or staff are still assigned, this is
                refused and says so — move them to another class rather than leaving a closed class
                holding a roster. There is no permanent delete: the meals its children were served
                are recorded against it.
              </Banner>
            </>
          ) : (
            <Banner kind="info">
              Reactivating lets this class take students, staff and meal records again.
            </Banner>
          )}
          <Field label="Reason (optional — recorded in Audit)">
            <input
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder={archiving.active ? 'e.g. class closed for the year' : 'e.g. reopened'}
              autoFocus
            />
          </Field>
        </Modal>
      )}
      {managing && (
        <Modal
          title={`Staff — ${managing.name}`}
          onClose={() => setManaging(null)}
          footer={
            <Btn variant="ghost" onClick={() => setManaging(null)}>
              Done
            </Btn>
          }
        >
          <p className="tmc-meta">
            A class may have several classroom staff, and a staff member may cover several classes.
          </p>
          {members.length === 0 ? (
            <EmptyState text="No staff assigned yet." />
          ) : (
            <ul className="staff-chips">
              {members.map((m) => (
                <li key={m.user_id}>
                  <span>
                    {m.full_name} <span className="tmc-meta">{m.email}</span>
                  </span>
                  <button className="chip-x" onClick={() => void onRemoveStaff(m.user_id)}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Field label="Add classroom staff">
            <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
              <option value="">— choose staff —</option>
              {staffUsers
                .filter((u) => u.institution_id === managing.institution_id)
                .filter((u) => !members.some((m) => m.user_id === u.user_id))
                .map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name}
                  </option>
                ))}
            </select>
          </Field>
          <Btn variant="brand" onClick={() => void onAddStaff()} disabled={!addUserId}>
            Add to class
          </Btn>
        </Modal>
      )}
    </div>
  );
}
