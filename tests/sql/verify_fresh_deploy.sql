-- =====================================================================
-- §57 FRESH DEPLOY — a clean database, canonical migrations only.
--
-- The runner applies 00_shim + 0001..0020 to an empty database and seeds
-- ONLY the baseline actors (01_actors.sql). No menus, no institutions.
-- This suite proves the canonical chain, on a fresh install, does NOT make
-- any business decision on its own:
--   • no inferred Institution Service Plans
--   • no auto-assigned Rotations
--   • no auto-published Meal Services
--   • no Test fixtures
--   • no legacy menu artifacts
-- Read-only. Nothing to roll back.
-- =====================================================================
do $$
declare n int;
begin
  select count(*) into n from institution_service_plans;
  if n <> 0 then raise exception 'FAIL §47 fresh deploy created % service plans', n; end if;
  raise notice 'PASS  §47 fresh deploy infers 0 service plans';

  select count(*) into n from institution_rotation_assignments;
  if n <> 0 then raise exception 'FAIL §48 fresh deploy created % rotation assignments', n; end if;
  raise notice 'PASS  §48 fresh deploy auto-assigns 0 rotations';

  select count(*) into n from meal_services;
  if n <> 0 then raise exception 'FAIL §46 fresh deploy published % meal services', n; end if;
  raise notice 'PASS  §46 fresh deploy publishes 0 meal services';

  select count(*) into n from meals;
  if n <> 0 then raise exception 'FAIL fresh deploy created % meals (no legacy menu to migrate)', n; end if;
  select count(*) into n from rotations;
  if n <> 0 then raise exception 'FAIL fresh deploy created % rotations (should be none)', n; end if;
  raise notice 'PASS  fresh deploy creates 0 meals and 0 rotation artifacts';

  select count(*) into n from meals where name like 'Test %';
  if n <> 0 then raise exception 'FAIL fresh deploy created % Test fixtures', n; end if;
  select count(*) into n from menus;
  if n <> 0 then raise exception 'FAIL fresh deploy seeded % legacy menu rows', n; end if;
  raise notice 'PASS  fresh deploy creates 0 Test fixtures and 0 legacy menu rows';

  -- The resolver RPCs must not be reachable by client roles even on a fresh DB.
  if has_function_privilege('anon','resolve_meal(uuid,date,app_period)','EXECUTE')
     or has_function_privilege('authenticated','resolve_meal(uuid,date,app_period)','EXECUTE') then
    raise exception 'FAIL fresh deploy leaves resolver RPCs open to clients';
  end if;
  raise notice 'PASS  fresh deploy: resolver RPCs revoked from clients';

  raise notice '---------------------------------------------------------';
  raise notice 'FRESH DEPLOY: makes no unapproved business decision. All checks pass.';
end $$;
