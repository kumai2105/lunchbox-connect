-- =====================================================================
-- Item 14 (server side) — analytics stay EXACT past the old 5,000 cap.
--
-- The client fix is exhaustive pagination (unit-tested in
-- src/lib/pagination.test.ts). This proves the other half: the authoritative
-- server-side aggregation itself is exact at volume, so the numbers the client
-- pages toward are the right ones.
--
-- One transaction, ROLLBACK.
-- =====================================================================
begin;
do $$
declare
  v_super uuid := '00000000-0000-0000-0000-0000000000a1';
  v_inst uuid; v_cls uuid; v_staff uuid; v_meal uuid; v_rev uuid; v_service uuid;
  v_total int := 6000;      -- deliberately past 5,000
  v_hundreds int := 5000;   -- the first 5,000 are 100% …
  n bigint; v_avg numeric; v_scored bigint; v_valid bigint;
begin
  insert into institutions (name, kind) values ('ZZ Vol Nursery','nursery') returning id into v_inst;
  insert into auth.users (email) values ('vol.staff@t.test') returning id into v_staff;
  insert into app_users (user_id, role, full_name, email, institution_id)
    values (v_staff,'classroom_staff','Vol Staff','vol.staff@t.test',v_inst);
  insert into classes (institution_id, name, grade) values (v_inst,'Vol Class','T') returning id into v_cls;
  insert into class_staff (class_id, user_id) values (v_cls, v_staff);
  insert into meals (name) values ('ZZ Vol Meal') returning id into v_meal;
  insert into meal_revisions (meal_id, revision_no, name) values (v_meal,1,'ZZ Vol Meal') returning id into v_rev;
  insert into meal_services (institution_id, service_date, period, meal_revision_id, published)
    values (v_inst, app_operational_date(), 'lunch', v_rev, true) returning id into v_service;

  -- 6,000 students, one observation each. The first 5,000 ate everything and
  -- the last 1,000 ate none: a 5,000-row cap would report 100%, which looks
  -- entirely plausible. The exact answer is 83.3%.
  insert into students (student_no, institution_id, given_name, family_name, class_id, operational_status)
  select 'ZZV-'||g, v_inst, 'Vol', g::text, v_cls, 'ACTIVE_BILLABLE_TO_NURSERY'
    from generate_series(1, v_total) g;

  insert into serving_records (serving_date, class_id, student_id, period, served_status,
                               consumption_pct, behavior, meal_service_id, recorded_by)
  select app_operational_date(), v_cls, s.id, 'lunch', 'served',
         case when row_number() over (order by s.student_no) <= v_hundreds then 100 else 0 end,
         'ate_independently', v_service, v_staff
    from students s
   where s.institution_id = v_inst;

  select count(*) into n from serving_records where meal_service_id = v_service;
  if n <> v_total then raise exception 'FIXTURE: seeded % of % observations', n, v_total; end if;
  raise notice 'PASS v1: % observations seeded — past the retired 5,000 cap', n;

  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  select valid_observations, scored_observations, avg_consumption_pct
    into v_valid, v_scored, v_avg
    from v_meal_performance where dish_name = 'ZZ Vol Meal' and period = 'lunch';
  reset role;

  if v_valid <> v_total then
    raise exception 'FAIL v2: analytics counted % valid of % — the population is truncated', v_valid, v_total;
  end if;
  if v_scored <> v_total then
    raise exception 'FAIL v2: analytics scored % of % observations', v_scored, v_total;
  end if;
  raise notice 'PASS v2: every one of the % observations is counted', v_valid;

  -- 5000*100 / 6000 = 83.333… → 83.3 at one decimal.
  if v_avg is null or round(v_avg, 1) <> 83.3 then
    raise exception
      'FAIL v3: average consumption is % — a truncated read would have said 100.0', v_avg;
  end if;
  raise notice 'PASS v3: the average over 6,000 rows is exactly 83.3%% (a capped read would say 100%%)';

  raise notice '---------------------------------------------------------';
  raise notice 'ANALYTICS VOLUME: exact past the retired 5,000-row cap.';
end $$;
rollback;
