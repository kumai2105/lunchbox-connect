-- =====================================================================
-- verify_insert_returning — creating a Class or a Student must work
-- THROUGH THE CLIENT'S ACTUAL STATEMENT, which is INSERT ... RETURNING.
--
-- Every other suite here writes with a plain INSERT, so for the whole life
-- of this project the create paths were verified with a statement the
-- application never issues. supabase-js's `.insert(x).select().single()`
-- becomes INSERT ... RETURNING, and PostgreSQL applies the SELECT policy to
-- the new row for RETURNING — which a policy that re-reads its own table by
-- id can never satisfy, because the row is not visible yet.
--
-- These assertions therefore use RETURNING deliberately, and they also pin
-- the negative: no role gains sight of a row it could not see before.
-- =====================================================================
do $$
declare
  v_inst       uuid;
  v_inst_other uuid;
  v_class      uuid;
  v_student    uuid;
  v_sa         uuid := '00000000-0000-0000-0000-00000000f001';  -- super admin
  v_na         uuid := '00000000-0000-0000-0000-00000000f002';  -- nursery admin, v_inst
  v_na_other   uuid := '00000000-0000-0000-0000-00000000f003';  -- nursery admin, v_inst_other
  v_seen       int;
begin
  -- ---- actors and tenants -------------------------------------------------
  insert into institutions (name, kind) values ('IR Institution A', 'nursery')
    on conflict (name) do nothing;
  insert into institutions (name, kind) values ('IR Institution B', 'school')
    on conflict (name) do nothing;
  select id into v_inst       from institutions where name = 'IR Institution A';
  select id into v_inst_other from institutions where name = 'IR Institution B';

  insert into auth.users (id, email) values
    (v_sa, 'ir.super@zz.test'), (v_na, 'ir.na@zz.test'), (v_na_other, 'ir.na2@zz.test')
    on conflict (id) do nothing;
  insert into app_users (user_id, role, institution_id, full_name, email) values
    (v_sa,       'super_admin',  null,         'IR Super',  'ir.super@zz.test'),
    (v_na,       'school_admin', v_inst,       'IR NA',     'ir.na@zz.test'),
    (v_na_other, 'school_admin', v_inst_other, 'IR NA2',    'ir.na2@zz.test')
    on conflict (user_id) do update
      set role = excluded.role, institution_id = excluded.institution_id;

  -- ---- t1: a Super Admin creates a Class the way the app creates one ------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into classes (institution_id, name) values (v_inst, 'IR Class SA')
    returning id into v_class;
  if v_class is null then
    raise exception 'FAIL t1: INSERT ... RETURNING gave the Super Admin no row back';
  end if;
  raise notice 'PASS t1: Super Admin creates a Class with INSERT ... RETURNING';

  -- ---- t2: and it landed in the Institution that was asked for -----------
  reset role;
  perform 1 from classes where id = v_class and institution_id = v_inst;
  if not found then
    raise exception 'FAIL t2: the created Class is not in the requested Institution';
  end if;
  raise notice 'PASS t2: the Class landed in the requested Institution';

  -- ---- t3: a Nursery Admin creates a Class in their OWN institution ------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_na, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into classes (institution_id, name) values (v_inst, 'IR Class NA')
    returning id into v_class;
  raise notice 'PASS t3: Nursery Admin creates a Class in their own Institution';

  -- ---- t4: ...and is still refused one in someone else's -----------------
  begin
    insert into classes (institution_id, name) values (v_inst_other, 'IR Class CROSS')
      returning id into v_class;
    raise exception 'FAIL t4: a Nursery Admin created a Class in another Institution';
  exception
    when insufficient_privilege then
      raise notice 'PASS t4: cross-tenant Class creation is still refused';
  end;

  -- ---- t5: a Nursery Admin creates a Student the way the app does --------
  insert into students (student_no, institution_id, given_name, family_name)
    values ('IR-' || floor(random() * 1000000)::text, v_inst, 'Ira', 'Probe')
    returning id into v_student;
  if v_student is null then
    raise exception 'FAIL t5: INSERT ... RETURNING gave the Nursery Admin no Student back';
  end if;
  raise notice 'PASS t5: Nursery Admin creates a Student with INSERT ... RETURNING';

  -- ---- t6: the OTHER Nursery Admin sees neither ---------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_na_other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from classes  where institution_id = v_inst;
  if v_seen <> 0 then
    raise exception 'FAIL t6: a Nursery Admin can see % classes of another Institution', v_seen;
  end if;
  select count(*) into v_seen from students where institution_id = v_inst;
  if v_seen <> 0 then
    raise exception 'FAIL t6: a Nursery Admin can see % students of another Institution', v_seen;
  end if;
  raise notice 'PASS t6: the rewritten SELECT policies leak nothing across tenants';

  -- ---- t7: an identity with no account behind it still sees nothing -------
  -- A valid JWT whose subject has no app_users row is the shape a revoked or
  -- not-yet-provisioned account takes. Every branch of both rewritten policies
  -- resolves through app_users, so this must come back empty.
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000000000ff',
                      'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from classes;
  if v_seen <> 0 then
    raise exception 'FAIL t7: an account-less identity can see % classes', v_seen;
  end if;
  select count(*) into v_seen from students;
  if v_seen <> 0 then
    raise exception 'FAIL t7: an account-less identity can see % students', v_seen;
  end if;
  raise notice 'PASS t7: an identity with no account sees no Class and no Student';

  reset role;
  raise notice '---------------------------------------------------------';
  raise notice 'INSERT ... RETURNING: Class and Student creation works through';
  raise notice 'the statement the client actually issues, and tenant isolation';
  raise notice 'is unchanged.';
end $$;
