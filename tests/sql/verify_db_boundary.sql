-- =====================================================================
-- DB-boundary integrity (items 1, 2, 3). Proves the checks hold on the RAW
-- table paths under an authenticated role, not only inside the RPC/UI.
-- One transaction, ROLLBACK.
-- =====================================================================
begin;
do $$
declare
  v_super uuid := '00000000-0000-0000-0000-0000000000a1';
  v_inst uuid; v_inst2 uuid; v_cls uuid; v_staff uuid; v_admin uuid; v_student uuid;
  v_rev uuid; v_meal uuid; v_service uuid; v_rec uuid; v_note uuid; n int;
  v_parent uuid; v_rev2 uuid;
begin
  insert into institutions (name, kind) values ('ZZ DB Nursery','nursery') returning id into v_inst;
  insert into institutions (name, kind) values ('ZZ DB Other','nursery') returning id into v_inst2;
  insert into auth.users (email) values ('db.staff@t.test') returning id into v_staff;
  insert into auth.users (email) values ('db.admin@t.test') returning id into v_admin;
  insert into app_users (user_id, role, full_name, email, institution_id) values
    (v_staff,'classroom_staff','DB Staff','db.staff@t.test',v_inst),
    (v_admin,'school_admin','DB Admin','db.admin@t.test',v_inst);
  insert into classes (institution_id, name, grade) values (v_inst,'DB Class','T') returning id into v_cls;
  insert into students (student_no, institution_id, given_name, family_name, class_id, operational_status)
    values ('DB-1', v_inst,'Kid','DB', v_cls,'ACTIVE_BILLABLE_TO_NURSERY') returning id into v_student;
  insert into class_staff (class_id, user_id) values (v_cls, v_staff);
  insert into meals (name) values ('DB Meal') returning id into v_meal;
  insert into meal_revisions (meal_id, revision_no, name) values (v_meal,1,'DB Meal') returning id into v_rev;
  insert into meal_services (institution_id, service_date, period, meal_revision_id, published)
    values (v_inst, app_operational_date(), 'lunch', v_rev, true) returning id into v_service;

  -- =================================================================
  -- ITEM 1 — raw serving_records writes are impossible for authenticated;
  -- record_serving_batch is the only path.
  -- =================================================================
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    insert into serving_records (serving_date, class_id, student_id, period, served_status,
                                 meal_service_id, recorded_by)
      values (app_operational_date(), v_cls, v_student, 'lunch','served', v_service, v_staff);
    reset role;
    raise exception 'FAIL item1: a raw INSERT into serving_records was allowed for an authenticated client';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS item1: raw serving_records INSERT is denied (RPC is the only write path)';
  end;

  -- The RPC path works for the authorized staff and stamps recorded_by itself.
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  select out_id into v_rec from record_serving_batch(
    v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','consumption_pct','100')),
    app_operational_date());
  reset role;
  select count(*) into n from serving_records where id = v_rec and recorded_by = v_staff;
  if n <> 1 then raise exception 'FAIL item1: RPC did not record with server-stamped recorded_by'; end if;
  raise notice 'PASS item1: the RPC records and stamps recorded_by = the caller';

  -- =================================================================
  -- ITEM 2 — Classroom Staff cannot publish a note; the review authority can.
  -- =================================================================
  -- Staff creates an INTERNAL (unpublished) note (allowed).
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  insert into serving_notes (serving_record_id, body) values (v_rec, 'internal draft') returning id into v_note;
  reset role;

  -- Staff attempts to PUBLISH it via a raw UPDATE → refused by RLS.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    update serving_notes set published_at = now() where id = v_note;
    reset role;
    raise exception 'FAIL item2: Classroom Staff published their own note';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS item2: Classroom Staff cannot set published_at';
  end;

  -- The School Admin (review authority) publishes it.
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  set local role authenticated;
  update serving_notes set published_at = now() where id = v_note;
  get diagnostics n = row_count;
  reset role;
  if n <> 1 then raise exception 'FAIL item2: School Admin could not publish the note (% rows)', n; end if;
  raise notice 'PASS item2: the School Admin review authority can publish';

  -- Staff cannot silently alter the now-published note (RLS hides it from update).
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  update serving_notes set body = 'tampered' where id = v_note;
  get diagnostics n = row_count;
  reset role;
  if n <> 0 then raise exception 'FAIL item2: Classroom Staff altered an already-published note'; end if;
  raise notice 'PASS item2: Classroom Staff cannot alter a published family note';

  -- =================================================================
  -- ITEM 3 — eligibility + tenant identity are Super-Admin-only.
  -- =================================================================
  -- (a) School Admin cannot change operational_status.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
    set local role authenticated;
    update students set operational_status = null where id = v_student;
    reset role;
    raise exception 'FAIL item3: School Admin changed operational_status directly';
  exception when check_violation then
    reset role;
    raise notice 'PASS item3: School Admin cannot change operational_status';
  end;

  -- (b) School Admin cannot move a Student to another institution.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
    set local role authenticated;
    update students set institution_id = v_inst2 where id = v_student;
    reset role;
    raise exception 'FAIL item3: School Admin moved a Student to another institution';
  exception when check_violation then
    reset role;
    raise notice 'PASS item3: School Admin cannot move a Student to another institution';
  end;

  -- (c) School Admin cannot move a Class to another institution.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
    set local role authenticated;
    update classes set institution_id = v_inst2 where id = v_cls;
    reset role;
    raise exception 'FAIL item3: School Admin moved a Class to another institution';
  exception when check_violation then
    reset role;
    raise notice 'PASS item3: School Admin cannot move a Class to another institution';
  end;

  -- (d) A within-institution edit by the School Admin still works.
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  set local role authenticated;
  update students set given_name = 'Renamed' where id = v_student;
  get diagnostics n = row_count;
  reset role;
  if n <> 1 then raise exception 'FAIL item3: a legitimate within-institution Student edit was blocked'; end if;
  raise notice 'PASS item3: within-institution Student edits still work';

  -- (e) The Super Admin CAN change operational_status (the Status screen path).
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  update students set operational_status = null where id = v_student;
  get diagnostics n = row_count;
  reset role;
  if n <> 1 then raise exception 'FAIL item3: Super Admin could not change operational_status'; end if;
  raise notice 'PASS item3: Super Admin can change operational_status';

  -- =================================================================
  -- ITEM 6 — meal-image storage follows published-meal visibility.
  -- =================================================================
  -- The published lunch service's revision gets image imgA; a second,
  -- library-only revision (no published service) has image imgB.
  update meal_revisions set image_path = 'imgA.jpg' where id = v_rev;
  insert into meal_revisions (meal_id, revision_no, name, image_path)
    values (v_meal, 2, 'DB Meal v2', 'imgB.jpg') returning id into v_rev2;
  insert into storage.buckets (id, name, public) values ('meal-images','meal-images',false)
    on conflict do nothing;
  insert into storage.objects (bucket_id, name) values
    ('meal-images','imgA.jpg'), ('meal-images','imgB.jpg');
  -- A parent of the child in this institution.
  insert into auth.users (email) values ('db.parent@t.test') returning id into v_parent;
  insert into app_users (user_id, role, full_name, email) values
    (v_parent,'parent','DB Parent','db.parent@t.test');
  insert into student_parents (student_id, user_id) values (v_student, v_parent);

  perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id='meal-images' and name='imgA.jpg';
  if n <> 1 then reset role; raise exception 'FAIL item6: parent cannot see the image of a meal published to them (%)', n; end if;
  select count(*) into n from storage.objects where bucket_id='meal-images' and name='imgB.jpg';
  reset role;
  if n <> 0 then raise exception 'FAIL item6: parent could read an unrelated UNPUBLISHED meal image (%)', n; end if;
  raise notice 'PASS item6: a Parent sees only meal images from services published to them';

  -- Super Admin sees the whole library.
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id='meal-images';
  reset role;
  if n <> 2 then raise exception 'FAIL item6: Super Admin cannot read the full meal-image library (%)', n; end if;
  raise notice 'PASS item6: Super Admin can read the whole meal-image library';

  raise notice '---------------------------------------------------------';
  raise notice 'DB BOUNDARY: raw-path integrity verified (items 1/2/3/6).';
end $$;
rollback;
