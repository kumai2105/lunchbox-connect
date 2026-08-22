import { useEffect, useState } from 'react';
import { listAudit } from '../lib/api';
import type { AuditLogRow } from '../lib/types';
import { Banner, Card, EmptyState, Spinner } from '../components/ui';
import { formatDateTime } from '../lib/format';

// Super Admin audit visibility (docs/02 §5, docs/08 §18, AT-110).
export default function AuditPage() {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAudit().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeadPanel />
      {error && <Banner kind="err">{error}</Banner>}
      <Card
        title="Audit log"
        hint="previous value · new value · who changed it · when"
      >
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState text="No audited events yet — writes to students, menus and users are recorded here." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-sub">{formatDateTime(r.occurred_at)}</td>
                  <td>
                    <span
                      className={`pill ${r.action === 'delete' ? 'red' : r.action === 'create' ? 'free' : 'slate'}`}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="mono cell-sub">
                    {r.entity_type} · {r.entity_id.slice(0, 8)}
                  </td>
                  <td className="cell-sub mono">{r.actor_user_id?.slice(0, 8) ?? 'system'}</td>
                  <td className="mono cell-sub" style={{ maxWidth: 420 }}>
                    {compact(r.previous_value)} → {compact(r.new_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function compact(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const s = JSON.stringify(v);
  return s.length > 110 ? `${s.slice(0, 110)}…` : s;
}

function PageHeadPanel() {
  return (
    <div>
      <div className="page-head">
        <h1>Audit</h1>
        <span className="hint">system-wide, Super Admin only</span>
      </div>
    </div>
  );
}
