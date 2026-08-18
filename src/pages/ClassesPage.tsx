import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  assignClassStaff,
  createClass,
  listClasses,
  listInstitutions,
  listUsers,
  type ClassWithMeta,
} from '../lib/api';
import type { AppUser, Institution } from '../lib/types';
import { Banner, Btn, Card, EmptyState, Field, Modal, PageHead, Spinner } from '../components/ui';

export default function ClassesPage() {
  const [params] = useSearchParams();
  const institutionFilter = params.get('institution') ?? '';

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
      const [c, i, u] = await Promise.all([listClasses(), listInstitutions(), listUsers()]);
      if (!active) return;
      if (c.error || i.error || u.error) setError(c.error ?? i.error ?? u.error);
      setRows(c.data ?? []);
      setInstitutions(i.data ?? []);
      setStaffUsers((u.data ?? []).filter((x) => x.role === 'classroom_staff'));
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onAssignStaff(classId: string, teacherId: string) {
    const res = await assignClassStaff(classId, teacherId || null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRows((prev) =>
      (prev ?? []).map((c) => (c.id === classId ? { ...c, teacher_id: res.data!.teacher_id } : c)),
    );
  }

  const filteredRows = useMemo(
    () =>
      institutionFilter ? (rows ?? []).filter((c) => c.institution_id === institutionFilter) : rows,
    [rows, institutionFilter],
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
            ? `${scopedInstitution.name} only`
            : 'every institution — filter from Institutions →'
        }
        actions={
          <>
            {institutionFilter && (
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = '/institutions')}
              >
                ← All institutions
              </Btn>
            )}
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
          </>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      {!scopedInstitution && !institutionFilter && (
        <Banner kind="info">
          A Class always belongs to one Institution (docs/04 §8). Open an institution from{' '}
          <a href="/institutions">Institutions</a> and use "Manage classes" to work within its
          scope, or create one here and pick the institution directly.
        </Banner>
      )}

      {!filteredRows ? (
        <Spinner />
      ) : filteredRows.length === 0 ? (
        <EmptyState text="No classes yet." />
      ) : (
        <Card>
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
              {filteredRows.map((c) => (
                <tr key={c.id}>
                  <td className="cell-name">{c.name}</td>
                  {!institutionFilter && (
                    <td>{institutions.find((i) => i.id === c.institution_id)?.name ?? '—'}</td>
                  )}
                  <td>{c.grade ?? '—'}</td>
                  <td className="mono">{c.student_count}</td>
                  <td>
                    <select
                      value={c.teacher_id ?? ''}
                      onChange={(e) => void onAssignStaff(c.id, e.target.value)}
                      title="assign classroom staff"
                    >
                      <option value="">Unassigned</option>
                      {staffUsers
                        .filter((u) => u.institution_id === c.institution_id)
                        .map((u) => (
                          <option key={u.user_id} value={u.user_id}>
                            {u.full_name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <a className="btn ghost sm" href={`/today?class=${c.id}`}>
                      Open Today →
                    </a>
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
            <Field label="Institution">
              <select
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                disabled={Boolean(institutionFilter)}
              >
                <option value="">Select…</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
