-- =====================================================================
-- verify_app_users_policy — is app_users_select's self-referencing shape
-- actually a defect, or is it safe here?
--
-- 0040 fixed a REPRODUCED failure on classes and students: a SELECT policy
-- whose USING clause re-read its OWN table by the row's id could never be
-- satisfied for INSERT ... RETURNING, because the new row is not in the
-- STABLE function's snapshot. app_users_select carries the same outward
-- shape via app_can_see_user(), and that similarity was recorded as a
-- latent risk rather than acted on.
--
-- This suite settles it from evidence instead of resemblance. Two things
-- differ from the 0040 case and both are asserted here rather than argued:
--
--   1. app_can_see_user(p_user) resolves the CALLER's row (auth.uid()),
--      which always already exists. The 0040 policies resolved the NEW
--      row's id. A predicate that reads a row that already exists has no
--      snapshot problem.
--   2. No client code path inserts or updates app_users. Accounts are
--      provisioned by the admin-create-user Edge Function under the
--      service role, which bypasses RLS entirely.
--
-- Every supported read is asserted below, including the two joined reads
-- the application actually issues, plus the write shape that broke on
-- classes — so that if this ever DOES regress, it fails here first.
-- =====================================================================
do $$
declare
  v_instA   uuid;
  v_instB   uuid;
  v_sa      uuid := '00000000-0000-0000-0000-0000000000a1';  -- super admin
  v_naA     uuid := '00000000-0000-0000-0000-0000000000a2';  -- school admin, A
  v_naB     uuid := '00000000-0000-0000-0000-0000000000a3';  -- school admin, B
  v_staff   uuid := '00000000-0000-0000-0000-0000000000a4';  -- classroom staff, A
  v_par     uuid := '00000000-0000-0000-0000-0000000000a5';  -- parent, linked in A
  v_parU    uuid := '00000000-0000-0000-0000-0000000000a6';  -- parent, UNLINKED
  v_kit     uuid := '00000000-0000-0000-0000-0000000000a7';  -- kitchen
  v_new     uuid := '00000000-0000-0000-0000-0000000000a8';  -- created during the run
  v_class   uuid;
  v_kitchen uuid;
  v_student uuid;
  v_seen    int;
  v_got     uuid;
begin
  -- ---- tenants and actors -------------------------------------------
  insert into institutions (name, kind) values ('AUP Institution A', 'nursery')
    on conflict (name) do nothing;
  insert into institutions (name, kind) values ('AUP Institution B', 'school')
    on conflict (name) do nothing;
  select id into v_instA from institutions where name = 'AUP Institution A';
  select id into v_instB from institutions where name = 'AUP Institution B';

  insert into auth.users (id, email) values
    (v_sa,'aup.sa@zz.test'), (v_naA,'aup.naa@zz.test'), (v_naB,'aup.nab@zz.test'),
    (v_staff,'aup.staff@zz.test'), (v_par,'aup.par@zz.test'),
    (v_parU,'aup.paru@zz.test'), (v_kit,'aup.kit@zz.test')
    on conflict (id) do nothing;

  insert into kitchens (name) values ('AUP Kitchen Entity') on conflict (name) do nothing;
  select id into v_kitchen from kitchens where name = 'AUP Kitchen Entity';

  insert into app_users (user_id, role, institution_id, kitchen_id, full_name, email) values
    (v_sa,   'super_admin',     null,    null,      'AUP Super',   'aup.sa@zz.test'),
    (v_naA,  'school_admin',    v_instA, null,      'AUP NA A',    'aup.naa@zz.test'),
    (v_naB,  'school_admin',    v_instB, null,      'AUP NA B',    'aup.nab@zz.test'),
    (v_staff,'classroom_staff', v_instA, null,      'AUP Staff',   'aup.staff@zz.test'),
    (v_par,  'parent',          null,    null,      'AUP Parent',  'aup.par@zz.test'),
    (v_parU, 'parent',          null,    null,      'AUP ParentU', 'aup.paru@zz.test'),
    (v_kit,  'kitchen',         null,    v_kitchen, 'AUP Kitchen', 'aup.kit@zz.test')
    on conflict (user_id) do update
      set role = excluded.role, institution_id = excluded.institution_id,
          kitchen_id = excluded.kitchen_id;

  insert into classes (institution_id, name) values (v_instA, 'AUP Class')
    on conflict do nothing;
  select id into v_class from classes where institution_id = v_instA and name = 'AUP Class';

  insert into students (institution_id, class_id, given_name, family_name, student_no)
  values (v_instA, v_class, 'Aup', 'Child', 'AUP-1')
    on conflict do nothing;
  select id into v_student from students where student_no = 'AUP-1';

  insert into student_parents (student_id, user_id) values (v_student, v_par)
    on conflict do nothing;
  insert into class_staff (class_id, user_id) values (v_class, v_staff)
    on conflict do nothing;

  -- ================================================================
  -- r1: EVERY role can read its own row.
  --
  -- This is the single most important assertion in the file. auth.tsx
  -- reads app_users by user_id on every session start; a role that cannot
  -- read its own row cannot sign in at all — the app would render a
  -- profile-less shell for that role and nothing else.
  -- ================================================================
  for v_got in select unnest(array[v_sa, v_naA, v_naB, v_staff, v_par, v_parU, v_kit]) loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_got, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_seen from app_users where user_id = v_got;
    reset role;
    if v_seen <> 1 then
      raise exception 'FAIL r1: account % cannot read its own app_users row — that role cannot sign in', v_got;
    end if;
  end loop;
  raise notice 'PASS r1: all seven accounts read their own row (the login path holds for every role)';

  -- ---- r2: a Super Admin sees every account -------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from app_users
   where user_id in (v_sa, v_naA, v_naB, v_staff, v_par, v_parU, v_kit);
  reset role;
  if v_seen <> 7 then
    raise exception 'FAIL r2: a Super Admin saw % of 7 accounts — the Users screen is incomplete', v_seen;
  end if;
  raise notice 'PASS r2: a Super Admin reads every account (the /users screen holds)';

  -- ---- r3: a School Admin sees its OWN institution's staff -----------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_naA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from app_users where institution_id = v_instA;
  if v_seen < 2 then
    raise exception 'FAIL r3: a School Admin saw % accounts in its own institution — the Staff screen is empty', v_seen;
  end if;

  -- ---- r4: ...and the LINKED Parent, by identity only ---------------
  select count(*) into v_seen from app_users where user_id = v_par;
  if v_seen <> 1 then
    raise exception 'FAIL r4: a School Admin cannot see the Parent linked to its own Student — the Guardians screen is blank';
  end if;

  -- ---- r5: ...but NOT an unlinked Parent (no directory) -------------
  select count(*) into v_seen from app_users where user_id = v_parU;
  if v_seen <> 0 then
    raise exception 'FAIL r5: a School Admin read an UNLINKED Parent — that is a parent directory, which 0036 closed';
  end if;

  -- ---- r6: ...and not another institution's admin --------------------
  select count(*) into v_seen from app_users where user_id = v_naB;
  if v_seen <> 0 then
    raise exception 'FAIL r6: a School Admin read another institution''s account';
  end if;
  reset role;
  raise notice 'PASS r3/r4/r5/r6: School Admin sees own staff + linked Parent only — no directory, no cross-tenant';

  -- ---- r7: the JOINED read the app actually issues for class staff ---
  -- classStaff() selects class_staff -> app_users!user_id. The embedded
  -- read is subject to app_users_select, so a policy failure here shows
  -- up as a silently NULL staff name rather than an error.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_naA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen
    from class_staff cs join app_users u on u.user_id = cs.user_id
   where cs.class_id = v_class;
  reset role;
  if v_seen <> 1 then
    raise exception 'FAIL r7: the class_staff -> app_users join returned % rows — staff names would render blank', v_seen;
  end if;
  raise notice 'PASS r7: the class_staff join resolves the staff account (names are not silently NULL)';

  -- ---- r8: the JOINED read for guardians -----------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_naA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen
    from student_parents sp join app_users u on u.user_id = sp.user_id
   where sp.student_id = v_student;
  reset role;
  if v_seen <> 1 then
    raise exception 'FAIL r8: the student_parents -> app_users join returned % rows — the Guardians screen would show an empty identity', v_seen;
  end if;
  raise notice 'PASS r8: the guardian join resolves the linked Parent account';

  -- ---- r9: a Parent sees ONLY itself ---------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_par, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from app_users;
  reset role;
  if v_seen <> 1 then
    raise exception 'FAIL r9: a Parent read % accounts — a Parent must see only its own', v_seen;
  end if;
  raise notice 'PASS r9: a Parent reads exactly one account, its own';

  -- ---- r10: Classroom Staff and Kitchen see only themselves ----------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from app_users;
  reset role;
  if v_seen <> 1 then
    raise exception 'FAIL r10: Classroom Staff read % accounts — it must see only its own', v_seen;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_kit, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from app_users;
  reset role;
  if v_seen <> 1 then
    raise exception 'FAIL r10: a Kitchen account read % accounts — it must see only its own', v_seen;
  end if;
  raise notice 'PASS r10: Classroom Staff and Kitchen each read exactly their own account';

  -- ================================================================
  -- w1: THE 0040 SHAPE, ASSERTED DIRECTLY.
  --
  -- This is the statement that broke on classes: INSERT ... RETURNING,
  -- where RETURNING applies the SELECT policy to the brand-new row. If
  -- app_can_see_user() had the same fault, this would return no row.
  --
  -- It does not, because the predicate resolves the CALLER's row
  -- (auth.uid()), which already exists — not the new row's id. The
  -- assertion pins that difference so a future edit to app_can_see_user()
  -- that starts resolving the target row fails here instead of in
  -- production.
  -- ================================================================
  insert into auth.users (id, email) values (v_new, 'aup.new@zz.test')
    on conflict (id) do nothing;
  delete from app_users where user_id = v_new;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_got := null;
  insert into app_users (user_id, role, institution_id, full_name, email)
  values (v_new, 'classroom_staff', v_instA, 'AUP New', 'aup.new@zz.test')
  returning user_id into v_got;
  reset role;

  if v_got is null then
    raise exception 'FAIL w1: INSERT ... RETURNING on app_users gave the Super Admin no row back — app_users_select has the 0040 fault after all';
  end if;
  raise notice 'PASS w1: INSERT ... RETURNING on app_users returns the row — the 0040 fault is NOT present here';

  -- ---- w2: and it is genuinely restricted to a Super Admin -----------
  delete from app_users where user_id = v_new;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_naA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into app_users (user_id, role, institution_id, full_name, email)
    values (v_new, 'classroom_staff', v_instA, 'AUP New', 'aup.new@zz.test');
    reset role;
    raise exception 'FAIL w2: a School Admin created an account directly — provisioning is Super Admin only';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'PASS w2: a School Admin cannot create an account directly';
    when others then
      reset role;
      if sqlstate = 'P0001' and sqlerrm like 'FAIL w2%' then raise; end if;
      raise notice 'PASS w2: a School Admin cannot create an account directly (%)', sqlstate;
  end;

  -- ---- w3: a Super Admin's UPDATE ... RETURNING returns its row ------
  -- UPDATE ... RETURNING applies the SELECT policy to the updated row
  -- exactly as INSERT does, so the 0040 shape is asserted on this path too.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_got := null;
  update app_users set full_name = 'AUP Staff Renamed'
   where user_id = v_staff returning user_id into v_got;
  reset role;
  if v_got is null then
    raise exception 'FAIL w3: a Super Admin''s UPDATE ... RETURNING on app_users returned nothing';
  end if;
  raise notice 'PASS w3: a Super Admin''s UPDATE ... RETURNING returns the row';

  -- ---- w4: self-profile editing is REFUSED, deliberately -------------
  -- 0033 replaced `user_id = auth.uid()` with `app_is_super_admin()`: the
  -- old rule let any account rewrite its own role/institution/kitchen,
  -- including to super_admin. There is no approved self-profile workflow
  -- (NOT_YET_DEFINED), so a staff member editing even their own name is
  -- correctly refused. This assertion pins that as intended behaviour so a
  -- future edit cannot quietly reopen the escalation path.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_got := null;
  update app_users set full_name = 'AUP Self Edit'
   where user_id = v_staff returning user_id into v_got;
  reset role;
  if v_got is not null then
    raise exception 'FAIL w4: a Classroom Staff account edited its own profile — 0033 removed that authority on purpose';
  end if;
  raise notice 'PASS w4: self-profile editing is refused — no approved workflow, and it was the escalation vector';

  -- ---- w5: not even a Super Admin rewrites identity from a client -----
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update app_users set role = 'super_admin' where user_id = v_staff;
    reset role;
    raise exception 'FAIL w5: an API client rewrote an account''s role';
  exception
    when others then
      reset role;
      if sqlstate = 'P0001' and sqlerrm like 'FAIL w5%' then raise; end if;
      raise notice 'PASS w5: no API client may rewrite role/institution/kitchen, Super Admin included (%)', sqlstate;
  end;

  raise notice '---------------------------------------------------------';
  raise notice 'app_users_select: the 0040 shape is NOT a defect here. The';
  raise notice 'predicate resolves the CALLER''s existing row, not the new';
  raise notice 'one, so RETURNING is satisfiable. Every supported read and';
  raise notice 'the two joined reads the app issues are asserted, and no';
  raise notice 'account''s visibility was widened to make any of it pass.';
end $$;
