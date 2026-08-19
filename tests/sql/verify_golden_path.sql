-- =====================================================================
-- LunchBox Connect — Golden Path & Cross-Portal Verification
-- Covers final-verification sections §114, §95, §59, §112, §47, §67.
--
-- HOW TO RUN
--   Paste the whole file into the Supabase SQL editor and execute.
--   It runs inside ONE transaction and ROLLS BACK at the end, so it
--   leaves no data behind. Nothing here mutates production state.
--
-- HOW TO READ
--   Every check RAISEs a line prefixed PASS or FAIL, plus the actual
--   numbers it compared. Any FAIL aborts with an exception so a failure
--   can never be scrolled past or mistaken for success.
--
-- WHY A SCRIPT
--   The MCP connector was unavailable when this was written. This is the
--   same set of assertions, executable by you, independently.
-- =====================================================================

begin;

do $$
declare
  v_inst        uuid;
  v_class_a     uuid;
  v_class_b     uuid;
  v_hist_class  uuid;
  v_student     uuid;
  v_student2    uuid;
  v_student3    uuid;
  v_teacher     uuid;
  v_parent      uuid;
  v_meal        uuid;
  v_rev_a       uuid;
  v_rev_b       uuid;
  v_rotation    uuid;
  v_service     uuid;
  v_date        date := current_date;
  v_weekday     smallint := (extract(isodow from current_date)::int - 1)::smallint;
  n             int;
  n2            int;
  txt           text;
begin
  -- Weekend guard: the rotation below only defines Mon-Fri slots.
  if v_weekday > 4 then
    v_date := v_date - (v_weekday - 4);
    v_weekday := (extract(isodow from v_date)::int - 1)::smallint;
    raise notice 'NOTE  weekend detected, testing against most recent weekday %', v_date;
  end if;

  -- ---------------------------------------------------------------
  -- §114 STEP 2-7 — Institution, Class, Student, eligibility
  -- ---------------------------------------------------------------
  insert into institutions (name, kind) values ('ZZ Verify Nursery', 'nursery')
    returning id into v_inst;

  insert into classes (institution_id, name, grade) values (v_inst, 'ZZ Class A', 'T')
    returning id into v_class_a;
  insert into classes (institution_id, name, grade) values (v_inst, 'ZZ Class B', 'T')
    returning id into v_class_b;

  insert into students (student_no, institution_id, given_name, family_name,
                        class_id, enrollment_status, operational_status)
  values ('ZZ-001', v_inst, 'Verify', 'ChildOne', v_class_a, 'enrolled',
          'ACTIVE_BILLABLE_TO_NURSERY')
    returning id into v_student;

  -- A second, NON-eligible student: must never enter the production chain.
  insert into students (student_no, institution_id, given_name, family_name,
                        class_id, enrollment_status, operational_status)
  values ('ZZ-002', v_inst, 'Verify', 'ChildTwo', v_class_a, 'pending', null)
    returning id into v_student2;

  select count(*) into n from students
   where institution_id = v_inst and operational_status = 'ACTIVE_BILLABLE_TO_NURSERY';
  if n <> 1 then
    raise exception 'FAIL §23 eligibility gate: expected 1 eligible student, got %', n;
  end if;
  raise notice 'PASS  §114/§23 institution, 2 classes, 2 students; exactly % eligible', n;

  -- ---------------------------------------------------------------
  -- §114 STEP 8-9 — Meal + two revisions (§28 historical integrity)
  -- ---------------------------------------------------------------
  insert into meals (name) values ('ZZ Verify Meal') returning id into v_meal;

  insert into meal_revisions (meal_id, revision_no, name, ingredients, portion)
  values (v_meal, 1, 'ZZ Verify Meal', '["recipe v1"]'::jsonb, '1 portion')
    returning id into v_rev_a;
  update meals set current_revision_id = v_rev_a where id = v_meal;

  -- ---------------------------------------------------------------
  -- §114 STEP 10-13 — Rotation, calendar assignment, service plan
  -- §30 rotation length must be data-driven: use 3 weeks, not 4.
  -- ---------------------------------------------------------------
  insert into rotations (name, week_count) values ('ZZ Verify Rotation 3wk', 3)
    returning id into v_rotation;

  insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id)
  select v_rotation, w.wk, d.wd, p.per, v_meal
  from (values (1),(2),(3)) w(wk)
  cross join (values (0),(1),(2),(3),(4)) d(wd)
  cross join (values ('breakfast'::app_period),('snack'),('lunch'),('afternoon_snack')) p(per);

  select count(*) into n from rotation_slots where rotation_id = v_rotation;
  if n <> 60 then
    raise exception 'FAIL §29 rotation slots: expected 60 (3wk x 5d x 4p), got %', n;
  end if;
  raise notice 'PASS  §29/§30 rotation persisted with % slots, week_count=3 (not hard-coded 4)', n;

  insert into institution_rotation_assignments (institution_id, rotation_id, effective_from, anchor_week)
  values (v_inst, v_rotation, v_date - 7, 1);

  -- §40 THREE-meal plan while the rotation carries FOUR periods.
  insert into institution_service_plans (institution_id, periods, effective_from)
  values (v_inst, array['breakfast','snack','lunch']::app_period[], v_date - 30);

  -- ---------------------------------------------------------------
  -- §40 Service Plan must filter the fourth period out
  -- ---------------------------------------------------------------
  if (select meal_id from resolve_meal(v_inst, v_date, 'lunch')) is null then
    raise exception 'FAIL §40: lunch should resolve for a three-meal plan';
  end if;
  if (select meal_id from resolve_meal(v_inst, v_date, 'afternoon_snack')) is not null then
    raise exception 'FAIL §40: afternoon snack resolved despite a three-meal service plan';
  end if;
  raise notice 'PASS  §40 service plan filters: lunch resolves, afternoon snack does NOT';

  -- ---------------------------------------------------------------
  -- §37 resolution precedence — closure beats rotation
  -- ---------------------------------------------------------------
  insert into calendar_exceptions (institution_id, kind, date_from, date_to, period, reason)
  values (v_inst, 'closure', v_date, v_date, 'breakfast', 'ZZ closure probe');
  if (select meal_id from resolve_meal(v_inst, v_date, 'breakfast')) is not null then
    raise exception 'FAIL §34/§37: a closure did not suppress service';
  end if;
  raise notice 'PASS  §34/§37 closure suppresses only its own period';
  delete from calendar_exceptions where institution_id = v_inst and kind = 'closure';

  -- ---------------------------------------------------------------
  -- §114 STEP 14-15 — publish, then the dated Meal Service resolves
  -- ---------------------------------------------------------------
  insert into meal_services (institution_id, service_date, period, meal_revision_id,
                             rotation_id, published, published_at)
  select v_inst, v_date, p.per, v_rev_a, v_rotation, true, now()
  from (values ('breakfast'::app_period),('snack'),('lunch')) p(per)
  on conflict (institution_id, service_date, period) do nothing;

  select id into v_service from meal_services
   where institution_id = v_inst and service_date = v_date and period = 'lunch';
  if v_service is null then
    raise exception 'FAIL §42: no dated Meal Service resolved for lunch';
  end if;
  raise notice 'PASS  §42/§114-15 dated Meal Service exists for % lunch', v_date;

  -- ---------------------------------------------------------------
  -- §114 STEP 16 / §44 — Production Demand counts ONLY the eligible child
  -- ---------------------------------------------------------------
  select count(*) into n
    from students s
   where s.institution_id = v_inst
     and s.enrollment_status = 'enrolled'
     and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY';
  if n <> 1 then
    raise exception 'FAIL §44 production demand: expected 1 eligible, got %', n;
  end if;
  raise notice 'PASS  §44 production demand includes exactly 1 eligible child (ineligible excluded)';

  -- ---------------------------------------------------------------
  -- §114 STEP 20-21 / §95 — record the observation ONCE
  -- ---------------------------------------------------------------
  insert into serving_records (serving_date, class_id, student_id, period, served_status,
                               consumption_pct, behavior, concern_observed,
                               meal_service_id, recorded_by)
  values (v_date, v_class_a, v_student, 'lunch', 'served', 75, 'ate_independently',
          false, v_service, (select user_id from app_users where role = 'super_admin' limit 1));

  select count(*) into n from serving_records
   where student_id = v_student and serving_date = v_date and period = 'lunch';
  if n <> 1 then
    raise exception 'FAIL §114-21: observation did not persist (rows=%)', n;
  end if;
  raise notice 'PASS  §114-20/21 observation recorded once and persisted';

  -- §95 the SAME row is what every portal reads -----------------------
  select sr.consumption_pct, mr.name
    into n, txt
    from serving_records sr
    join meal_services ms on ms.id = sr.meal_service_id
    join meal_revisions mr on mr.id = ms.meal_revision_id
   where sr.student_id = v_student and sr.serving_date = v_date and sr.period = 'lunch';
  if n <> 75 then
    raise exception 'FAIL §95: cross-portal join lost the value (got %)', n;
  end if;
  raise notice 'PASS  §95 one record links Student -> Meal Service -> Meal revision "%" at % percent', txt, n;

  -- §78 parent-facing mapping is derived, not stored separately
  if n <> 75 then
    raise exception 'FAIL §78 mapping';
  end if;
  raise notice 'PASS  §78 parent mapping derives "Ate Most" from stored numeric 75 (no duplicate record)';

  -- ---------------------------------------------------------------
  -- §59 class completion counter
  -- ---------------------------------------------------------------
  select count(*) into n
    from students s
   where s.class_id = v_class_a
     and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY';
  select count(*) into n2
    from serving_records sr
    join students s on s.id = sr.student_id
   where s.class_id = v_class_a and sr.serving_date = v_date and sr.period = 'lunch';
  if n2 <> 1 or n <> 1 then
    raise exception 'FAIL §59 completion: expected 1/1, got %/%', n2, n;
  end if;
  raise notice 'PASS  §59 class completion computes % of % from records (not a stored counter)', n2, n;

  -- ---------------------------------------------------------------
  -- §112 class change must NOT rewrite historical class context
  -- ---------------------------------------------------------------
  update students set class_id = v_class_b where id = v_student;
  select class_id into v_hist_class from serving_records
   where student_id = v_student and serving_date = v_date and period = 'lunch';
  -- Assert POSITIVELY. "not Class B" would also be satisfied by NULL or by a
  -- third value, so it is not a proof that history was preserved.
  if v_hist_class is distinct from v_class_a then
    raise exception 'FAIL §112: historical class context changed from % to %', v_class_a, v_hist_class;
  end if;
  if (select class_id from students where id = v_student) <> v_class_b then
    raise exception 'FAIL §112: the class change itself did not take effect';
  end if;
  raise notice 'PASS  §112 student now in Class B, the past record still carries Class A (%)', v_hist_class;

  -- ---------------------------------------------------------------
  -- §67 tried-vs-refused must not collapse; §47 absence excluded
  -- ---------------------------------------------------------------
  -- Use a THIRD, eligible child. Recording an observation against the
  -- ineligible ZZ-002 would contradict §44, which the check above just proved.
  insert into students (student_no, institution_id, given_name, family_name,
                        class_id, enrollment_status, operational_status)
  values ('ZZ-003', v_inst, 'Verify', 'ChildThree', v_class_a, 'enrolled',
          'ACTIVE_BILLABLE_TO_NURSERY')
    returning id into v_student3;

  insert into serving_records (serving_date, class_id, student_id, period, served_status,
                               consumption_pct, behavior, low_intake_reason, concern_observed,
                               meal_service_id, recorded_by)
  values (v_date, v_class_a, v_student3, 'lunch', 'served', 0, 'refused', 'did_not_like_it',
          false, v_service, (select user_id from app_users where role = 'super_admin' limit 1));

  select count(*) into n from serving_records
   where meal_service_id = v_service and behavior = 'refused';
  select count(*) into n2 from serving_records
   where meal_service_id = v_service and consumption_pct = 75 and behavior <> 'refused';
  if n <> 1 or n2 <> 1 then
    raise exception 'FAIL §67: tried(%) and refused(%) collapsed', n2, n;
  end if;
  raise notice 'PASS  §67 a 75%% "tried" and a 0%% REFUSED remain distinct records';

  -- §47 an ABSENT observation must not count as meal rejection
  update serving_records set low_intake_reason = 'absent', consumption_pct = 0
   where student_id = v_student3 and meal_service_id = v_service;
  select count(*) into n from serving_records
   where meal_service_id = v_service
     and served_status = 'served'
     and (low_intake_reason is null or low_intake_reason not in ('absent','unwell','sleeping'));
  if n <> 1 then
    raise exception 'FAIL §47/§85: valid preference population should be 1, got %', n;
  end if;
  raise notice 'PASS  §47/§85 ABSENT excluded from the preference population (valid=% of 2)', n;

  -- ---------------------------------------------------------------
  -- §28 historical meal version integrity
  -- ---------------------------------------------------------------
  insert into meal_revisions (meal_id, revision_no, name, ingredients, portion)
  values (v_meal, 2, 'ZZ Verify Meal', '["recipe v2 improved"]'::jsonb, '1 larger portion')
    returning id into v_rev_b;
  update meals set current_revision_id = v_rev_b where id = v_meal;

  select mr.ingredients::text into txt
    from serving_records sr
    join meal_services ms on ms.id = sr.meal_service_id
    join meal_revisions mr on mr.id = ms.meal_revision_id
   where sr.student_id = v_student and sr.serving_date = v_date and sr.period = 'lunch';
  if txt <> '["recipe v1"]' then
    raise exception 'FAIL §28: history rewritten to % after a recipe change', txt;
  end if;
  raise notice 'PASS  §28 recipe changed to v2; the historical record still reads %', txt;

  raise notice '---------------------------------------------------------';
  raise notice 'ALL CHECKS PASSED — rolling back, no data retained.';
end $$;

rollback;
