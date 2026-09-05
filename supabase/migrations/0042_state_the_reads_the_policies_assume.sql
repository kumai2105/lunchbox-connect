-- =====================================================================
-- 0042: state the SELECT grants the existing policies already assume.
--
-- REPRODUCED FAILURE (browser, Super Admin, clean rebuild of every
-- migration on a local Supabase stack):
--
--   /dashboard -> permission denied for view v_dashboard_institutions [42501]
--   /audit     -> permission denied for table audit_log [42501]
--
-- Both screens rendered an error banner to the role that owns them. Nothing
-- caught it for the life of the project because no test had ever asserted
-- that a core screen shows NO error banner — only that whatever banner it
-- showed was readable.
--
-- This is the same class of gap 0041 closed for `institutions`, and the
-- reasoning is identical:
--
--   * PostgreSQL checks GRANTS BEFORE RLS. A policy on an object no role may
--     select from is unreachable, however carefully it is written.
--   * `audit_log` has had RLS since 0009 with
--       audit_log_select using (app_is_super_admin())
--     and `revoke all ... from anon` — but no grant to `authenticated` was
--     ever stated. The policy has therefore been describing an access nobody
--     could exercise.
--   * `v_dashboard_institutions` is a security_invoker view (0039). The
--     caller needs SELECT on the VIEW itself as well as on what it reads.
--
-- WHY THIS IS SAFE, AND NOT A WIDENING
-- The grant makes the policy REACHABLE; it does not decide who sees what.
-- audit_log_select still restricts every row to a Super Admin, and the view
-- is security_invoker so it is filtered by the caller's own policies on the
-- tables underneath. anon keeps nothing. tests/sql/verify_read_grants.sql
-- asserts both halves — that a Super Admin can read and that a Nursery Admin
-- and an anonymous caller still cannot.
--
-- ENVIRONMENT, STATED HONESTLY
-- Reproduced on the local CLI stack. Hosted Supabase grants ALL on public to
-- `authenticated` through platform default privileges, so production may well
-- already permit both reads — as it did for `institutions`, where I wrongly
-- generalised a local failure to production. This migration is therefore
-- expected to be a NO-OP on production and is worth applying anyway: the
-- permission model should rest on what this repository states, not on a
-- platform default that a restore or a policy change could remove.
-- =====================================================================

grant select on audit_log to authenticated;
revoke all on audit_log from anon;

grant select on v_dashboard_institutions to authenticated;
revoke all on v_dashboard_institutions from anon;

comment on table audit_log is
  'Operational audit trail. RLS restricts every row to a Super Admin '
  '(audit_log_select, 0009); 0042 states the SELECT grant that policy needs '
  'in order to be reachable at all. Writes happen only through SECURITY '
  'DEFINER triggers, never from a client.';
