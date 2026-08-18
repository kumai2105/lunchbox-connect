import { useEffect, useState } from 'react';
import { listGuardians } from '../lib/api';
import { Card, EmptyState, PageHead, Spinner } from '../components/ui';

interface GuardianRow {
  user_id: string;
  student_id: string;
  student?: { given_name?: string; family_name?: string; student_no?: string } | null;
}

/** Parents / guardians registry (docs/06 §§29; scoped roles only, via RLS). */
export default function GuardiansPage() {
  const [rows, setRows] = useState<GuardianRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      // student_parents embeds the authoritative student record (no copies)
      const res = await listGuardians();
      if (!active) return;
      if (res.error) setError(res.error);
      setRows((res.data ?? []) as GuardianRow[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHead
        title="Parents / guardians"
        hint="linked to children through the authoritative student record"
      />
      {error && <div className="banner err">{error}</div>}
      <Card title="Guardian links">
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState text="No guardian links yet." />
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
              {rows.map((r) => (
                <tr key={`${r.user_id}-${r.student_id}`}>
                  <td className="cell-name">
                    {r.student?.given_name} {r.student?.family_name}
                  </td>
                  <td className="mono cell-sub">{r.student?.student_no ?? ''}</td>
                  <td className="mono cell-sub">{r.user_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
