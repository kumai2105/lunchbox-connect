-- =====================================================================
-- §37 SPECIAL PERIOD / CAMP — multi-week rotation must resolve the correct
-- week from the special period's own alignment, never an arbitrary slot.
-- One transaction, ROLLBACK at the end.
-- =====================================================================
begin;

do $$
declare
  v_inst uuid; v_rot uuid;
  v_m1w1 uuid; v_m1w2 uuid;  -- Monday lunch meals for camp week 1 / week 2
  got1 text; got2 text; got3 text;
begin
  insert into institutions (name, kind) values ('ZZ Camp Nursery','nursery') returning id into v_inst;
  insert into institution_service_plans (institution_id, periods, effective_from)
  values (v_inst, array['breakfast','lunch']::app_period[], date '2026-01-01');

  -- Four distinct meals so week 1 and week 2 Monday lunches are distinguishable.
  insert into meals (name) values ('Camp W1 Lunch') returning id into v_m1w1;
  insert into meals (name) values ('Camp W2 Lunch') returning id into v_m1w2;
  insert into meal_revisions (meal_id, revision_no, name)
    values (v_m1w1,1,'Camp W1 Lunch'), (v_m1w2,1,'Camp W2 Lunch');
  update meals set current_revision_id = r.id from meal_revisions r
    where r.meal_id = meals.id and meals.name like 'Camp W%';

  -- A 2-WEEK camp rotation. Monday(0) lunch differs between the two weeks.
  insert into rotations (id, name, week_count) values (gen_random_uuid(),'ZZ Camp 2wk',2) returning id into v_rot;
  insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id) values
    (v_rot, 1, 0, 'lunch', v_m1w1),
    (v_rot, 2, 0, 'lunch', v_m1w2);

  -- Special period covering three weeks starting Mon 2026-03-02.
  insert into calendar_exceptions (institution_id, kind, date_from, date_to, rotation_id)
  values (v_inst, 'special_period', date '2026-03-02', date '2026-03-22', v_rot);

  -- Week 1 Monday (2026-03-02) must resolve W1; week 2 Monday (2026-03-09) W2;
  -- week 3 Monday (2026-03-16) cycles back to W1 (2-week rotation).
  select mm.name into got1 from resolve_meal(v_inst, date '2026-03-02','lunch') r join meals mm on mm.id=r.meal_id;
  select mm.name into got2 from resolve_meal(v_inst, date '2026-03-09','lunch') r join meals mm on mm.id=r.meal_id;
  select mm.name into got3 from resolve_meal(v_inst, date '2026-03-16','lunch') r join meals mm on mm.id=r.meal_id;

  if got1 <> 'Camp W1 Lunch' then raise exception 'FAIL §37 camp week 1 Monday resolved % (want Camp W1 Lunch)', got1; end if;
  if got2 <> 'Camp W2 Lunch' then raise exception 'FAIL §37 camp week 2 Monday resolved % (want Camp W2 Lunch)', got2; end if;
  if got3 <> 'Camp W1 Lunch' then raise exception 'FAIL §37 camp week 3 Monday resolved % (want Camp W1 Lunch, cycled)', got3; end if;

  raise notice 'PASS  §37 camp weeks resolve correctly: W1=%, W2=%, W3=% (cycled)', got1, got2, got3;
  raise notice '---------------------------------------------------------';
  raise notice 'SPECIAL PERIOD: multi-week rotation week resolved from period alignment. Pass.';
end $$;

rollback;
