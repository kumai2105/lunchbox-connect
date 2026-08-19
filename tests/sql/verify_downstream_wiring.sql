-- =====================================================================
-- LunchBox Connect — Downstream wiring (migrations 0017/0019/0020)
--
-- Proves the chain the SCREENS now use actually works end to end:
--   legacy menus -> meals/rotation -> published meal_services
--   -> what Kitchen and Parent read -> the link an observation stores.
--
-- The other suites prove the engine is correct. This one proves the
-- product is plugged into it. Before this wiring, Kitchen and Parent read
-- the legacy `menus` table through a global calendar-week number, so both
-- showed the same week for seven weeks running.
--
-- One transaction, ROLLBACK at the end.
-- =====================================================================

begin;

do $$
declare
  v_inst uuid; v_class uuid; v_student uuid; v_teacher uuid; v_parent uuid;
  n int; n2 int; v_service uuid; d1 text; d2 text; v_rec uuid;
begin
  insert into institutions (name, kind) values ('ZZ Wire Nursery','nursery') returning id into v_inst;

  insert into menus (week_number, weekday, period, dish_name, published)
  select w, dd, p::app_period, 'ZZ Wire W'||w||'D'||dd||'-'||p, true
  from generate_series(1,4) w cross join generate_series(0,4) dd
  cross join unnest(array['breakfast','snack','lunch']) p;

  perform backfill_legacy_menus();
  perform publish_legacy_window(current_date - 7, current_date + 21);

  -- ---------------------------------------------------------------
  -- Kitchen / Parent read path: dated, published services exist.
  -- ---------------------------------------------------------------
  select count(*) into n from meal_services
   where institution_id = v_inst and published
     and service_date between current_date - 7 and current_date + 21;
  if n = 0 then
    raise exception 'FAIL wiring: no published Meal Services, every rewired screen would be blank';
  end if;
  raise notice 'PASS  wiring: % published dated services available to Kitchen and Parent', n;

  -- Nothing unpublished leaked into the window.
  select count(*) into n from meal_services
   where institution_id = v_inst and not published;
  if n <> 0 then
    raise exception 'FAIL wiring: % unpublished services present in the window', n;
  end if;
  raise notice 'PASS  wiring: 0 unpublished services (downstream reads published only)';

  -- ---------------------------------------------------------------
  -- THE REGRESSION THIS REPLACES: the same weekday in consecutive
  -- weeks must resolve to DIFFERENT dishes. The legacy path returned
  -- the same template for seven consecutive weeks.
  -- ---------------------------------------------------------------
  select mr.name into d1 from meal_services ms
    join meal_revisions mr on mr.id = ms.meal_revision_id
   where ms.institution_id = v_inst and ms.period = 'lunch'
     and ms.service_date = date_trunc('week', current_date)::date;
  select mr.name into d2 from meal_services ms
    join meal_revisions mr on mr.id = ms.meal_revision_id
   where ms.institution_id = v_inst and ms.period = 'lunch'
     and ms.service_date = date_trunc('week', current_date)::date + 7;
  if d1 is null or d2 is null then
    raise exception 'FAIL wiring: Monday lunch missing in one of two consecutive weeks (% / %)', d1, d2;
  end if;
  if d1 = d2 then
    raise exception 'FAIL wiring: two consecutive Mondays both serve % — the seven-week freeze is back', d1;
  end if;
  raise notice 'PASS  wiring: consecutive Mondays serve different lunches (% then %)', d1, d2;

  -- ---------------------------------------------------------------
  -- Classroom write path: the observation must STORE the link.
  -- record_serving_batch() previously persisted only menu_item_id, so
  -- resolving the service in the UI would have been thrown away.
  -- ---------------------------------------------------------------
  insert into classes (institution_id, name, grade) values (v_inst,'ZZ Wire Class','T')
    returning id into v_class;
  insert into students (student_no, institution_id, given_name, family_name, class_id,
                        enrollment_status, operational_status)
  values ('ZZ-W1', v_inst,'Wire','Child', v_class,'enrolled','ACTIVE_BILLABLE_TO_NURSERY')
    returning id into v_student;

  select id into v_service from meal_services
   where institution_id = v_inst and service_date = current_date and period = 'lunch';

  if v_service is null then
    raise notice 'NOTE  no service today (weekend); using the next weekday instead';
    select id into v_service from meal_services
     where institution_id = v_inst and period = 'lunch' and service_date > current_date
     order by service_date limit 1;
  end if;

  insert into serving_records (serving_date, class_id, student_id, period, served_status,
                               consumption_pct, behavior, concern_observed, meal_service_id,
                               recorded_by)
  values (current_date, v_class, v_student, 'lunch','served', 50,'ate_independently', false,
          v_service, (select user_id from app_users where role='super_admin' limit 1))
    returning id into v_rec;

  select count(*) into n from serving_records
   where id = v_rec and meal_service_id is not null;
  if n <> 1 then
    raise exception 'FAIL wiring: the observation did not store its meal_service_id';
  end if;
  raise notice 'PASS  wiring: the observation stores its Meal Service link';

  -- ...and that link resolves all the way back to a named dish, which is
  -- what the Parent Insights screen needs to label a favourite.
  select mr.name into d1
    from serving_records sr
    join meal_services ms on ms.id = sr.meal_service_id
    join meal_revisions mr on mr.id = ms.meal_revision_id
   where sr.id = v_rec;
  if d1 is null then
    raise exception 'FAIL wiring: stored link does not resolve to a dish name';
  end if;
  raise notice 'PASS  wiring: observation -> service -> revision resolves to "%"', d1;

  -- ---------------------------------------------------------------
  -- A correction must never blank an existing link (0020 conflict rule).
  --
  -- Called through the real RPC, with a real JWT, because that is the path
  -- the Classroom screen takes. record_serving_batch() stamps recorded_by
  -- from app_current_user_id(), so calling it without claims would fail on
  -- a not-null constraint rather than test anything.
  -- ---------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from app_users where role='super_admin' limit 1),
                      'role','authenticated')::text, true);

  perform record_serving_batch(
    v_class,
    jsonb_build_array(jsonb_build_object(
      'student_id', v_student, 'period', 'lunch',
      'served_status','served','consumption_pct','75'
    )),
    current_date);

  select count(*) into n from serving_records
   where id = v_rec and meal_service_id is not null;
  select consumption_pct into n2 from serving_records where id = v_rec;
  if n <> 1 then
    raise exception 'FAIL wiring: a correction with no service id ERASED the existing link';
  end if;
  if n2 <> 75 then
    raise exception 'FAIL wiring: the correction did not apply (pct=%)', n2;
  end if;
  raise notice 'PASS  wiring: a correction updated the value (75) and kept the existing link';

  -- ---------------------------------------------------------------
  -- The RPC must WRITE the link on a fresh insert, not merely preserve
  -- one that was inserted directly. This is what 0020 added, and it is
  -- the difference between the Classroom screen resolving the service and
  -- then silently throwing it away.
  -- ---------------------------------------------------------------
  insert into students (student_no, institution_id, given_name, family_name, class_id,
                        enrollment_status, operational_status)
  values ('ZZ-W2', v_inst,'Wire','ChildTwo', v_class,'enrolled','ACTIVE_BILLABLE_TO_NURSERY')
    returning id into v_student;

  perform record_serving_batch(
    v_class,
    jsonb_build_array(jsonb_build_object(
      'student_id', v_student, 'period', 'lunch',
      'served_status','served','consumption_pct','25',
      'meal_service_id', v_service
    )),
    current_date);

  select count(*) into n from serving_records
   where student_id = v_student and serving_date = current_date and period = 'lunch'
     and meal_service_id = v_service;
  if n <> 1 then
    raise exception 'FAIL wiring: record_serving_batch() did NOT persist meal_service_id on insert';
  end if;
  raise notice 'PASS  wiring: record_serving_batch() persists meal_service_id on a fresh insert';

  raise notice '---------------------------------------------------------';
  raise notice 'ALL WIRING CHECKS PASSED — rolling back, no data retained.';
end $$;

rollback;
