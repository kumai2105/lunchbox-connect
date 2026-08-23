import { useEffect, useMemo, useState } from 'react';
import { listAudit, listUsers } from '../lib/api';
import type { AppUser, AuditLogRow } from '../lib/types';
import { Banner, Card, EmptyState, PageHead, Pill, Spinner } from '../components/ui';
import { formatDateTime } from '../lib/format';

/**
 * The record of who changed what.
 *
 * WHAT IS AND IS NOT IN HERE, because the distinction matters and is easy to
 * get wrong when reading it:
 *
 *   * This is a log of ADMINISTRATIVE changes — a child's details, a menu, an
 *     account's state, a guardian link, an institution being archived. Each row
 *     names the actor, the moment, what the value was and what it became.
 *
 *   * It is NOT the operational history. Meals served, classroom observations,
 *     published notes and menu publications are records in their own right,
 *     kept in their own tables, and are not duplicated here.
 *
 *   * It never contains a password. A password reset appears as the FACT that
 *     one was issued, by whom and why — the value itself is never written,
 *     because no path in this product holds one to write.
 */

// Action names are stored as machine identifiers so they can be queried and
// counted. Only what a person reads is translated.
const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  'user.deactivate': 'Account deactivated',
  'user.reactivate': 'Account reactivated',
  'user.profile_update': 'Account details changed',
  'user.password_reset': 'Password issued',
  'institution.archive': 'Institution archived',
  'institution.reactivate': 'Institution reactivated',
  'class.archive': 'Class archived',
  'class.reactivate': 'Class reactivated',
  'guardian.revoke': 'Guardian access ended',
};

const ENTITY_LABEL: Record<string, string> = {
  app_users: 'Account',
  students: 'Student',
  menus: 'Menu',
  institutions: 'Institution',
  classes: 'Class',
  student_parents: 'Guardian link',
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/[._]/g, ' ');
}

function actionTone(action: string): string {
  if (action === 'delete' || action.endsWith('.revoke') || action.endsWith('.deactivate'))
    return 'red';
  if (action.endsWith('.archive')) return 'reduced';
  if (action === 'create' || action.endsWith('.reactivate')) return 'free';
  return 'slate';
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [people, setPeople] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      // Only the Super Admin reaches this page, and only they can read every
      // account, so the actor lookup is safe here and nowhere else.
      const [a, u] = await Promise.all([listAudit(), listUsers()]);
      if (!active) return;
      if (a.error) setError(a.error);
      setRows(a.data ?? []);
      setPeople(u.data ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const nameOf = useMemo(() => {
    const byId = new Map(people.map((p) => [p.user_id, p.full_name]));
    return (id: string | null) => {
      if (!id) return 'the system';
      // A UUID fragment is not an answer to "who did this". Fall back to one
      // only when the account is genuinely no longer resolvable.
      return byId.get(id) ?? `${id.slice(0, 8)}…`;
    };
  }, [people]);

  return (
    <div>
      <PageHead title="Audit" hint="every administrative change, and who made it" />
      {error && <Banner kind="err">{error}</Banner>}
      <Banner kind="info">
        This is the record of <b>administrative</b> changes — details corrected, accounts
        deactivated, institutions archived, guardian access ended. What was actually served to
        children is not repeated here; those are meal records, kept in their own right and never
        rewritten. <b>No password is ever recorded</b>: issuing one appears here as the fact that it
        happened, never as the value.
      </Banner>
      <Card title="Audit log" hint="what changed, from what to what, by whom, and when">
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState text="Nothing has been changed yet." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>What happened</th>
                <th>To</th>
                <th>By</th>
                <th>Reason</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-sub">{formatDateTime(r.occurred_at)}</td>
                  <td>
                    <Pill variant={actionTone(r.action)}>{actionLabel(r.action)}</Pill>
                  </td>
                  <td className="cell-sub">
                    {ENTITY_LABEL[r.entity_type] ?? r.entity_type}
                    <span className="mono"> {r.entity_id?.slice(0, 8) ?? '—'}</span>
                  </td>
                  <td className="cell-sub">{nameOf(r.actor_user_id)}</td>
                  <td className="cell-sub">{r.reason ?? '—'}</td>
                  <td className="mono cell-sub" style={{ maxWidth: 380 }}>
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
