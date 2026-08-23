import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createInstitution, listInstitutions } from '../lib/api';
import type { Institution } from '../lib/types';
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

export default function InstitutionsPage() {
  const [rows, setRows] = useState<Institution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  // Neither type is the assumed one, but the field must open on something and
  // `nursery` is the first option in the list below, so the control agrees with
  // what it shows rather than silently starting on the second entry.
  const [kind, setKind] = useState<Institution['kind']>('nursery');
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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

  const archivedCount = (rows ?? []).filter((r) => !r.active).length;
  const visible = (rows ?? []).filter((r) => showArchived || r.active);

  return (
    <div>
      <PageHead
        title="Institutions"
        hint="only a Super Admin manages these"
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
        Every nursery or school you serve. Staff, students and records belong to exactly one of
        these, and never cross between them. An institution that stops trading is{' '}
        <b>archived, never deleted</b> — its record of what children were actually served has to
        survive the relationship.
      </Banner>

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState text="No institutions yet. Add the first one to start the chain." />
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
                Show archived institutions ({archivedCount})
              </label>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Type</th>
                <th>State</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={r.active ? undefined : 'row-muted'}>
                  <td className="cell-name">
                    <Link to={`/institutions/${r.id}`}>{r.name}</Link>
                  </td>
                  <td>
                    <span className="pill slate">{r.kind}</span>
                  </td>
                  <td>
                    {r.active ? (
                      <Pill variant="green">Operating</Pill>
                    ) : (
                      <Pill variant="slate">Archived</Pill>
                    )}
                  </td>
                  <td className="cell-sub">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link className="btn ghost sm" to={`/institutions/${r.id}`}>
                      View details
                    </Link>
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
            {/* Built with Field, not a hand-rolled div+label. The hand-rolled
                version carried no htmlFor and no nesting, so the Type control
                was unreachable by its label even after Field itself was fixed —
                the one control in the Super Admin onboarding chain that
                bypassed the shared component. */}
            <div style={{ marginTop: 12 }}>
              <Field label="Type">
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Institution['kind'])}
                >
                  {/* §6: nursery | school are the only supported types. */}
                  <option value="nursery">Nursery</option>
                  <option value="school">School</option>
                </select>
              </Field>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
