-- =====================================================================
-- LunchBox Connect — Legacy menu cutover (migration 0017)
--
-- Proves the backfill moves `menus` onto the Decision 033 chain WITHOUT
-- losing a dish, and that the resulting schedule advances weekly — which
-- the code it replaces did not.
--
-- THE DEFECT THIS PINS
--   The client derived the menu's week number with a helper that divided
--   by 7 twice, so the number advanced once every SEVEN calendar weeks.
--   Each planned menu week stayed live for seven real weeks, the
--   "4-week menu" spanned 28, and serving records were linked to
--   whichever dish sat at the wrong number. Any future change that
--   reintroduces a non-weekly advance fails this suite.
--
-- One transaction, ROLLBACK at the end. Nothing persists.
-- =====================================================================

begin;

do $$
declare
  v_inst  uuid;
  n int; n2 int; d date; prev int; cur int; changes int; wk int;
  dish_a text; dish_b text;
begin
  -- Legacy fixture: the numbers the broken helper actually produced.
  insert into institutions (name, kind) values ('ZZ Cutover Nursery','nursery')
    returning id into v_inst;

  insert into menus (week_number, weekday, period, dish_name, allergens, published)
  select w, dd, p::app_period, 'ZZ Dish W'||w||'D'||dd||'-'||p, '["gluten"]'::jsonb, true
  from generate_series(6,9) w
  cross join generate_series(0,4) dd
  cross join unnest(array['breakfast','snack','lunch','afternoon_snack']) p;

  -- Run the REAL migration logic, not a copy of it. It builds ONLY the meal
  -- library + rotation template now — it does not assign the rotation to any
  -- institution (that is an explicit Admin business decision).
  perform backfill_legacy_menus();

  -- Explicit Admin configuration: assign the (single, legacy-derived) rotation
  -- to this institution, exactly as the software would. Anchor 2026-01-05 (Mon).
  insert into institution_rotation_assignments (institution_id, rotation_id, effective_from, anchor_week)
  values (v_inst, '00000000-0000-4000-8000-000000000171'::uuid, date '2026-01-05', 1);
  -- Explicit contracted service plan (all periods the legacy menu carried).
  insert into institution_service_plans (institution_id, periods, effective_from)
  values (v_inst, (select array_agg(distinct period order by period) from menus), date '2026-01-05');

  -- ---------------------------------------------------------------
  -- Nothing lost: every distinct legacy dish has a Meal and revision.
  -- ---------------------------------------------------------------
  select count(distinct dish_name) into n from menus where dish_name like 'ZZ Dish%';
  select count(*) into n2 from meals mm
   where mm.name like 'ZZ Dish%' and mm.current_revision_id is not null;
  if n <> n2 then
    raise exception 'FAIL cutover: % legacy dishes but % meals with a revision', n, n2;
  end if;
  raise notice 'PASS  cutover: all % legacy dishes became Meals carrying revision 1', n;

  -- Allergens must survive; losing them is a safety defect, not a cosmetic one.
  select count(*) into n from meal_revisions r
    join meals mm on mm.id = r.meal_id
   where mm.name like 'ZZ Dish%' and r.allergens = '["gluten"]'::jsonb;
  if n <> n2 then
    raise exception 'FAIL cutover: allergens preserved on only % of % revisions', n, n2;
  end if;
  raise notice 'PASS  cutover: allergens preserved on all % revisions', n;

  -- Approval status must NOT be invented by a data migration.
  select count(*) into n from meal_revisions r
    join meals mm on mm.id = r.meal_id
   where mm.name like 'ZZ Dish%' and r.nutrition_status = 'APPROVED';
  if n <> 0 then
    raise exception 'FAIL the migration granted APPROVED to % revisions', n;
  end if;
  raise notice 'PASS  cutover: migration approved 0 revisions (approval stays a governance act)';

  -- ---------------------------------------------------------------
  -- THE REGRESSION GUARD: the rotation must advance EVERY week.
  -- ---------------------------------------------------------------
  changes := 0; prev := null;
  for i in 0..11 loop
    d := date '2026-01-05' + (i * 7);
    select week_number into cur from resolve_rotation_week(v_inst, d);
    if prev is not null and cur <> prev then changes := changes + 1; end if;
    prev := cur;
  end loop;
  if changes <> 11 then
    raise exception 'FAIL the rotation changed % times across 12 consecutive weeks, expected 11 (the old code managed 2)', changes;
  end if;
  raise notice 'PASS  rotation advances on all 11 week boundaries out of 12 weeks';

  -- ...and cycles with a period equal to week_count, whatever that is.
  -- Read the length from the rotation rather than assuming 4: the backfill
  -- sizes it from the data, so on a project with more planned weeks this
  -- must still hold.
  select r.week_count into n2 from rotations r
   where r.id = '00000000-0000-4000-8000-000000000171'::uuid;
  select week_number into wk from resolve_rotation_week(v_inst, date '2026-01-05');
  select week_number into n  from resolve_rotation_week(v_inst, date '2026-01-05' + (n2 * 7));
  if wk <> n then
    raise exception 'FAIL rotation did not repeat after its % weeks (% then %)', n2, wk, n;
  end if;
  raise notice 'PASS  rotation repeats after exactly its own length of % weeks (week % both times)', n2, wk;

  -- ---------------------------------------------------------------
  -- The dish a date resolves to must actually differ week to week.
  -- ---------------------------------------------------------------
  select mm.name into dish_a from resolve_meal(v_inst, date '2026-01-05', 'lunch') r
    join meals mm on mm.id = r.meal_id;
  select mm.name into dish_b from resolve_meal(v_inst, date '2026-01-12', 'lunch') r
    join meals mm on mm.id = r.meal_id;
  if dish_a is null or dish_b is null then
    raise exception 'FAIL lunch did not resolve after cutover (% / %)', dish_a, dish_b;
  end if;
  if dish_a = dish_b then
    raise exception 'FAIL consecutive weeks resolved to the SAME lunch (%) — the seven-week freeze is back', dish_a;
  end if;
  raise notice 'PASS  consecutive Mondays resolve to different lunches (% then %)', dish_a, dish_b;

  -- Legacy planning ORDER is preserved. Asserted RELATIVELY, against the
  -- ranking the backfill actually applied, rather than against a hard-coded
  -- dish name. An earlier version asserted 'position 1 is ZZ Dish W6...',
  -- which only held when the fixtures were the only rows in `menus`; on a
  -- real project with menu weeks already planned it failed even though the
  -- mapping was correct.
  select count(*) into n from (
    with ranked as (
      select week_number, (dense_rank() over (order by week_number))::int as pos
      from (select distinct week_number from menus) w
    )
    select 1
    from ranked rk
    join menus mn
      on mn.week_number = rk.week_number and mn.weekday = 0 and mn.period = 'lunch'
    join rotation_slots rs
      on rs.rotation_id = '00000000-0000-4000-8000-000000000171'::uuid
     and rs.week_number = rk.pos and rs.weekday = 0 and rs.period = 'lunch'
    join meals mm on mm.id = rs.meal_id
    where mm.name <> mn.dish_name
  ) bad;
  if n <> 0 then
    raise exception 'FAIL legacy week order not preserved for % week(s)', n;
  end if;
  raise notice 'PASS  every legacy week maps to its rank-ordered rotation position';

  -- NO DATA LOSS. Every distinct legacy (week, weekday, period) must have a
  -- slot. This is the check that catches a rotation sized too small: an
  -- earlier backfill hard-coded 4 weeks and used `% 4`, so with more than
  -- four planned weeks the positions collided and `on conflict do nothing`
  -- silently discarded the surplus.
  select count(distinct (week_number, weekday, period)) into n from menus;
  select count(*) into n2 from rotation_slots
   where rotation_id = '00000000-0000-4000-8000-000000000171'::uuid;
  if n2 <> n then
    raise exception 'FAIL cutover DROPPED schedule entries: % legacy slots became % rotation slots', n, n2;
  end if;
  raise notice 'PASS  no data loss: all % legacy schedule entries became rotation slots', n;

  -- Idempotency: running the backfill twice must not duplicate anything.
  select count(*) into n from rotation_slots
   where rotation_id = '00000000-0000-4000-8000-000000000171'::uuid;
  perform backfill_legacy_menus();
  select count(*) into n2 from rotation_slots
   where rotation_id = '00000000-0000-4000-8000-000000000171'::uuid;
  if n <> n2 then
    raise exception 'FAIL backfill is not idempotent: % slots became %', n, n2;
  end if;
  raise notice 'PASS  backfill is idempotent (% slots before and after a second run)', n;

  raise notice '---------------------------------------------------------';
  raise notice 'ALL CUTOVER CHECKS PASSED — rolling back, no data retained.';
end $$;

rollback;
