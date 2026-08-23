-- =====================================================================
-- verify_meal_period_tags — a Meal states which sittings it suits, the
-- tags travel with the meal rather than beside it, and the authority to
-- change them is the same authority that owns the Meal Library.
--
-- The tag is an AUTHORING AID, not a safety control, and these assertions
-- say so explicitly: a slot whose meal is not tagged for that period is
-- still accepted, because a kitchen occasionally breaks its own pattern and
-- the database is not the place to forbid it. What is asserted is that the
-- tag is stored truthfully, replaced as a set, scoped to the Super Admin,
-- and destroyed with its meal.
-- =====================================================================
do $$
declare
  v_sa    uuid := '00000000-0000-0000-0000-0000000000c1';
  v_na    uuid := '00000000-0000-0000-0000-0000000000c2';
  v_inst  uuid;
  v_meal  uuid;
  v_other uuid;
  v_rot   uuid;
  v_n     int;
  v_txt   text;
begin
  insert into institutions (name, kind) values ('MPT Institution', 'nursery')
    on conflict (name) do nothing;
  select id into v_inst from institutions where name = 'MPT Institution';

  insert into auth.users (id, email) values
    (v_sa, 'mpt.sa@zz.test'), (v_na, 'mpt.na@zz.test')
    on conflict (id) do nothing;
  insert into app_users (user_id, role, institution_id, full_name, email) values
    (v_sa, 'super_admin',  null,   'MPT Super', 'mpt.sa@zz.test'),
    (v_na, 'school_admin', v_inst, 'MPT NA',    'mpt.na@zz.test')
    on conflict (user_id) do update
      set role = excluded.role, institution_id = excluded.institution_id;

  -- ---------------------------------------------------------------- t1
  -- A Super Admin creates a meal WITH tags, in one call. Two of them, to
  -- prove multi-select is real and not a single value in disguise.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_meal := save_meal(null, 'MPT Fruit bowl', '["fruit"]'::jsonb, '[]'::jsonb,
                      '{}'::jsonb, '1 bowl', null, 'NOT_APPROVED',
                      array['breakfast','snack']::app_period[]);
  reset role;

  select count(*) into v_n from meal_periods where meal_id = v_meal;
  if v_n <> 2 then
    raise exception 'FAIL t1: expected 2 tags on a new meal, got %', v_n;
  end if;
  if not exists (select 1 from meal_periods where meal_id = v_meal and period = 'breakfast')
     or not exists (select 1 from meal_periods where meal_id = v_meal and period = 'snack') then
    raise exception 'FAIL t1: the two tags saved are not the two asked for';
  end if;
  raise notice 'PASS t1: one meal carries two sittings, saved in the same call';

  -- ---------------------------------------------------------------- t2
  -- Editing REPLACES the tag set. Not a merge: removing a sitting has to be
  -- possible, and an append-only tag list would make a mistake permanent.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform save_meal(v_meal, 'MPT Fruit bowl', '["fruit"]'::jsonb, '[]'::jsonb,
                    '{}'::jsonb, '1 bowl', null, 'NOT_APPROVED',
                    array['lunch']::app_period[]);
  reset role;

  select count(*) into v_n from meal_periods where meal_id = v_meal;
  if v_n <> 1 then raise exception 'FAIL t2: replace left % tags, expected 1', v_n; end if;
  if not exists (select 1 from meal_periods where meal_id = v_meal and period = 'lunch') then
    raise exception 'FAIL t2: the replacement tag is not the one asked for';
  end if;
  raise notice 'PASS t2: saving replaces the tag set rather than adding to it';

  -- ---------------------------------------------------------------- t3
  -- The meal itself is untouched by tagging: editing tags still appends a
  -- revision (one save = one revision, Decision 033) and the meal keeps its
  -- identity, so analytics and images stay together. This is the reason the
  -- model tags one meal instead of duplicating it per sitting.
  select count(*) into v_n from meal_revisions where meal_id = v_meal;
  if v_n <> 2 then
    raise exception 'FAIL t3: expected 2 revisions after two saves, got %', v_n;
  end if;
  raise notice 'PASS t3: the meal keeps one identity across a tag change';

  -- ---------------------------------------------------------------- t4
  -- NULL means "leave the tags alone" — an older client that does not know
  -- about tags must not silently wipe them.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform save_meal(v_meal, 'MPT Fruit bowl', '["fruit"]'::jsonb, '[]'::jsonb,
                    '{}'::jsonb, '1 bowl', null, 'NOT_APPROVED', null);
  reset role;

  select count(*) into v_n from meal_periods where meal_id = v_meal;
  if v_n <> 1 then
    raise exception 'FAIL t4: a null tag argument changed the tags (now %)', v_n;
  end if;
  raise notice 'PASS t4: omitting the tags leaves them exactly as they were';

  -- ---------------------------------------------------------------- t5
  -- An EMPTY array is a real instruction and is not the same as NULL.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform save_meal(v_meal, 'MPT Fruit bowl', '["fruit"]'::jsonb, '[]'::jsonb,
                    '{}'::jsonb, '1 bowl', null, 'NOT_APPROVED',
                    array[]::app_period[]);
  reset role;

  select count(*) into v_n from meal_periods where meal_id = v_meal;
  if v_n <> 0 then
    raise exception 'FAIL t5: an empty array left % tags behind', v_n;
  end if;
  raise notice 'PASS t5: an empty array clears the tags, and is not NULL';

  -- restore a usable tag for the checks below
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform save_meal(v_meal, 'MPT Fruit bowl', '["fruit"]'::jsonb, '[]'::jsonb,
                    '{}'::jsonb, '1 bowl', null, 'NOT_APPROVED',
                    array['breakfast']::app_period[]);
  reset role;

  -- ---------------------------------------------------------------- t6
  -- Only a Super Admin may tag. A Nursery Admin does not author menus, and
  -- the tag decides what every institution is offered.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_na, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into meal_periods (meal_id, period) values (v_meal, 'lunch');
    reset role;
    raise exception 'FAIL t6: a Nursery Admin tagged a meal';
  exception
    when insufficient_privilege or check_violation then
      reset role;
      raise notice 'PASS t6: a Nursery Admin cannot tag a meal';
    when others then
      reset role;
      if sqlstate = '42501' then
        raise notice 'PASS t6: a Nursery Admin cannot tag a meal';
      else
        raise;
      end if;
  end;

  -- ---------------------------------------------------------------- t7
  -- ...and cannot remove one either.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_na, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    delete from meal_periods where meal_id = v_meal;
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 0 then raise exception 'FAIL t7: a Nursery Admin deleted % tags', v_n; end if;
    raise notice 'PASS t7: a Nursery Admin cannot remove a tag';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS t7: tag removal is refused outright for a Nursery Admin';
  end;

  -- ---------------------------------------------------------------- t8
  -- anon holds nothing. The Meal Library is not public.
  select string_agg(privilege_type, ',' order by privilege_type) into v_txt
  from information_schema.role_table_grants
  where table_name = 'meal_periods' and grantee = 'anon';
  if v_txt is not null then
    raise exception 'FAIL t8: anon holds % on meal_periods', v_txt;
  end if;
  raise notice 'PASS t8: anon holds no grant on meal_periods';

  -- ---------------------------------------------------------------- t9
  -- THE TAG DOES NOT FORBID. A slot may still be filled with a meal that is
  -- not tagged for that period — Menu Builder offers an explicit override and
  -- the database must honour it, or the override would be a lie.
  insert into rotations (name, week_count) values ('MPT Rotation', 1)
    returning id into v_rot;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id)
    values (v_rot, 1, 0, 'lunch', v_meal);   -- meal is tagged breakfast only
  reset role;

  if not exists (
    select 1 from rotation_slots
    where rotation_id = v_rot and period = 'lunch' and meal_id = v_meal
  ) then
    raise exception 'FAIL t9: an untagged-for-this-period meal was refused a slot';
  end if;
  raise notice 'PASS t9: the tag guides authoring and never blocks a slot';

  -- ---------------------------------------------------------------- t10
  -- Tags die with their meal. A meal_periods row pointing at a meal that no
  -- longer exists would be exactly the floating, related-to-nothing data the
  -- model is meant to prevent.
  insert into meals (name, active) values ('MPT Doomed', true) returning id into v_other;
  insert into meal_periods (meal_id, period) values (v_other, 'lunch');
  delete from rotation_slots where meal_id = v_other;
  delete from meals where id = v_other;

  select count(*) into v_n from meal_periods where meal_id = v_other;
  if v_n <> 0 then
    raise exception 'FAIL t10: % orphan tags survived their meal', v_n;
  end if;
  raise notice 'PASS t10: tags are destroyed with the meal they describe';

  -- ---------------------------------------------------------------- t11
  -- A tag can only ever be one of the four real periods. The column is the
  -- app_period type itself, so an invented sitting is a type error, not a
  -- row that quietly never matches anything.
  begin
    insert into meal_periods (meal_id, period) values (v_meal, 'brunch');
    raise exception 'FAIL t11: an invented period was accepted';
  exception when invalid_text_representation then
    raise notice 'PASS t11: a period outside the four is rejected by the type';
  end;

  -- ---------------------------------------------------------------- t12
  -- The primary key makes a duplicate tag impossible, so "breakfast" cannot
  -- be recorded twice for one meal and inflate a filter count.
  begin
    insert into meal_periods (meal_id, period) values (v_meal, 'breakfast');
    raise exception 'FAIL t12: a duplicate tag was accepted';
  exception when unique_violation then
    raise notice 'PASS t12: the same sitting cannot be tagged twice on one meal';
  end;

  raise notice 'verify_meal_period_tags: all assertions passed';
end $$;
