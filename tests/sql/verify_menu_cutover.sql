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

  -- Run the REAL migration logic, not a copy of it.
  perform backfill_legacy_menus();

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

  -- ...and cycles with a period equal to week_count, not longer.
  select week_number into wk from resolve_rotation_week(v_inst, date '2026-01-05');
  select week_number into n  from resolve_rotation_week(v_inst, date '2026-02-02');
  if wk <> n then
    raise exception 'FAIL rotation did not repeat after 4 weeks (% then %)', wk, n;
  end if;
  raise notice 'PASS  rotation repeats after exactly 4 weeks (week % both times)', wk;

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

  -- Legacy planning ORDER is preserved: week 6 -> position 1, 9 -> 4.
  select mm.name into dish_a from resolve_meal(v_inst, date '2026-01-05', 'lunch') r
    join meals mm on mm.id = r.meal_id;
  if dish_a <> 'ZZ Dish W6D0-lunch' then
    raise exception 'FAIL legacy week order not preserved: position 1 resolved to %', dish_a;
  end if;
  select mm.name into dish_a from resolve_meal(v_inst, date '2026-01-26', 'lunch') r
    join meals mm on mm.id = r.meal_id;
  if dish_a <> 'ZZ Dish W9D0-lunch' then
    raise exception 'FAIL legacy week order not preserved: position 4 resolved to %', dish_a;
  end if;
  raise notice 'PASS  legacy planning order preserved (week 6->position 1, week 9->position 4)';

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
