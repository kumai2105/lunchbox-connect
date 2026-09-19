-- =====================================================================
-- §16/§17 MULTI-STAFF PER CLASS — class_staff drives classroom scope.
-- One transaction, ROLLBACK. Nothing persists.
-- =====================================================================
begin;
do $$
declare v_inst uuid; v_other uuid; v_cls uuid; v_a uuid; v_b uuid; v_out uuid; v_student uuid; n int;
begin
  insert into institutions (name,kind) values ('ZZ CS Nursery','nursery') returning id into v_inst;
  insert into institutions (name,kind) values ('ZZ CS Other','nursery') returning id into v_other;
  insert into auth.users (email) values ('csA@t.test') returning id into v_a;
  insert into auth.users (email) values ('csB@t.test') returning id into v_b;
  insert into auth.users (email) values ('csOut@t.test') returning id into v_out;
  insert into app_users (user_id,role,full_name,email,institution_id) values
    (v_a,'classroom_staff','A','csA@t.test',v_inst),
    (v_b,'classroom_staff','B','csB@t.test',v_inst),
    (v_out,'classroom_staff','Out','csOut@t.test',v_other);
  insert into classes (institution_id,name,grade) values (v_inst,'CS Class','T') returning id into v_cls;
  insert into students (student_no,institution_id,given_name,family_name,class_id,enrollment_status,operational_status)
    values ('CS-1',v_inst,'K','CS',v_cls,'enrolled','ACTIVE_BILLABLE_TO_NURSERY') returning id into v_student;
  insert into class_staff (class_id,user_id) values (v_cls,v_a),(v_cls,v_b);

  perform set_config('request.jwt.claims', json_build_object('sub',v_a,'role','authenticated')::text, true);
  set local role authenticated; select count(*) into n from students where id=v_student; reset role;
  if n<>1 then raise exception 'FAIL staff A cannot see shared-class student'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',v_b,'role','authenticated')::text, true);
  set local role authenticated; select count(*) into n from students where id=v_student; reset role;
  if n<>1 then raise exception 'FAIL staff B cannot see shared-class student'; end if;
  raise notice 'PASS §16 both assigned staff see the student';

  perform set_config('request.jwt.claims', json_build_object('sub',v_out,'role','authenticated')::text, true);
  set local role authenticated; select count(*) into n from students where id=v_student; reset role;
  if n<>0 then raise exception 'FAIL unassigned staff saw the student (%)', n; end if;
  raise notice 'PASS §16 unassigned staff sees 0';

  -- recording scope follows class_staff too
  perform set_config('request.jwt.claims', json_build_object('sub',v_a,'role','authenticated')::text, true);
  set local role authenticated;
  if not app_can_record_in_class(v_cls) then raise exception 'FAIL staff A cannot record in their class'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',v_out,'role','authenticated')::text, true);
  set local role authenticated;
  if app_can_record_in_class(v_cls) then raise exception 'FAIL unassigned staff can record'; end if;
  reset role;
  raise notice 'PASS §16 recording scope follows class_staff membership';

  raise notice '---------------------------------------------------------';
  raise notice 'CLASS STAFF: multi-staff class scope verified.';
end $$;
rollback;
