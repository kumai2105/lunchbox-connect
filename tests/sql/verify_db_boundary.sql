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
  v_cls2 uuid; v_staff2 uuid; b boolean; v_rot uuid;
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

  -- ITEM 4 — note PUBLICATION authority is NOT_YET_DEFINED. The invented
  -- School-Admin publish grant is removed: a School Admin must NOT be able to
  -- set published_at. RLS simply gives them no matching UPDATE policy, so the
  -- row is invisible to their update (0 rows affected, no error).
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  set local role authenticated;
  update serving_notes set published_at = now() where id = v_note;
  get diagnostics n = row_count;
  reset role;
  if n <> 0 then raise exception 'FAIL item4: School Admin was able to publish a note (% rows)', n; end if;
  raise notice 'PASS item4: School Admin cannot publish a note (authority NOT_YET_DEFINED)';

  -- The Super Admin system-wide override is the only publish path that remains.
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  update serving_notes set published_at = now() where id = v_note;
  get diagnostics n = row_count;
  reset role;
  if n <> 1 then raise exception 'FAIL item4: Super Admin override could not publish the note (% rows)', n; end if;
  raise notice 'PASS item4: only the Super Admin system-wide override can publish';

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

  -- =================================================================
  -- CORRECTION PASS — tenant-integrity + permission-correction triggers
  -- (pass items 1, 2, 3, 12). These fire on ALL paths, so they are proven
  -- here at the RAW table level, isolated from RLS. A cross-institution or
  -- wrong-role write must be refused even for a privileged writer.
  -- =================================================================
  -- A second class in the OTHER institution, and a classroom_staff there.
  insert into classes (institution_id, name, grade) values (v_inst2,'DB Class 2','T') returning id into v_cls2;
  insert into auth.users (email) values ('db.staff2@t.test') returning id into v_staff2;
  insert into app_users (user_id, role, full_name, email, institution_id) values
    (v_staff2,'classroom_staff','DB Staff2','db.staff2@t.test',v_inst2);

  -- c1 — a Student's Class must share the Student's institution (item 1).
  begin
    update students set class_id = v_cls2 where id = v_student;   -- cross-institution
    raise exception 'FAIL c1: a Student was assigned to a Class in another institution';
  exception when check_violation then
    raise notice 'PASS c1: Student cannot be assigned to a Class in another institution';
  end;
  update students set class_id = v_cls where id = v_student;      -- same institution
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL c1: a same-institution Class assignment was blocked'; end if;
  raise notice 'PASS c1: a same-institution Class assignment is allowed';

  -- c2 — a guardian link must reference a role=parent account (item 2).
  begin
    insert into student_parents (student_id, user_id) values (v_student, v_staff);  -- classroom_staff
    raise exception 'FAIL c2: a classroom_staff account was linked as a guardian';
  exception when check_violation then
    raise notice 'PASS c2: a non-parent (classroom_staff) cannot be a guardian';
  end;
  begin
    insert into student_parents (student_id, user_id) values (v_student, v_admin);  -- school_admin
    raise exception 'FAIL c2: a school_admin account was linked as a guardian';
  exception when check_violation then
    raise notice 'PASS c2: a non-parent (school_admin) cannot be a guardian';
  end;
  -- (the genuine parent link v_parent → v_student already succeeded above.)

  -- c2 defense-in-depth — even if a stray non-parent relationship existed, the
  -- visibility helper's guardian branch requires the caller to BE a parent.
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  select app_current_role() = 'parent' into b;
  reset role;
  if b then raise exception 'FAIL c2: classroom_staff resolved as parent role'; end if;
  raise notice 'PASS c2: the guardian visibility branch is parent-gated (defense in depth)';

  -- c3 — Nursery/School Admin classroom RECORDING is removed (item 3).
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  set local role authenticated;
  select app_can_record_in_class(v_cls) into b;
  if b then reset role; raise exception 'FAIL c3: School Admin can record in a class'; end if;
  select app_can_record_for_student(v_student) into b;
  reset role;
  if b then raise exception 'FAIL c3: School Admin can record for a student'; end if;
  raise notice 'PASS c3: School Admin cannot record (recording authority NOT_YET_DEFINED)';

  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  select app_can_record_in_class(v_cls) into b;
  reset role;
  if not b then raise exception 'FAIL c3: assigned Classroom Staff cannot record in their class'; end if;
  raise notice 'PASS c3: assigned Classroom Staff can still record';

  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  select app_can_record_in_class(v_cls) into b;
  reset role;
  if not b then raise exception 'FAIL c3: Super Admin override lost recording authority'; end if;
  raise notice 'PASS c3: Super Admin retains the approved recording override';

  -- c12 — class_staff must be a classroom_staff in the Class's institution (item 12).
  begin
    insert into class_staff (class_id, user_id) values (v_cls, v_admin);  -- school_admin, not classroom_staff
    raise exception 'FAIL c12: a school_admin was added as class_staff';
  exception when check_violation then
    raise notice 'PASS c12: a non-classroom_staff account cannot be class_staff';
  end;
  begin
    insert into class_staff (class_id, user_id) values (v_cls, v_staff2);  -- classroom_staff, other institution
    raise exception 'FAIL c12: a classroom_staff from another institution was added as class_staff';
  exception when check_violation then
    raise notice 'PASS c12: class_staff must share the Class institution';
  end;
  -- (the valid v_staff → v_cls membership already succeeded above.)
  raise notice 'PASS c12: a valid same-institution classroom_staff membership is allowed';

  -- =================================================================
  -- REFERENCED-SIDE INVARIANTS (0033 item 4).
  --
  -- 0032 guarded the RELATIONSHIP row. The invariant can still be broken
  -- from the other side: move the Class, or change the referenced account's
  -- role/institution, and existing rows silently become cross-tenant or
  -- role-invalid without their own trigger ever firing. These attacks mutate
  -- the REFERENCED row, and they must fail on EVERY path — they are integrity
  -- rules, not authorization, so they hold for the owner too.
  -- =================================================================
  -- r1 — moving a Class that still has Students assigned.
  begin
    update classes set institution_id = v_inst2 where id = v_cls;
    raise exception 'FAIL r1: a Class with assigned Students was moved to another institution';
  exception when check_violation then
    raise notice 'PASS r1: cannot move a Class that still has Students assigned';
  end;

  -- r2 — moving a Class that still has classroom staff assigned. (Detach the
  -- students first so the failure is attributable to the staff invariant.)
  update students set class_id = null where id = v_student;
  begin
    update classes set institution_id = v_inst2 where id = v_cls;
    raise exception 'FAIL r2: a Class with assigned classroom staff was moved to another institution';
  exception when check_violation then
    raise notice 'PASS r2: cannot move a Class that still has classroom staff assigned';
  end;
  update students set class_id = v_cls where id = v_student;   -- restore

  -- r3 — changing a classroom staff account's INSTITUTION while it still holds
  -- class_staff assignments in the old institution.
  begin
    update app_users set institution_id = v_inst2 where user_id = v_staff;
    raise exception 'FAIL r3: staff institution changed while class_staff assignments remained';
  exception when check_violation then
    raise notice 'PASS r3: cannot re-scope staff who still hold class_staff assignments';
  end;

  -- r4 — changing a classroom staff account's ROLE while assignments remain.
  begin
    update app_users set role = 'viewer' where user_id = v_staff;
    raise exception 'FAIL r4: staff role changed while class_staff assignments remained';
  exception when check_violation then
    raise notice 'PASS r4: cannot change the role of staff who still hold assignments';
  end;

  -- r5 — changing a Parent account away from parent while guardian links remain.
  begin
    update app_users set role = 'viewer' where user_id = v_parent;
    raise exception 'FAIL r5: a guardian account was moved off the parent role with links intact';
  exception when check_violation then
    raise notice 'PASS r5: cannot move a guardian off the parent role while links remain';
  end;

  -- r6 — the same changes SUCCEED once the relationships are removed first,
  -- so the invariant blocks orphaning, not legitimate administration.
  delete from class_staff where user_id = v_staff and class_id = v_cls;
  update app_users set role = 'viewer' where user_id = v_staff;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL r6: a legitimate role change was blocked after cleanup'; end if;
  raise notice 'PASS r6: the same change succeeds once the relationships are removed';
  -- restore the fixture for the checks below
  update app_users set role = 'classroom_staff' where user_id = v_staff;
  insert into class_staff (class_id, user_id) values (v_cls, v_staff);

  -- =================================================================
  -- CLIENT-BOUNDARY LOCKDOWN (0033 items 1, 5, 6, 7, 11) — raw path.
  -- =================================================================
  -- b1 — no client may escalate its own role/scope. (Parent shown here; the
  -- authorization matrix attacks this from all eleven roles.)
  perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
  set local role authenticated;
  update app_users set role = 'super_admin' where user_id = v_parent;
  get diagnostics n = row_count;
  reset role;
  if n <> 0 then raise exception 'FAIL b1: a Parent escalated its own role (% rows)', n; end if;
  raise notice 'PASS b1: a client cannot escalate its own role/scope';

  -- b1b — not even a Super Admin edits security identity through the API;
  -- provisioning is a server-side action (BLOCKED_BY_SPEC).
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
    set local role authenticated;
    update app_users set role = 'viewer' where user_id = v_parent;
    reset role;
    raise exception 'FAIL b1b: a Super Admin changed a role through the client API';
  exception when check_violation then
    reset role;
    raise notice 'PASS b1b: security identity is not client-editable for any role';
  end;

  -- b2 — a School Admin cannot create an ALREADY-ELIGIBLE Student, but can
  -- create the same Student without eligibility.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
    set local role authenticated;
    insert into students (student_no, institution_id, given_name, family_name, operational_status)
      values ('DB-ELIG', v_inst, 'Pre', 'Eligible', 'ACTIVE_BILLABLE_TO_NURSERY');
    reset role;
    raise exception 'FAIL b2: School Admin created an already-eligible Student';
  exception when check_violation then
    reset role;
    raise notice 'PASS b2: School Admin cannot create an already-eligible Student';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  set local role authenticated;
  insert into students (student_no, institution_id, given_name, family_name)
    values ('DB-OK', v_inst, 'Not', 'Eligible');
  get diagnostics n = row_count;
  reset role;
  if n <> 1 then raise exception 'FAIL b2: School Admin could not create an ordinary Student'; end if;
  raise notice 'PASS b2: School Admin can still create a Student with no eligibility';

  -- b3 — a School Admin cannot link or unlink a guardian on the raw path
  -- (the frontend already says BLOCKED_BY_SPEC; the database now agrees).
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
    set local role authenticated;
    insert into student_parents (student_id, user_id)
      values ((select id from students where student_no = 'DB-OK'), v_parent);
    reset role;
    raise exception 'FAIL b3: School Admin linked a guardian';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS b3: School Admin cannot link a guardian';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);
  set local role authenticated;
  delete from student_parents where student_id = v_student and user_id = v_parent;
  get diagnostics n = row_count;
  reset role;
  if n <> 0 then raise exception 'FAIL b3: School Admin unlinked a guardian (% rows)', n; end if;
  raise notice 'PASS b3: School Admin cannot unlink a guardian';

  -- b4 — no client hard-deletes core historical entities. The DELETE grant
  -- itself is withdrawn, so the attempt is refused outright rather than
  -- quietly matching zero rows — the stronger of the two outcomes.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
    set local role authenticated;
    delete from students where id = v_student;
    reset role;
    raise exception 'FAIL b4: a Student was hard-deleted';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS b4: a Student cannot be hard-deleted by a client';
  end;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
    set local role authenticated;
    delete from classes where id = v_cls;
    reset role;
    raise exception 'FAIL b4: a Class was hard-deleted';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS b4: a Class cannot be hard-deleted by a client';
  end;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
    set local role authenticated;
    delete from institutions where id = v_inst2;
    reset role;
    raise exception 'FAIL b4: an Institution was hard-deleted';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS b4: an Institution cannot be hard-deleted by a client';
  end;

  -- b5 — raw planning data is invisible to Parent and Classroom Staff.
  insert into institution_service_plans (institution_id, periods, effective_from)
    values (v_inst, array['lunch']::app_period[], app_operational_date() - 10);
  insert into calendar_exceptions (institution_id, date_from, date_to, kind)
    values (v_inst, app_operational_date() + 7, app_operational_date() + 7, 'closure');

  perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from institution_service_plans;
  if n <> 0 then reset role; raise exception 'FAIL b5: a Parent read raw Service Plans (%)', n; end if;
  select count(*) into n from calendar_exceptions;
  reset role;
  if n <> 0 then raise exception 'FAIL b5: a Parent read unmaterialised Calendar Exceptions (%)', n; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from institution_service_plans;
  if n <> 0 then reset role; raise exception 'FAIL b5: Classroom Staff read raw Service Plans (%)', n; end if;
  select count(*) into n from calendar_exceptions;
  reset role;
  if n <> 0 then raise exception 'FAIL b5: Classroom Staff read unmaterialised Calendar Exceptions (%)', n; end if;
  raise notice 'PASS b5: raw planning data is invisible to Parent and Classroom Staff';

  -- ...while the PUBLISHED service they legitimately need is still readable.
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from meal_services where id = v_service;
  reset role;
  if n <> 1 then raise exception 'FAIL b5: Classroom Staff lost sight of their published Meal Service (%)', n; end if;
  raise notice 'PASS b5: the published Meal Service is still readable downstream';

  -- b6 — meal_services is a controlled write path: no client table writes,
  -- while the approved Super Admin publish RPC still works.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
    set local role authenticated;
    update meal_services set published = false where id = v_service;
    reset role;
    raise exception 'FAIL b6: a Super Admin mutated meal_services directly';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS b6: direct client writes to meal_services are denied';
  end;

  -- An explicit 2-week Menu with a lunch slot, so publication has something to
  -- materialise and the anchor_week bound below is deterministic.
  insert into rotations (name, week_count, active) values ('DB Rotation', 2, true)
    returning id into v_rot;
  insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id)
    select v_rot, w, d, 'lunch', v_meal from generate_series(1,2) w, generate_series(0,6) d;
  insert into institution_rotation_assignments (institution_id, rotation_id, anchor_week, effective_from)
    values (v_inst, v_rot, 1, app_operational_date() - 10);
  insert into institution_service_plans (institution_id, periods, effective_from)
    values (v_inst, array['lunch']::app_period[], app_operational_date() - 9);
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  perform publish_meal_services(v_inst, app_operational_date() + 30, app_operational_date() + 32);
  reset role;
  raise notice 'PASS b6: the approved Super Admin publish RPC still materialises services';

  -- b7 — the legacy `menus` table is historical/read-only at the boundary.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
    set local role authenticated;
    insert into menus (week_number, weekday, period, dish_name) values (1, 0, 'lunch', 'DB legacy');
    reset role;
    raise exception 'FAIL b7: a client wrote to the LEGACY menus table';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS b7: the legacy menus table is read-only at the boundary';
  end;

  -- b8 — effective-dated planning is deterministic: one row per
  -- institution+effective date, and anchor_week must exist in the Menu.
  begin
    insert into institution_service_plans (institution_id, periods, effective_from)
      values (v_inst, array['breakfast']::app_period[], app_operational_date() - 10);
    raise exception 'FAIL b8: a second Service Plan for the same effective date was accepted';
  exception when unique_violation then
    raise notice 'PASS b8: one Service Plan per institution + effective date';
  end;
  begin
    insert into institution_rotation_assignments (institution_id, rotation_id, anchor_week, effective_from)
      values (v_inst, v_rot, 7, app_operational_date() - 20);   -- Menu has 2 weeks
    raise exception 'FAIL b8: an anchor_week beyond the Menu''s week_count was accepted';
  exception when check_violation then
    raise notice 'PASS b8: anchor_week cannot exceed the selected Menu''s week_count';
  end;
  -- ...and the invariant also holds from the REFERENCED side: shrinking the
  -- Menu must not strand an assignment anchored beyond its new length.
  update institution_rotation_assignments set anchor_week = 2
    where institution_id = v_inst and rotation_id = v_rot;
  begin
    update rotations set week_count = 1 where id = v_rot;
    raise exception 'FAIL b8: a Menu was shrunk below a live assignment''s anchor_week';
  exception when check_violation then
    raise notice 'PASS b8: a Menu cannot be shrunk below a live assignment''s anchor_week';
  end;

  raise notice '---------------------------------------------------------';
  raise notice 'DB BOUNDARY: raw-path integrity verified (0031/0032/0033 items).';
end $$;
rollback;
