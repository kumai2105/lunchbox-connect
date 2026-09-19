-- =====================================================================
-- 01_security_remediation.sql — MINIMAL, STANDALONE security fix.
--
-- Scope: revoke EXECUTE on the three resolver RPCs from client roles.
-- It touches NO business data — no service plans, no rotations, no
-- publishing, no deletes. It depends on nothing else in this folder.
--
-- This is the only change that is both required and independently
-- approved by you. If production already has it (diagnostic section 1
-- shows all false), re-running is a harmless no-op.
--
-- WHY the RPCs leak: resolve_meal / resolve_rotation_week /
-- service_plan_includes are SECURITY DEFINER, take an institution id, and
-- do not check app_can_see_institution(). PostgreSQL grants EXECUTE to
-- PUBLIC on every new function, so PUBLIC must be revoked first or the
-- other two revokes do nothing.
--
-- ── TRANSACTION SAFETY ────────────────────────────────────────────────
-- This script does NOT commit. It ends inside an open transaction.
--   • In psql: review the two notices, then type  commit;  (or rollback;).
--   • In the Supabase web SQL editor: that editor AUTO-COMMITS the batch,
--     so BEGIN/COMMIT here give you no real checkpoint. For a genuine
--     review-before-save, run this in psql. If you must use the editor,
--     understand it will commit when the run finishes.
-- =====================================================================
begin;

do $before$
declare a bool; b bool;
begin
  a := has_function_privilege('anon','resolve_meal(uuid,date,app_period)','EXECUTE');
  b := has_function_privilege('authenticated','resolve_meal(uuid,date,app_period)','EXECUTE');
  raise notice 'BEFORE: resolve_meal executable by anon=%, authenticated=%', a, b;
end $before$;

-- The only data-changing statements in this file. All three are REVOKEs:
-- they remove a privilege. They create, alter, or delete no rows.
revoke execute on function resolve_rotation_week(uuid, date)                from public, authenticated, anon;
revoke execute on function service_plan_includes(uuid, date, app_period)    from public, authenticated, anon;
revoke execute on function resolve_meal(uuid, date, app_period)             from public, authenticated, anon;

comment on function resolve_meal(uuid, date, app_period) is
  'INTERNAL. Not granted to anon/authenticated: SECURITY DEFINER, takes an '
  'institution id, does not check app_can_see_institution(). Add that guard '
  'before ever re-granting.';

do $after$
declare a bool; b bool;
begin
  a := has_function_privilege('anon','resolve_meal(uuid,date,app_period)','EXECUTE');
  b := has_function_privilege('authenticated','resolve_meal(uuid,date,app_period)','EXECUTE');
  if a or b then raise exception 'FAILED: resolve_meal still executable (anon=%, auth=%)', a, b; end if;
  raise notice 'AFTER:  resolve_meal executable by anon=%, authenticated=% — leak closed', a, b;
  raise notice 'Review the two lines above, then:  commit;   (or rollback; to undo)';
end $after$;

-- NO commit here on purpose. You decide.
