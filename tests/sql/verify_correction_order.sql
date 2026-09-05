-- =====================================================================
-- Correction-order integrity (items 1, 6, 7). One transaction, ROLLBACK.
--
-- Item 1 — a SERVED classroom observation must be tied to a published Meal
--          Service. record_serving_batch resolves it and refuses consumption
--          when nothing is published; the table constraint is the backstop.
-- Item 6 — Institution kind is nursery|school only; new 'other' is refused.
-- Item 7 — student_no is optional (canonical minimum = names + institution).
-- =====================================================================
begin;
do $$
declare
  v_super uuid := '00000000-0000-0000-0000-0000000000a1';
  v_inst uuid; v_cls uuid; v_staff uuid; v_student uuid;
  v_rev uuid; v_meal uuid; v_service uuid; n int; v_link uuid;
  v_inst2 uuid; v_service2 uuid; v_clsB uuid; v_studentB uuid;
begin
  -- ---- fixture -------------------------------------------------------------
  insert into institutions (name, kind) values ('ZZ CO Nursery','nursery') returning id into v_inst;
  insert into auth.users (email) values ('co.staff@t.test') returning id into v_staff;
  insert into app_users (user_id, role, full_name, email, institution_id)
    values (v_staff, 'classroom_staff', 'CO Staff', 'co.staff@t.test', v_inst);
  insert into classes (institution_id, name, grade) values (v_inst,'CO Class','T') returning id into v_cls;
  insert into students (student_no, institution_id, given_name, family_name, class_id,
                        enrollment_status, operational_status)
    values ('CO-1', v_inst,'Kid','CO', v_cls,'enrolled','ACTIVE_BILLABLE_TO_NURSERY')
    returning id into v_student;
  insert into class_staff (class_id, user_id) values (v_cls, v_staff);

  insert into meals (name) values ('CO Meal') returning id into v_meal;
  insert into meal_revisions (meal_id, revision_no, name)
    values (v_meal, 1, 'CO Meal') returning id into v_rev;
  -- ONE published service today: LUNCH only. Breakfast is deliberately absent.
  insert into meal_services (institution_id, service_date, period, meal_revision_id, published)
    values (v_inst, app_operational_date(), 'lunch', v_rev, true) returning id into v_service;

  -- ---- item 1: served LUNCH with no service id auto-resolves the link ------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role','authenticated')::text, true);
  set local role authenticated;
  perform record_serving_batch(
    v_cls,
    jsonb_build_array(jsonb_build_object(
      'student_id', v_student, 'period','lunch',
      'served_status','served','consumption_pct','100')),
    app_operational_date());
  reset role;

  select meal_service_id into v_link from serving_records
   where student_id = v_student and serving_date = app_operational_date() and period = 'lunch';
  if v_link is distinct from v_service then
    raise exception 'FAIL item1: served lunch did not resolve to the published service (% vs %)', v_link, v_service;
  end if;
  raise notice 'PASS item1: a served meal auto-links to the published Meal Service';

  -- ---- item 1: served BREAKFAST (nothing published) is REFUSED -------------
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(
      v_cls,
      jsonb_build_array(jsonb_build_object(
        'student_id', v_student, 'period','breakfast',
        'served_status','served','consumption_pct','50')),
      app_operational_date());
    reset role;
    raise exception 'FAIL item1: served breakfast was recorded with NO published Meal Service';
  exception when check_violation then
    reset role;
    raise notice 'PASS item1: recording a served meal with nothing published is refused';
  end;

  -- ---- NOT_SERVED also requires an applicable published service ------------
  -- Previously not-served was an escape valve that needed no Meal Service, so
  -- an authorized RPC call could create a disconnected observation for a
  -- period the institution never published — distorting completion/reporting.
  -- A period with nothing published is simply NOT an applicable service, so no
  -- record of any served_status may be created for it.
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(
      v_cls,
      jsonb_build_array(jsonb_build_object(
        'student_id', v_student, 'period','breakfast',
        'served_status','not_served')),
      app_operational_date());
    reset role;
    raise exception 'FAIL: a NOT_SERVED record was created for a period with nothing published';
  exception when check_violation then
    reset role;
    raise notice 'PASS: not-served ALSO requires an applicable published Meal Service';
  end;
  select count(*) into n from serving_records
   where student_id = v_student and period = 'breakfast';
  if n <> 0 then raise exception 'FAIL: a disconnected breakfast observation was persisted (%)', n; end if;
  raise notice 'PASS: no disconnected observation was persisted for the unpublished period';

  -- ...but the SAME not-served outcome records fine for an APPLICABLE period
  -- (lunch is published), so absence/unwell/asleep is still recordable.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role','authenticated')::text, true);
  set local role authenticated;
  perform record_serving_batch(
    v_cls,
    jsonb_build_array(jsonb_build_object(
      'student_id', v_student, 'period','lunch',
      'served_status','not_served')),
    app_operational_date());
  reset role;
  select count(*) into n from serving_records
   where student_id = v_student and period = 'lunch'
     and served_status = 'not_served' and meal_service_id = v_service;
  if n <> 1 then raise exception 'FAIL: not-served on an applicable published period was refused'; end if;
  raise notice 'PASS: not-served on an APPLICABLE period records and anchors to its service';

  -- ---- item 1 backstop: direct served+null insert hits the constraint ------
  begin
    insert into serving_records (serving_date, class_id, student_id, period, served_status,
                                 consumption_pct, meal_service_id, recorded_by)
      values (app_operational_date(), v_cls, v_student, 'snack', 'served', 75, null, v_super);
    raise exception 'FAIL item1: constraint let a served row through with a NULL service';
  exception when check_violation then
    raise notice 'PASS item1: table constraint refuses a served row with no Meal Service link';
  end;

  -- ---- item 6: new institution kind must be nursery|school -----------------
  begin
    insert into institutions (name, kind) values ('ZZ CO Other','other');
    raise exception 'FAIL item6: a new institution with kind=other was accepted';
  exception when check_violation then
    raise notice 'PASS item6: kind=other is refused for new institutions';
  end;
  insert into institutions (name, kind) values ('ZZ CO School','school');
  insert into institutions (name, kind) values ('ZZ CO Nursery 2','nursery');
  raise notice 'PASS item6: nursery and school are both accepted';

  -- ---- item 7: student_no is optional (two nulls do not collide) -----------
  insert into students (institution_id, given_name, family_name, operational_status)
    values (v_inst,'No','Number1','ACTIVE_BILLABLE_TO_NURSERY');
  insert into students (institution_id, given_name, family_name, operational_status)
    values (v_inst,'No','Number2','ACTIVE_BILLABLE_TO_NURSERY');
  select count(*) into n from students where institution_id = v_inst and student_no is null;
  if n <> 2 then raise exception 'FAIL item7: could not create students without a student_no (%)', n; end if;
  raise notice 'PASS item7: student_no is optional; two number-less students coexist';

  -- ---- item 3: the RPC rejects a Meal Service that doesn't match -----------
  -- (a) wrong period: hand the published LUNCH service to a BREAKFAST row.
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(
      v_cls,
      jsonb_build_array(jsonb_build_object(
        'student_id', v_student, 'period','breakfast',
        'served_status','served','consumption_pct','100',
        'meal_service_id', v_service)),   -- lunch service used for breakfast
      app_operational_date());
    reset role;
    raise exception 'FAIL item3: a Meal Service from the wrong PERIOD was accepted';
  exception when check_violation then
    reset role;
    raise notice 'PASS item3: a Meal Service from the wrong period is rejected';
  end;

  -- (b) foreign institution: a service published at ANOTHER institution.
  insert into institutions (name, kind) values ('ZZ CO Foreign','nursery') returning id into v_inst2;
  insert into meal_services (institution_id, service_date, period, meal_revision_id, published)
    values (v_inst2, app_operational_date(), 'lunch', v_rev, true) returning id into v_service2;
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(
      v_cls,
      jsonb_build_array(jsonb_build_object(
        'student_id', v_student, 'period','lunch',
        'served_status','served','consumption_pct','100',
        'meal_service_id', v_service2)),  -- another institution's service
      app_operational_date());
    reset role;
    raise exception 'FAIL item3: a foreign-institution Meal Service was accepted';
  exception when check_violation then
    reset role;
    raise notice 'PASS item3: a foreign-institution Meal Service is rejected';
  end;

  -- ---- item 4: the RPC rejects recording a student under the wrong class ---
  -- Staff is assigned to two classes; a Class B student may not be recorded
  -- using Class A as the class id, even though the staff can reach both.
  insert into classes (institution_id, name, grade) values (v_inst,'CO Class B','T')
    returning id into v_clsB;
  insert into students (student_no, institution_id, given_name, family_name, class_id,
                        enrollment_status, operational_status)
    values ('CO-B', v_inst,'Kid','B', v_clsB,'enrolled','ACTIVE_BILLABLE_TO_NURSERY')
    returning id into v_studentB;
  insert into class_staff (class_id, user_id) values (v_clsB, v_staff);
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(
      v_cls,   -- Class A
      jsonb_build_array(jsonb_build_object(
        'student_id', v_studentB, 'period','lunch',   -- but a Class B student
        'served_status','served','consumption_pct','100',
        'meal_service_id', v_service)),
      app_operational_date());
    reset role;
    raise exception 'FAIL item4: a Class B student was recorded under Class A';
  exception when check_violation then
    reset role;
    raise notice 'PASS item4: a student cannot be recorded under a class they are not in';
  end;

  raise notice '---------------------------------------------------------';
  raise notice 'CORRECTION ORDER (items 1/3/4/6/7): integrity verified.';
end $$;
rollback;
