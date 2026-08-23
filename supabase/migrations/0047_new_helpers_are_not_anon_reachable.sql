-- =====================================================================
-- 0047 — the helpers 0044/0045/0046 added must not be reachable by `anon`
--
-- FOUND BY THE SUPABASE SECURITY ADVISOR, run immediately after applying
-- 0043–0046 to production. Eight functions this batch created were executable
-- by `anon`:
--
--   app_institution_is_active           app_guard_active_institution
--   app_class_is_active                 app_guard_active_class
--   app_may_manage_account              app_guard_archived_authoring
--   app_is_last_active_super_admin      app_guard_active_institution_for_account
--
-- HOW IT HAPPENED. 0044 was careful to `revoke all ... from public, anon` on
-- the five ACTION rpcs — set_user_active, update_user_profile,
-- set_institution_active, set_class_active, revoke_guardian_access — and said
-- nothing about the helpers and trigger functions beside them. A function
-- created with no explicit grant carries PostgreSQL's default EXECUTE to
-- PUBLIC, and `anon` is in PUBLIC. So the omission was the grant.
--
-- WHAT WAS ACTUALLY EXPOSED. Small, but real and unauthenticated:
--
--   * app_institution_is_active(uuid) and app_class_is_active(uuid) are
--     SECURITY DEFINER and return a boolean, so an anonymous caller holding a
--     UUID could learn whether that institution or class exists and is
--     operating. Guessing a v4 UUID is infeasible, but a UUID is not a secret
--     — it appears in URLs and in any link ever shared.
--   * app_is_last_active_super_admin(uuid) does not check its caller at all,
--     by design: it answers a question about the passed user. Anonymous access
--     to that question is exactly the kind of probe this project has refused
--     everywhere else.
--   * The four `app_guard_*` functions RETURN TRIGGER, so PostgreSQL refuses
--     to call them outside a trigger context — no exposure in practice. They
--     are included because a SECURITY DEFINER function that nothing may call
--     should say so, rather than relying on a second rule to save it.
--
-- This is the same class of finding as 0042, from the opposite direction: that
-- one was a policy made unreachable by a MISSING grant; this is a function made
-- reachable by an UNSTATED one. Both come from the same fact — PostgreSQL
-- decides EXECUTE and SELECT privileges before any policy is consulted — and
-- the lesson is the same: state the grant, never inherit it.
--
-- WHY REVOKING IS SAFE, checked rather than assumed:
--
--   * No RLS policy and no CHECK constraint references any of the eight
--     (queried against pg_policies and pg_constraint on the live database
--     before writing this).
--   * They are called only from inside other SECURITY DEFINER functions,
--     which execute as the function owner and never consult the caller's
--     EXECUTE privilege.
--   * Trigger firing does not check EXECUTE on the trigger function either.
--     CREATE TRIGGER needs privileges; the trigger going off does not.
-- =====================================================================

-- The four predicate helpers. Authenticated keeps EXECUTE: an authenticated
-- caller can already read the institutions and classes they are scoped to, so
-- "is this one active" tells them nothing new, and leaving the grant explicit
-- means a future policy may use them without a surprise.
revoke all on function app_institution_is_active(uuid)      from public, anon;
revoke all on function app_class_is_active(uuid)            from public, anon;
revoke all on function app_may_manage_account(uuid)         from public, anon;
revoke all on function app_is_last_active_super_admin(uuid) from public, anon;

grant execute on function app_institution_is_active(uuid)      to authenticated;
grant execute on function app_class_is_active(uuid)            to authenticated;
grant execute on function app_may_manage_account(uuid)         to authenticated;
grant execute on function app_is_last_active_super_admin(uuid) to authenticated;

-- The four trigger functions. NOBODY gets EXECUTE — not anon, not
-- authenticated. They exist to be fired by a trigger, and a trigger does not
-- need the grant.
revoke all on function app_guard_active_institution()             from public, anon, authenticated;
revoke all on function app_guard_active_class()                   from public, anon, authenticated;
revoke all on function app_guard_archived_authoring()             from public, anon, authenticated;
revoke all on function app_guard_active_institution_for_account() from public, anon, authenticated;
