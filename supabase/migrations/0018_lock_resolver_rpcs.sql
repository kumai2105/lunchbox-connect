-- =====================================================================
-- 0018 — Close a cross-institution leak through the resolver RPCs.
--
-- THE LEAK
--   0016 granted EXECUTE on resolve_meal(), resolve_rotation_week() and
--   service_plan_includes() to `authenticated`. All three are SECURITY
--   DEFINER and take an institution id as a parameter, and none of them
--   check whether the caller may see that institution.
--
--   Row-level security on `meal_services` correctly returns 0 rows for a
--   foreign institution. The RPC returned the meal anyway. Reproduced as a
--   Parent with no relationship at all to the target institution:
--
--     select count(*) from meal_services
--      where institution_id = '<foreign>';              -> 0
--     select mm.name from resolve_meal('<foreign>', ...) -> 'Secret Dish ...'
--
--   The rotation library itself is deliberately global (rotations and
--   rotation_slots are `using (true)`; a master template is not
--   institution-scoped data). The leak is that resolve_meal COMBINES that
--   global template with data which IS scoped — the institution's service
--   plan, closures, date overrides and rotation anchor, all of which are
--   correctly protected by app_can_see_institution() on their own tables —
--   and then hands the result to anyone. Probing dates that return nothing
--   also discloses another institution's closure calendar.
--
-- THE FIX
--   Nothing in the application calls these RPCs. They are the internal
--   engine: resolve_meal() calls the other two, and publish_meal_services()
--   calls resolve_meal(). That function is SECURITY DEFINER and owned by
--   the migration role, so it keeps working after the grants are removed.
--   The grants were never needed.
--
-- IF YOU EVER RE-GRANT THESE
--   Add `if not app_can_see_institution(p_inst) then return; end if;` to
--   each function FIRST. Exposing them without that reopens exactly this
--   hole. tests/sql/verify_rls_cross_portal.sql fails if either role
--   regains EXECUTE, so a re-grant cannot land silently.
-- =====================================================================

-- PUBLIC must be revoked first. PostgreSQL grants EXECUTE on every new
-- function to PUBLIC by default, so revoking from `authenticated` and `anon`
-- alone changes nothing — they keep the privilege through PUBLIC. (This also
-- means 0016's explicit grants were redundant: the RPCs were reachable by
-- every role from the moment they were created, grant or no grant.)
revoke execute on function resolve_rotation_week(uuid, date) from public, authenticated, anon;
revoke execute on function service_plan_includes(uuid, date, app_period) from public, authenticated, anon;
revoke execute on function resolve_meal(uuid, date, app_period) from public, authenticated, anon;

-- publish_meal_services() already refuses anyone who is not a Super Admin in
-- its own body, so it stays callable; its internal calls run with definer
-- rights and are unaffected by the revokes above.

comment on function resolve_meal(uuid, date, app_period) is
  'INTERNAL. Not granted to anon/authenticated: it is SECURITY DEFINER, takes '
  'an institution id, and does not itself check app_can_see_institution(), so '
  'exposing it leaks other institutions'' schedules and closure calendars. '
  'Add that guard before granting.';
