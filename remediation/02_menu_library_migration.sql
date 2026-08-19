-- =====================================================================
-- 02_menu_library_migration.sql — DATA/LIBRARY ONLY. No business decisions.
--
-- Moves the legacy `menus` rows into the modern shape WITHOUT deciding any
-- institution's configuration. It creates:
--   • one Meal per distinct legacy dish name,
--   • revision 1 of each (carrying the legacy allergens/ingredients/etc.),
--   • one rotation TEMPLATE and its weekly slots.
--
-- It DOES NOT, and MUST NOT:
--   ✗ assign the rotation to any institution,
--   ✗ create, delete, or modify any institution_service_plans,
--   ✗ publish any meal_services.
-- Those are business acts handled explicitly in 03 and 04. The master menu
-- does NOT determine an institution's contracted periods (domain rule 7).
--
-- Idempotent: guarded on the fixed template UUID and on name existence.
-- `menus` is left completely intact.
--
-- ── TRANSACTION SAFETY ── does NOT commit. Same rules as 01: review the
--    notices, then `commit;` in psql (the Supabase editor auto-commits).
-- =====================================================================
begin;

do $b$ begin
  raise notice 'BEFORE: meals=%, meal_revisions=%, rotations=%, rotation_slots=%',
    (select count(*) from meals), (select count(*) from meal_revisions),
    (select count(*) from rotations), (select count(*) from rotation_slots);
end $b$;

-- The template rotation. Length is taken from the data, never assumed.
-- Named "Legacy menu (template)" and NOT assigned to anyone here.
do $mig$
declare v_weeks int;
begin
  select greatest(count(distinct week_number), 1)::int into v_weeks from menus;

  insert into rotations (id, name, week_count)
  values ('00000000-0000-4000-8000-000000000171'::uuid, 'Legacy menu (template)', v_weeks)
  on conflict (id) do update set week_count = excluded.week_count;

  -- One Meal per distinct dish (matched by name — the only identity the
  -- legacy table had).
  insert into meals (name)
  select distinct m.dish_name from menus m
  where not exists (select 1 from meals x where x.name = m.dish_name);

  -- Revision 1 carries the legacy content. nutrition_status stays whatever
  -- the legacy row said (NOT_APPROVED by default) — approval is never
  -- invented by a migration.
  insert into meal_revisions (meal_id, revision_no, name, ingredients, allergens,
                              nutrition, portion, nutrition_status)
  select distinct on (mm.id)
         mm.id, 1, mm.name,
         coalesce(src.ingredients,'[]'::jsonb), coalesce(src.allergens,'[]'::jsonb),
         coalesce(src.nutrition,'{}'::jsonb), src.portion,
         coalesce(src.source_status,'NOT_APPROVED')
  from meals mm join menus src on src.dish_name = mm.name
  where not exists (select 1 from meal_revisions r where r.meal_id = mm.id)
  order by mm.id, src.updated_at desc;

  update meals m set current_revision_id = r.id
    from meal_revisions r
   where r.meal_id = m.id and r.revision_no = 1 and m.current_revision_id is null;

  -- Template slots. Legacy week numbers dense-ranked into positions in
  -- ascending order; no modulo, so every distinct week keeps its own slot
  -- (no silent data loss).
  with ranked as (
    select week_number, (dense_rank() over (order by week_number))::int as rot_week
    from (select distinct week_number from menus) w
  )
  insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id)
  select '00000000-0000-4000-8000-000000000171'::uuid, r.rot_week, mn.weekday, mn.period, mm.id
  from menus mn
  join ranked r on r.week_number = mn.week_number
  join meals mm on mm.name = mn.dish_name
  on conflict (rotation_id, week_number, weekday, period) do nothing;
end $mig$;

-- Proof it stayed in its lane: these must be unchanged by this script.
do $a$
declare n_assign int; n_plan int; n_pub int;
begin
  select count(*) into n_assign from institution_rotation_assignments;
  select count(*) into n_plan   from institution_service_plans;
  select count(*) into n_pub    from meal_services;
  raise notice 'AFTER:  meals=%, revisions=%, rotations=%, slots=%',
    (select count(*) from meals), (select count(*) from meal_revisions),
    (select count(*) from rotations), (select count(*) from rotation_slots);
  raise notice 'UNTOUCHED (must match your before-state): rotation_assignments=%, service_plans=%, meal_services=%',
    n_assign, n_plan, n_pub;
  raise notice 'Review, then:  commit;  (or rollback;)';
end $a$;

-- NO commit here on purpose.
