import { useEffect, useState, type FormEvent } from 'react';
import { createClass, listClasses, listInstitutions, type ClassWithMeta } from '../lib/api';
import type { Institution } from '../lib/types';
import { Btn, Card, EmptyState, Field, Modal, PageHead, Spinner } from '../components/ui';

export default function ClassesPage() {
  const [rows, setRows] = useState<ClassWithMeta[] | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [institutionId, setInstitutionId] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      const [c, i] = await Promise.all([listClasses(), listInstitutions()]);
      if (!active) return;
      if (c.error || i.error) setError(c.error ?? i.error);
      setRows(c.data ?? []);
      setInstitutions(i.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

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
        hint="scoped to your institution"
        actions={
          <Btn variant="brand" onClick={() => setShowCreate(true)}>
            + Create class
          </Btn>
        }
      />

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState text="No classes yet." />
      ) : (
        <Card>
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Institution</th>
                <th>Grade</th>
                <th>Students</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="cell-name">{c.name}</td>
                  <td>{institutions.find((i) => i.id === c.institution_id)?.name ?? '—'}</td>
                  <td>{c.grade ?? '—'}</td>
                  <td className="mono">{c.student_count}</td>
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
              <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
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
