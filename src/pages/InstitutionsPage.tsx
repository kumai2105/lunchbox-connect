import { useEffect, useState, type FormEvent } from 'react';
import { createInstitution, listInstitutions } from '../lib/api';
import type { Institution } from '../lib/types';
import { Banner, Btn, Card, EmptyState, Field, Modal, PageHead, Spinner } from '../components/ui';

export default function InstitutionsPage() {
  const [rows, setRows] = useState<Institution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Institution['kind']>('school');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void listInstitutions().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createInstitution(name.trim(), kind);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRows((prev) => [...(prev ?? []), res.data!]);
    setShowCreate(false);
    setName('');
  }

  if (error && !rows) return <EmptyState text={`Could not load institutions: ${error}`} />;

  return (
    <div>
      <PageHead
        title="Institutions"
        hint="only SUPER_ADMIN manages these"
        actions={
          <Btn
            variant="brand"
            onClick={() => {
              setError(null);
              setShowCreate(true);
            }}
          >
            + Add institution
          </Btn>
        }
      />
      <Banner kind="info">
        Every school or nursery in the chain — staff and data are scoped to these boundaries.
      </Banner>

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState text="No institutions yet. Add the first one to start the chain." />
      ) : (
        <Card>
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Type</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-name">{r.name}</td>
                  <td>
                    <span className="pill slate">{r.kind}</span>
                  </td>
                  <td className="cell-sub">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <a className="btn ghost sm" href={`/classes?institution=${r.id}`}>
                      Manage classes →
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
          title="Add institution"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={(e) => void onCreate(e as unknown as FormEvent)}
                disabled={busy || !name.trim()}
              >
                {busy ? 'Saving…' : 'Add institution'}
              </Btn>
            </>
          }
        >
          <form onSubmit={(e) => void onCreate(e)}>
            {error && <Banner kind="err">{error}</Banner>}
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maple Grove Primary"
                autoFocus
              />
            </Field>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as Institution['kind'])}>
                <option value="school">School</option>
                <option value="nursery">Nursery</option>
                <option value="other">Other</option>
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
