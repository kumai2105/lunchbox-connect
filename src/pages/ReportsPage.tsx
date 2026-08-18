import ShellPage from './ShellPage';

/**
 * Reporting (docs/02 §16/18, docs/09 AT-100): Finance / Owner sees REPORTS
 * ONLY; Viewer is READ-ONLY. Exact KPI definitions are NOT_YET_DEFINED, so
 * this is the honest reporting shell — no invented numbers beyond what
 * operationally exists.
 */
export default function ReportsPage({
  role,
}: {
  role: 'school_admin' | 'finance_owner' | 'viewer' | 'super_admin';
}) {
  const scope =
    role === 'finance_owner'
      ? 'Reports only. No operational editing (docs/02 §16-17). Exact report set and KPI definitions are NOT_YET_DEFINED.'
      : role === 'viewer'
        ? 'Read-only viewer. Exact readable scope is BLOCKED_BY_SPEC (docs/09 AT-036) — no writes are possible from here.'
        : 'Reporting must derive from authoritative operational records (docs/03 §5, AT-100). Exact report and KPI definitions are NOT_YET_DEFINED.';
  return <ShellPage title="Reporting" scope={scope} />;
}
