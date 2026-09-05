-- =====================================================================
-- 03_institution_config.TEMPLATE.sql — EXPLICIT, HUMAN-FILLED. No guessing.
--
-- An institution's rotation assignment and service plan are BUSINESS
-- AGREEMENTS. They cannot be inferred from the menu, and they cannot be
-- assumed to be the same for every institution. This template makes you
-- state them explicitly, per institution, from authoritative sources.
--
-- If you do NOT know an institution's real service plan or rotation
-- assignment, DO NOT fill it in. Leave it out. That institution stays
-- BLOCKED_BY_SPEC / unconfigured until someone with the agreement
-- configures it. An unconfigured institution simply resolves no meals —
-- which is correct, not broken.
--
-- HOW TO USE
--   1. Copy this file per institution (or duplicate the block below).
--   2. Replace every <<...>> placeholder with a real, approved value.
--   3. Remove the guard block at the top once (and only once) you have
--      filled real values — it exists to stop an accidental blind run.
--   4. Run in psql; review; commit;
-- =====================================================================
begin;

-- GUARD: refuses to run while placeholders remain. Delete this block only
-- after you have replaced every <<...>> below with real values.
do $guard$
begin
  raise exception
    'STOP: 03 is a template. Fill in the real rotation assignment and service '
    'plan for THIS institution, then delete the guard block. Nothing was run.';
end $guard$;

-- ---- ONE institution. Duplicate this whole section per institution. ----
do $cfg$
declare
  v_inst uuid;
  -- >>> FILL THESE FROM THE INSTITUTION'S ACTUAL AGREEMENT <<<
  v_inst_name    text            := '<<EXACT INSTITUTION NAME>>';
  v_rotation_id  uuid            := '<<ROTATION UUID this institution actually uses>>';
  v_anchor_from  date            := '<<YYYY-MM-DD Monday the rotation is anchored to>>';
  v_anchor_week  int             := 1;                       -- which rotation week that Monday is
  v_periods      app_period[]    := '<<{breakfast,snack,lunch}>>'::app_period[];  -- CONTRACTED periods
  v_plan_from    date            := '<<YYYY-MM-DD service plan effective date>>';
begin
  select id into v_inst from institutions where name = v_inst_name;
  if v_inst is null then
    raise exception 'No institution named "%". Nothing changed.', v_inst_name;
  end if;

  -- Rotation assignment (explicit). One row; upsert on institution.
  insert into institution_rotation_assignments (institution_id, rotation_id, effective_from, anchor_week)
  values (v_inst, v_rotation_id, v_anchor_from, v_anchor_week);

  -- Service plan (explicit, the contracted periods — NOT menu-derived).
  insert into institution_service_plans (institution_id, periods, effective_from)
  values (v_inst, v_periods, v_plan_from);

  raise notice 'Configured "%": rotation % from % (week %), periods % from %',
    v_inst_name, v_rotation_id, v_anchor_from, v_anchor_week, v_periods, v_plan_from;
end $cfg$;

do $$ begin raise notice 'Review, then:  commit;  (or rollback;)'; end $$;
-- NO commit here on purpose.
