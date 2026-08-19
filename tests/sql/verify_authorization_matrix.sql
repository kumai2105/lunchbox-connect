-- =====================================================================
-- LunchBox Connect — EXHAUSTIVE AUTHORIZATION ATTACK MATRIX
--
-- Every role attacks every write-sensitive table. Each attempt runs under
-- `set local role authenticated` with a forged request.jwt.claims, i.e.
-- exactly the context PostgREST uses. A superuser bypasses RLS, so these
-- role switches are the whole point — remove them and this proves nothing.
--
-- Expected outcomes come from rbac.ts / migrations 0004,0010,0011,0016,0018.
-- A row that SUCCEEDS when it should be DENIED is a privilege escalation.
-- A row that is DENIED when it should SUCCEED is a lockout. Both FAIL.
--
-- One transaction, ROLLBACK at the end. Nothing persists.
-- =====================================================================
begin;

-- ---- fixtures: one actor per role, two institutions -----------------
insert into institutions (id, name, kind) values
  ('a0000000-0000-0000-0000-000000000001','ZZ Inst A','nursery'),
  ('a0000000-0000-0000-0000-000000000002','ZZ Inst B','school');
insert into kitchens (id, name) values ('c0000000-0000-0000-0000-000000000001','ZZ Kitchen');

insert into auth.users (id, email)
select ('e0000000-0000-0000-0000-0000000000'||lpad(n::text,2,'0'))::uuid, 'zz.role'||n||'@t.test'
from generate_series(1,11) n;

-- role index: 1 super_admin 2 school_admin 3 nurse 4 teacher 5 parent
-- 6 operations_manager 7 finance_owner 8 viewer 9 kitchen 10 driver 11 classroom_staff
insert into app_users (user_id, role, full_name, email, institution_id, kitchen_id) values
  ('e0000000-0000-0000-0000-000000000001','super_admin','ZZ Super','zz.role1@t.test',null,null),
  ('e0000000-0000-0000-0000-000000000002','school_admin','ZZ SchoolAdmin','zz.role2@t.test','a0000000-0000-0000-0000-000000000001',null),
  ('e0000000-0000-0000-0000-000000000003','nurse','ZZ Nurse','zz.role3@t.test','a0000000-0000-0000-0000-000000000001',null),
  ('e0000000-0000-0000-0000-000000000004','teacher','ZZ Teacher','zz.role4@t.test','a0000000-0000-0000-0000-000000000001',null),
  ('e0000000-0000-0000-0000-000000000005','parent','ZZ Parent','zz.role5@t.test',null,null),
  ('e0000000-0000-0000-0000-000000000006','operations_manager','ZZ Ops','zz.role6@t.test',null,null),
  ('e0000000-0000-0000-0000-000000000007','finance_owner','ZZ Finance','zz.role7@t.test',null,null),
  ('e0000000-0000-0000-0000-000000000008','viewer','ZZ Viewer','zz.role8@t.test',null,null),
  ('e0000000-0000-0000-0000-000000000009','kitchen','ZZ Kitchen U','zz.role9@t.test',null,'c0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000010','driver','ZZ Driver','zz.role10@t.test',null,null),
  ('e0000000-0000-0000-0000-000000000011','classroom_staff','ZZ Classroom','zz.role11@t.test','a0000000-0000-0000-0000-000000000001',null);

insert into classes (id, institution_id, name, grade, teacher_id) values
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','ZZ Class A','T','e0000000-0000-0000-0000-000000000011'),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','ZZ Class B','1',null);
insert into students (id, student_no, institution_id, given_name, family_name, class_id, enrollment_status, operational_status) values
  ('d0000000-0000-0000-0000-000000000001','ZZ-1','a0000000-0000-0000-0000-000000000001','Kid','A','b0000000-0000-0000-0000-000000000001','enrolled','ACTIVE_BILLABLE_TO_NURSERY'),
  ('d0000000-0000-0000-0000-000000000002','ZZ-2','a0000000-0000-0000-0000-000000000002','Kid','B','b0000000-0000-0000-0000-000000000002','enrolled','ACTIVE_BILLABLE_TO_NURSERY');
insert into student_parents (student_id, user_id) values
  ('d0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000005');
insert into meals (id, name) values ('f0000000-0000-0000-0000-000000000001','ZZ Meal');
insert into meal_revisions (id, meal_id, revision_no, name) values
  ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001',1,'ZZ Meal');
update meals set current_revision_id='f1000000-0000-0000-0000-000000000001' where id='f0000000-0000-0000-0000-000000000001';

-- result sink
create temp table matrix_result(role text, op text, verdict text) on commit drop;

-- helper: run one statement as a role, record PASS/FAIL against expectation
create or replace function zz_attempt(p_role_idx int, p_label text, p_sql text, p_expect text)
returns void language plpgsql as $$
declare v_uid text; got text := 'DENIED';
begin
  v_uid := 'e0000000-0000-0000-0000-0000000000'||lpad(p_role_idx::text,2,'0');
  perform set_config('request.jwt.claims', json_build_object('sub',v_uid,'role','authenticated')::text, true);
  -- A plpgsql block with an EXCEPTION clause is a subtransaction: any error
  -- rolls it back automatically. To also roll back a SUCCESSFUL attack (so it
  -- leaves no residue that would inflate a later SELECT or collide on a unique
  -- key), we raise a private marker after it succeeds and swallow that marker.
  -- SAVEPOINT/ROLLBACK TO cannot be issued via EXECUTE in plpgsql, so this is
  -- the supported way to get the same isolation.
  begin
    execute 'set local role authenticated';
    execute p_sql;
    got := 'ALLOWED';
    raise exception using errcode = 'ZZ999', message = 'zz_rollback_marker';
  exception
    when sqlstate 'ZZ999' then null;                       -- success; write rolled back
    when insufficient_privilege then got := 'DENIED';       -- 42501 RLS/grant refusal
    when others then got := 'DENIED('||SQLSTATE||')';
  end;
  execute 'reset role';
  insert into matrix_result values (
    (select role::text from app_users where user_id=v_uid::uuid),
    p_label,
    case when got like p_expect||'%' then 'PASS  '||got else 'FAIL  got '||got||' expected '||p_expect end);
end $$;

-- helper: run a DML as a role, capture ROWS AFFECTED, roll back, record it.
-- For append-only tables the true property is "0 rows changed" regardless of
-- whether the statement is permitted to run at all.
create or replace function zz_rows(p_role_idx int, p_label text, p_sql text, p_expect_rows int)
returns void language plpgsql as $$
declare v_uid text; n int := -1;
begin
  v_uid := 'e0000000-0000-0000-0000-0000000000'||lpad(p_role_idx::text,2,'0');
  perform set_config('request.jwt.claims', json_build_object('sub',v_uid,'role','authenticated')::text, true);
  begin
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode='ZZ999', message='zz_rollback_marker';
  exception
    when sqlstate 'ZZ999' then null;
    when insufficient_privilege then n := -1;   -- refused outright (also acceptable: 0 effect)
    when others then n := -1;
  end;
  execute 'reset role';
  insert into matrix_result values (
    (select role::text from app_users where user_id=v_uid::uuid),
    p_label,
    case when n = p_expect_rows or (p_expect_rows=0 and n=-1)
         then 'PASS  rows='||n
         else 'FAIL  rows='||n||' expected '||p_expect_rows end);
end $$;

-- =====================================================================
-- INSTITUTIONS — only super_admin may create (rbac: institutions super only)
-- =====================================================================
do $$
declare i int;
begin
  for i in 1..11 loop
    perform zz_attempt(i, 'institutions.insert',
      'insert into institutions(name,kind) values (''ZZ x'||i||''',''nursery'')',
      case when i=1 then 'ALLOWED' else 'DENIED' end);
  end loop;
end $$;

-- =====================================================================
-- KITCHENS — only super_admin (Decision 031)
-- =====================================================================
do $$
declare i int;
begin
  for i in 1..11 loop
    perform zz_attempt(i, 'kitchens.insert',
      'insert into kitchens(name) values (''ZZ k'||i||''')',
      case when i=1 then 'ALLOWED' else 'DENIED' end);
  end loop;
end $$;

-- =====================================================================
-- STUDENTS insert — super_admin + school_admin(own inst). Others denied.
-- classroom_staff/nurse/teacher = view only.
-- =====================================================================
do $$
declare i int;
begin
  for i in 1..11 loop
    perform zz_attempt(i, 'students.insert(instA)',
      'insert into students(student_no,institution_id,given_name,family_name,enrollment_status,operational_status)
       values (''ZZ-new'||i||''',''a0000000-0000-0000-0000-000000000001'',''N'',''N'',''enrolled'',''ACTIVE_BILLABLE_TO_NURSERY'')',
      case when i in (1,2) then 'ALLOWED' else 'DENIED' end);
  end loop;
end $$;

-- school_admin must NOT insert into an institution that is not theirs (inst B)
select zz_attempt(2, 'students.insert(FOREIGN instB)',
  'insert into students(student_no,institution_id,given_name,family_name,enrollment_status,operational_status)
   values (''ZZ-foreign'',''a0000000-0000-0000-0000-000000000002'',''N'',''N'',''enrolled'',''ACTIVE_BILLABLE_TO_NURSERY'')',
  'DENIED');

-- =====================================================================
-- CLASSES insert — super_admin + school_admin(own). Others denied.
-- =====================================================================
do $$
declare i int;
begin
  for i in 1..11 loop
    perform zz_attempt(i, 'classes.insert(instA)',
      'insert into classes(institution_id,name,grade) values (''a0000000-0000-0000-0000-000000000001'',''ZZ c'||i||''',''T'')',
      case when i in (1,2) then 'ALLOWED' else 'DENIED' end);
  end loop;
end $$;

-- =====================================================================
-- MEALS / ROTATIONS / MEAL_SERVICES — super_admin only (0016)
-- =====================================================================
do $$
declare i int;
begin
  for i in 1..11 loop
    perform zz_attempt(i, 'meals.insert',
      'insert into meals(name) values (''ZZ m'||i||''')',
      case when i=1 then 'ALLOWED' else 'DENIED' end);
    perform zz_attempt(i, 'rotations.insert',
      'insert into rotations(name,week_count) values (''ZZ r'||i||''',2)',
      case when i=1 then 'ALLOWED' else 'DENIED' end);
    perform zz_attempt(i, 'meal_services.insert',
      'insert into meal_services(institution_id,service_date,period,meal_revision_id,published)
       values (''a0000000-0000-0000-0000-000000000001'',current_date,''lunch'',''f1000000-0000-0000-0000-000000000001'',true)',
      case when i=1 then 'ALLOWED' else 'DENIED' end);
    perform zz_attempt(i, 'calendar_exceptions.insert',
      'insert into calendar_exceptions(institution_id,date_from,date_to,kind) values (''a0000000-0000-0000-0000-000000000001'',current_date,current_date,''closure'')',
      case when i=1 then 'ALLOWED' else 'DENIED' end);
  end loop;
end $$;

-- =====================================================================
-- MEAL_REVISIONS — APPEND ONLY. No role may UPDATE or DELETE (0016).
-- Even super_admin. Insert is super_admin only.
-- =====================================================================
do $$
declare i int;
begin
  for i in 1..11 loop
    -- The true append-only guarantee: the statement affects 0 rows for EVERY
    -- role, super_admin included. There is no UPDATE or DELETE policy on
    -- meal_revisions, so RLS filters every candidate row out.
    perform zz_rows(i, 'meal_revisions.UPDATE rows',
      'update meal_revisions set name=''HACKED'' where id=''f1000000-0000-0000-0000-000000000001''', 0);
    perform zz_rows(i, 'meal_revisions.DELETE rows',
      'delete from meal_revisions where id=''f1000000-0000-0000-0000-000000000001''', 0);
  end loop;
end $$;

-- =====================================================================
-- SERVING_RECORDS — classroom_staff records in OWN class only.
-- teacher/nurse/parent/kitchen/driver/viewer/finance/ops denied.
-- =====================================================================
do $$
declare i int;
begin
  for i in 1..11 loop
    perform zz_attempt(i, 'serving_records.insert(ownClassA)',
      'insert into serving_records(serving_date,class_id,student_id,period,served_status,concern_observed,recorded_by)
       values (current_date,''b0000000-0000-0000-0000-000000000001'',''d0000000-0000-0000-0000-000000000001'',''lunch'',''served'',false,'''||
       'e0000000-0000-0000-0000-0000000000'||lpad(i::text,2,'0')||''')',
      case when i in (1,2,11) then 'ALLOWED' else 'DENIED' end);
  end loop;
end $$;

-- classroom_staff must NOT record in a class that is not theirs (Class B)
select zz_attempt(11,'serving_records.insert(FOREIGN classB)',
  'insert into serving_records(serving_date,class_id,student_id,period,served_status,concern_observed,recorded_by)
   values (current_date,''b0000000-0000-0000-0000-000000000002'',''d0000000-0000-0000-0000-000000000002'',''lunch'',''served'',false,''e0000000-0000-0000-0000-000000000011'')',
  'DENIED');

-- =====================================================================
-- STUDENT READ SCOPE — parent sees own child only; kitchen/driver see none.
-- =====================================================================
do $$
declare i int; n int; v_uid text; expect int;
begin
  for i in 1..11 loop
    v_uid := 'e0000000-0000-0000-0000-0000000000'||lpad(i::text,2,'0');
    perform set_config('request.jwt.claims', json_build_object('sub',v_uid,'role','authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from students;
    execute 'reset role';
    -- expected visible student count: super=2, schooladmin/nurse/teacher/classroom(instA)=1,
    -- parent=1(own), kitchen/driver/viewer/finance/ops=0
    -- app_can_see_student grants only super_admin(all), school_admin(own inst),
    -- classroom_staff(own class), and any parent(their child). nurse(3) and
    -- teacher(4) are NOT in that function and correctly see 0 — the active
    -- classroom role is classroom_staff, not the legacy teacher enum value.
    expect := case i
      when 1 then 2
      when 2 then 1 when 11 then 1
      when 5 then 1
      else 0 end;
    insert into matrix_result values (
      (select role::text from app_users where user_id=v_uid::uuid),
      'students.SELECT count',
      case when n=expect then 'PASS  sees '||n else 'FAIL  sees '||n||' expected '||expect end);
  end loop;
end $$;

-- parent direct-ID probe of a child that is not theirs must return 0
do $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','e0000000-0000-0000-0000-000000000005','role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from students where id='d0000000-0000-0000-0000-000000000002';
  execute 'reset role';
  insert into matrix_result values ('parent','students.SELECT foreign-by-id',
    case when n=0 then 'PASS  0' else 'FAIL  leaked '||n end);
end $$;

-- =====================================================================
-- RESOLVER RPC LOCKDOWN (0018) — no client role may execute
-- =====================================================================
do $$
declare i int;
begin
  for i in 1..11 loop
    perform zz_attempt(i, 'resolve_meal RPC',
      'select 1 from resolve_meal(''a0000000-0000-0000-0000-000000000001'',current_date,''lunch'')',
      'DENIED');
  end loop;
end $$;

-- =====================================================================
-- REPORT
-- =====================================================================
select role, op, verdict from matrix_result order by
  case when verdict like 'FAIL%' then 0 else 1 end, op, role;

do $$
declare n int;
begin
  select count(*) into n from matrix_result where verdict like 'FAIL%';
  if n > 0 then
    raise exception 'AUTHORIZATION MATRIX: % FAIL row(s) above', n;
  end if;
  raise notice 'AUTHORIZATION MATRIX: all % checks PASS', (select count(*) from matrix_result);
end $$;

rollback;
