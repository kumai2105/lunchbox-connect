import { useEffect, useMemo, useState } from 'react';
import { listClasses, listInstitutions, listStudents, setOperationalStatus } from '../lib/api';
import type { Student } from '../lib/types';
import { Btn, Banner, Card, EmptyState, Modal, PageHead, Pill, Spinner } from '../components/ui';
import { isEligible, statusLabel, statusPillClass } from '../lib/status';

/**
 * Operational status / eligibility (docs/02 §8, docs/05 §7): Super Admin only.
 * Only the single approved value ACTIVE_BILLABLE_TO_NURSERY exists; clearing
 * removes it (student becomes not operationally eligible). Every write is
 * captured by the audit trigger (migration 0009).
 */
export default function StatusPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [classFilter, setClassFilter] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      const [s, c, i] = await Promise.all([listStudents(), listClasses(), listInstitutions()]);
      if (!active) return;
      if (s.error || c.error || i.error) setError(s.error ?? c.error ?? i.error);
      setStudents(s.data ?? []);
      setClasses(c.data ?? []);
      setInstitutions(i.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!students) return [];
    return classFilter ? students.filter((s) => s.class_id === classFilter) : students;
  }, [students, classFilter]);

  async function apply(studentId: string, value: string | null) {
    setBusyId(studentId);
    const res = await setOperationalStatus(studentId, value);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      setConfirmId(null);
      return;
    }
    setStudents((prev) =>
      (prev ?? []).map((s) => (s.id === studentId ? (res.data as Student) : s)),
    );
    setConfirmId(null);
  }

  const eligibleCount = students?.filter((s) => isEligible(s.operational_status)).length ?? 0;

  return (
    <div>
      <PageHead title="Status / eligibility" hint="only ACTIVE_BILLABLE_TO_NURSERY is approved" />
      <Banner kind="info">
        Institutional billing fixes operational eligibility. One approved value:{' '}
        <b>ACTIVE_BILLABLE_TO_NURSERY</b>. The full status list and transitions are NOT_YET_DEFINED
        in the spec — students without the approved value cannot be served. Changes are
        audit-logged.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="stat-grid">
        <div className="stat">
          <div className="label">Eligible students</div>
          <div className="value">{eligibleCount}</div>
          <div className="trend">of {students?.length ?? 0} total</div>
        </div>
      </div>

      <Card
        title="Students"
        actions={classFilter ? <span className="chip brand">filtered</span> : undefined}
      >
        {!students ? (
          <Spinner />
        ) : (
          <>
            <div className="filters">
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {filtered.length === 0 ? (
              <EmptyState text="No students match." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Institution</th>
                    <th>Operational status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="cell-name">
                        {s.given_name} {s.family_name}{' '}
                        <span className="cell-sub">{s.student_no}</span>
                      </td>
                      <td>{institutions.find((i) => i.id === s.institution_id)?.name ?? '—'}</td>
                      <td>
                        <Pill variant={statusPillClass(s.operational_status)}>
                          {statusLabel(s.operational_status)}
                        </Pill>
                      </td>
                      <td>
                        {isEligible(s.operational_status) ? (
                          <Btn
                            variant="ghost"
                            size="sm"
                            disabled={busyId === s.id}
                            onClick={() => setConfirmId(s.id)}
                          >
                            Clear status
                          </Btn>
                        ) : (
                          <Btn
                            variant="brand"
                            size="sm"
                            disabled={busyId === s.id}
                            onClick={() => void apply(s.id, 'ACTIVE_BILLABLE_TO_NURSERY')}
                          >
                            {busyId === s.id ? 'Saving…' : 'Set ACTIVE_BILLABLE_TO_NURSERY'}
                          </Btn>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Card>

      {confirmId && (
        <Modal
          title="Clear operational status?"
          onClose={() => setConfirmId(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setConfirmId(null)}>
                Cancel
              </Btn>
              <Btn
                variant="amber"
                onClick={() => void apply(confirmId, null)}
                disabled={busyId === confirmId}
              >
                Clear
              </Btn>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            This student will be <b>not operationally eligible</b> and excluded from serving. The
            change is recorded in the audit log.
          </p>
        </Modal>
      )}
    </div>
  );
}
