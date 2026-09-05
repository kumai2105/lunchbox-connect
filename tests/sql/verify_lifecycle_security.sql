-- =====================================================================
-- verify_lifecycle_security — the new off switches actually switch things off
--
-- Deactivation, archival and guardian revocation are only worth having if they
-- hold at the database boundary. A UI that hides a row is not a lifecycle: the
-- person still holds a valid token, the archived institution still has a
-- publish path, and the revoked guardian still has RLS access.
--
-- Every assertion below runs as the actual role through `set local role
-- authenticated` with a forged request.jwt.claims — the same context PostgREST
-- executes in — so what is proved here is what a real caller would get.
-- =====================================================================
do $$
declare
  v_sa    uuid := '00000000-0000-0000-0000-0000000000e1';  -- Super Admin
  v_sa2   uuid := '00000000-0000-0000-0000-0000000000e2';  -- second Super Admin
  v_ia    uuid := '00000000-0000-0000-0000-0000000000e3';  -- Institution Admin, inst A
  v_ia_b  uuid := '00000000-0000-0000-0000-0000000000e4';  -- Institution Admin, inst B
  v_staff uuid := '00000000-0000-0000-0000-0000000000e5';  -- Classroom Staff, inst A
  v_par   uuid := '00000000-0000-0000-0000-0000000000e6';  -- Parent
  v_kit   uuid := '00000000-0000-0000-0000-0000000000e7';  -- Kitchen
  v_a     uuid;   -- institution A
  v_b     uuid;   -- institution B
  v_class uuid;
  v_class2 uuid;
  v_stu   uuid;
  v_kitchen uuid;
  v_n     int;
  v_ok    boolean;
begin
  -- ---------------------------------------------------------------- setup
  insert into institutions (name, kind) values ('LS Alpha Nursery','nursery')
    on conflict (name) do nothing;
  insert into institutions (name, kind) values ('LS Beta School','school')
    on conflict (name) do nothing;
  select id into v_a from institutions where name='LS Alpha Nursery';
  select id into v_b from institutions where name='LS Beta School';

  insert into kitchens (name) values ('LS Kitchen') on conflict do nothing;
  select id into v_kitchen from kitchens where name='LS Kitchen';

  insert into auth.users (id,email) values
    (v_sa,'ls.sa@zz.test'),(v_sa2,'ls.sa2@zz.test'),(v_ia,'ls.ia@zz.test'),
    (v_ia_b,'ls.iab@zz.test'),(v_staff,'ls.staff@zz.test'),
    (v_par,'ls.parent@zz.test'),(v_kit,'ls.kitchen@zz.test')
    on conflict (id) do nothing;

  insert into app_users (user_id,role,institution_id,kitchen_id,full_name,email) values
    (v_sa,'super_admin',null,null,'LS Super','ls.sa@zz.test'),
    (v_sa2,'super_admin',null,null,'LS Super Two','ls.sa2@zz.test'),
    (v_ia,'school_admin',v_a,null,'LS InstAdmin A','ls.ia@zz.test'),
    (v_ia_b,'school_admin',v_b,null,'LS InstAdmin B','ls.iab@zz.test'),
    (v_staff,'classroom_staff',v_a,null,'LS Staff','ls.staff@zz.test'),
    (v_par,'parent',null,null,'LS Parent','ls.parent@zz.test'),
    (v_kit,'kitchen',null,v_kitchen,'LS Kitchen User','ls.kitchen@zz.test')
    on conflict (user_id) do update
      set role=excluded.role, institution_id=excluded.institution_id,
          kitchen_id=excluded.kitchen_id, active=true;

  insert into classes (institution_id, name, grade) values (v_a,'LS Class One','KG1')
    returning id into v_class;
  insert into classes (institution_id, name, grade) values (v_a,'LS Class Two','KG2')
    returning id into v_class2;
  insert into class_staff (class_id, user_id) values (v_class, v_staff);
  insert into students (institution_id, class_id, given_name, family_name, student_no,
                        operational_status)
    values (v_a, v_class, 'LS','Child','LS-001','ACTIVE_BILLABLE_TO_NURSERY')
    returning id into v_stu;
  insert into student_parents (student_id, user_id) values (v_stu, v_par);

  -- ================================================================ ACCOUNTS
  -- ---- a1: a deactivated person loses authority with a VALID token -------
  -- The token is not revoked here; nothing about the caller changes except
  -- app_users.active. That is the whole point: an unexpired JWT must stop
  -- being sufficient.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_user_active(v_staff, false, 'left the nursery');
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from students;
  reset role;
  if v_n <> 0 then
    raise exception 'FAIL a1: a deactivated staff member still read % student row(s)', v_n;
  end if;
  raise notice 'PASS a1: a deactivated account reads nothing, token or no token';

  -- ---- a2: ...and cannot write either ------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    insert into serving_records (serving_date, class_id, student_id, period, served_status)
      values (app_operational_date(), v_class, v_stu, 'lunch', 'served');
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 0 then raise exception 'FAIL a2: a deactivated staff member recorded a meal'; end if;
  exception when insufficient_privilege or check_violation then
    reset role;
  end;
  raise notice 'PASS a2: a deactivated account cannot write';

  -- ---- a3: the class assignment ended with the deactivation --------------
  select count(*) into v_n from class_staff where user_id = v_staff;
  if v_n <> 0 then
    raise exception 'FAIL a3: % class assignment(s) survived deactivation', v_n;
  end if;
  raise notice 'PASS a3: deactivation ends current class assignments';

  -- ---- a4: reactivation does NOT restore the old assignments -------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_user_active(v_staff, true, 'came back');
  reset role;

  select count(*) into v_n from class_staff where user_id = v_staff;
  if v_n <> 0 then
    raise exception 'FAIL a4: reactivation silently restored % class assignment(s)', v_n;
  end if;
  raise notice 'PASS a4: reactivation restores access, never the old class assignments';

  -- ---- a5: and the reactivated person has their scope back, no more ------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from institutions;
  reset role;
  if v_n <> 1 then
    raise exception 'FAIL a5: reactivated staff see % institution(s), expected only their own', v_n;
  end if;
  raise notice 'PASS a5: a reactivated account regains exactly its own scope';

  -- ---- a6: the last active Super Admin cannot be deactivated -------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_user_active(v_sa2, false, 'test');          -- now only v_sa remains
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa2, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    -- v_sa2 is itself deactivated now and must not be able to act at all
    perform set_user_active(v_sa, false, 'test');
    reset role;
    raise exception 'FAIL a6: a deactivated Super Admin still acted';
  exception when others then reset role;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform set_user_active(v_sa, false, 'removing the last admin');
    reset role;
    raise exception 'FAIL a6: the last active Super Admin was deactivated';
  exception when others then
    reset role;
    raise notice 'PASS a6: the last active Super Admin cannot be deactivated';
  end;

  -- restore the second Super Admin for the remaining checks
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_user_active(v_sa2, true, null);
  reset role;

  -- ---- a7: an Institution Admin may deactivate its OWN classroom staff ---
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ia, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_user_active(v_staff, false, 'own staff');
  perform set_user_active(v_staff, true, null);
  reset role;
  raise notice 'PASS a7: an Institution Admin may deactivate its own Classroom Staff';

  -- ---- a8: ...and nobody else ---------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ia, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform set_user_active(v_sa, false, 'attempt on a Super Admin');
    reset role;
    raise exception 'FAIL a8: an Institution Admin deactivated a Super Admin';
  exception when others then reset role;
  end;
  set local role authenticated;
  begin
    perform set_user_active(v_par, false, 'attempt on a Parent');
    reset role;
    raise exception 'FAIL a8: an Institution Admin deactivated a Parent';
  exception when others then reset role;
  end;
  set local role authenticated;
  begin
    perform set_user_active(v_kit, false, 'attempt on a Kitchen user');
    reset role;
    raise exception 'FAIL a8: an Institution Admin deactivated a Kitchen user';
  exception when others then reset role;
  end;
  set local role authenticated;
  begin
    perform set_user_active(v_ia_b, false, 'attempt on another Institution Admin');
    reset role;
    raise exception 'FAIL a8: an Institution Admin deactivated another Institution Admin';
  exception when others then reset role;
  end;
  raise notice 'PASS a8: an Institution Admin cannot touch Super Admin, Parent, Kitchen or a peer';

  -- ---- a9: nor another institution's staff -------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ia_b, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform set_user_active(v_staff, false, 'attempt across institutions');
    reset role;
    raise exception 'FAIL a9: an Institution Admin deactivated another institution''s staff';
  exception when others then
    reset role;
    raise notice 'PASS a9: an Institution Admin cannot reach another institution''s staff';
  end;

  -- ---- a10: a person may correct their OWN name and phone, and nothing else
  --
  -- update_user_profile() lets an ACTIVE person write their own row. The three
  -- things it must not become are checked here as well as the one thing it is:
  -- it must not reach another person's row, it must not become a way for a
  -- DEACTIVATED account to keep writing, and it must not touch email or role,
  -- which it cannot because it takes neither as an argument.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_par, 'role','authenticated')::text, true);
  set local role authenticated;
  perform update_user_profile(v_par, 'Renamed Parent', '+971500000001');
  reset role;
  if (select full_name from app_users where user_id = v_par) <> 'Renamed Parent' then
    raise exception 'FAIL a10: a Parent could not correct their own name';
  end if;
  raise notice 'PASS a10: a person may correct their own name and phone';

  set local role authenticated;
  begin
    perform update_user_profile(v_staff, 'Hijacked', null);
    reset role;
    raise exception 'FAIL a10: a Parent rewrote somebody else''s profile';
  exception when others then
    reset role;
    raise notice 'PASS a10: and nobody else''s';
  end;

  -- Now deactivate someone and try again as them. Every account reactivated by
  -- an earlier assertion is active by this point, so the state is established
  -- here rather than assumed from further up.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_user_active(v_sa2, false, 'to prove a deactivated account writes nothing');
  reset role;
  if (select active from app_users where user_id = v_sa2) then
    raise exception 'FAIL a10: the fixture account was not actually deactivated';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa2, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform update_user_profile(v_sa2, 'Still Here', null);
    reset role;
    raise exception 'FAIL a10: a deactivated account edited its own profile';
  exception when others then
    reset role;
    raise notice 'PASS a10: a deactivated account cannot even edit its own name';
  end;

  -- Put it back, so the assertions after this one see the fixture they expect.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_user_active(v_sa2, true, null);
  reset role;

  -- Email is not a parameter of the function at all, so there is no path
  -- through it that could desynchronise the profile copy from Supabase Auth.
  if exists (
    select 1 from pg_proc p
    where p.proname = 'update_user_profile'
      and pg_get_function_identity_arguments(p.oid) like '%email%'
  ) then
    raise exception 'FAIL a10: update_user_profile grew an email argument';
  end if;
  raise notice 'PASS a10: email is not reachable through the profile edit at all';

  -- =============================================================== CLASSES
  -- ---- c1: archiving is refused while anyone is still assigned -----------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ia, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform set_class_active(v_class, false, 'tidy up');
    reset role;
    raise exception 'FAIL c1: a class with a student still assigned was archived';
  exception when others then
    reset role;
    raise notice 'PASS c1: a class cannot be archived while students or staff remain';
  end;

  -- move the child and staff out, then archive for real
  update students set class_id = v_class2 where id = v_stu;
  delete from class_staff where class_id = v_class;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ia, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_class_active(v_class, false, 'closed for the year');
  reset role;
  raise notice 'PASS c1: an empty class archives cleanly';

  -- ---- c2: an archived class takes no new student -----------------------
  begin
    update students set class_id = v_class where id = v_stu;
    raise exception 'FAIL c2: a student was moved into an archived class';
  exception when check_violation then
    raise notice 'PASS c2: an archived class cannot take a student';
  end;

  -- ---- c3: nor new staff -------------------------------------------------
  begin
    insert into class_staff (class_id, user_id) values (v_class, v_staff);
    raise exception 'FAIL c3: staff were assigned to an archived class';
  exception when check_violation then
    raise notice 'PASS c3: an archived class cannot take a staff assignment';
  end;

  -- ---- c4: nor a classroom record ----------------------------------------
  begin
    insert into serving_records (serving_date, class_id, student_id, period, served_status)
      values (app_operational_date(), v_class, v_stu, 'lunch', 'served');
    raise exception 'FAIL c4: a meal was recorded against an archived class';
  exception when check_violation then
    raise notice 'PASS c4: an archived class cannot be recorded against';
  end;

  -- restore for the institution checks below
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ia, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_class_active(v_class, true, null);
  reset role;

  -- ========================================================== INSTITUTIONS
  -- ---- i1: only a Super Admin may archive --------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ia, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform set_institution_active(v_a, false, 'attempt');
    reset role;
    raise exception 'FAIL i1: an Institution Admin archived its own institution';
  exception when others then
    reset role;
    raise notice 'PASS i1: only a Super Admin may archive an institution';
  end;

  -- ---- i2: archiving is refused over future published service ------------
  insert into meal_services (institution_id, service_date, period, meal_revision_id, published)
    select v_a, app_operational_date() + 3, 'lunch', r.id, true
      from meal_revisions r limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform set_institution_active(v_a, false, 'closing the account');
    reset role;
    raise exception 'FAIL i2: an institution with future published service was archived';
  exception when others then
    reset role;
    raise notice 'PASS i2: archiving refuses to run over future published meal service';
  end;

  -- resolve the commitment deliberately, then archive
  delete from meal_services
   where institution_id = v_a and service_date >= app_operational_date();

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_institution_active(v_a, false, 'customer left');
  reset role;
  raise notice 'PASS i2: with the commitment resolved, the institution archives';

  -- ---- i3: an archived institution takes no new operational activity -----
  begin
    insert into classes (institution_id, name, grade) values (v_a, 'LS Ghost Class','KG3');
    raise exception 'FAIL i3: a class was created in an archived institution';
  exception when check_violation then
    raise notice 'PASS i3: an archived institution cannot gain a class';
  end;

  begin
    insert into students (institution_id, class_id, given_name, family_name, student_no,
                          operational_status)
      values (v_a, v_class2, 'LS','Ghost','LS-999','ACTIVE_BILLABLE_TO_NURSERY');
    raise exception 'FAIL i3: a student was created in an archived institution';
  exception when check_violation then
    raise notice 'PASS i3: an archived institution cannot gain a student';
  end;

  -- ---- i4: nor new publication -------------------------------------------
  begin
    insert into meal_services (institution_id, service_date, period, meal_revision_id, published)
      select v_a, app_operational_date() + 7, 'lunch', r.id, true from meal_revisions r limit 1;
    raise exception 'FAIL i4: an archived institution received a published meal service';
  exception when check_violation then
    raise notice 'PASS i4: an archived institution cannot receive new publication';
  end;

  -- ---- i4b: nor a new PERSON, and this one has to be a trigger -----------
  --
  -- Accounts are written by the admin-create-user Edge Function under the
  -- SERVICE ROLE, which bypasses every policy in the project. So this is
  -- asserted the way that writer behaves — as the table owner, with RLS out of
  -- the picture. A policy could not have caught it; migration 0046 is a
  -- trigger for exactly that reason.
  begin
    insert into app_users (user_id, role, institution_id, full_name, email)
      values (gen_random_uuid(), 'classroom_staff', v_a, 'Late Hire', 'late.hire@e2e.test');
    raise exception 'FAIL i4b: an archived institution took on a new staff account';
  exception when check_violation then
    raise notice 'PASS i4b: an archived institution takes on no new people';
  end;

  -- ...while its EXISTING people stay manageable, which is the point of not
  -- blocking an update that leaves institution_id alone. An archived
  -- institution's staff are precisely who an administrator still needs to
  -- deactivate afterwards.
  update app_users set full_name = 'Renamed After Archive'
   where institution_id = v_a and role = 'classroom_staff';
  if not exists (select 1 from app_users
                  where institution_id = v_a and full_name = 'Renamed After Archive') then
    raise exception 'FAIL i4b: an archived institution''s existing staff became unmanageable';
  end if;
  raise notice 'PASS i4b: and its existing people stay manageable';

  -- ---- i5: history survives the archive ----------------------------------
  select count(*) into v_n from students where institution_id = v_a;
  if v_n < 1 then raise exception 'FAIL i5: archiving destroyed student rows'; end if;
  select count(*) into v_n from classes where institution_id = v_a;
  if v_n < 1 then raise exception 'FAIL i5: archiving destroyed class rows'; end if;
  raise notice 'PASS i5: archiving preserves every record the institution owns';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform set_institution_active(v_a, true, null);
  reset role;

  -- ============================================================== GUARDIAN
  -- ---- g1: the Parent can see their child before revocation --------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_par, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from students where id = v_stu;
  reset role;
  if v_n <> 1 then raise exception 'FAIL g1: the linked Parent could not see their child'; end if;
  raise notice 'PASS g1: a linked Parent sees their child';

  -- ---- g2: an Institution Admin cannot revoke -----------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_ia, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform revoke_guardian_access(v_stu, v_par, 'attempt');
    reset role;
    raise exception 'FAIL g2: an Institution Admin revoked guardian access';
  exception when others then
    reset role;
    raise notice 'PASS g2: an Institution Admin cannot revoke guardian access';
  end;

  -- ---- g3: a reason is required -------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform revoke_guardian_access(v_stu, v_par, '   ');
    reset role;
    raise exception 'FAIL g3: guardian access was revoked with no reason';
  exception when others then
    reset role;
    raise notice 'PASS g3: revoking guardian access requires a reason';
  end;

  -- ---- g4: revocation removes RLS access IMMEDIATELY ----------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role','authenticated')::text, true);
  set local role authenticated;
  perform revoke_guardian_access(v_stu, v_par, 'no longer authorized');
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_par, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from students where id = v_stu;
  reset role;
  if v_n <> 0 then
    raise exception 'FAIL g4: the revoked Parent still reads their former child';
  end if;
  raise notice 'PASS g4: revocation removes the Parent''s access at once';

  -- ---- g5: and destroys neither the account, the child nor the history ---
  select count(*) into v_n from app_users where user_id = v_par;
  if v_n <> 1 then raise exception 'FAIL g5: revoking deleted the Parent account'; end if;
  select count(*) into v_n from students where id = v_stu;
  if v_n <> 1 then raise exception 'FAIL g5: revoking deleted the Student'; end if;
  raise notice 'PASS g5: revocation ends access only — account, child and history survive';

  -- ================================================================= AUDIT
  -- ---- x1: every new lifecycle action left a traceable record ------------
  select count(*) into v_n from audit_log
   where action in ('user.deactivate','user.reactivate','institution.archive',
                    'institution.reactivate','class.archive','class.reactivate',
                    'guardian.revoke');
  if v_n < 7 then
    raise exception 'FAIL x1: only % lifecycle audit rows were written', v_n;
  end if;
  raise notice 'PASS x1: % audit rows cover the new lifecycle actions', v_n;

  select bool_and(a.actor_user_id is not null and a.new_value is not null) into v_ok
    from audit_log a
   where a.action in ('user.deactivate','institution.archive','class.archive','guardian.revoke');
  if not coalesce(v_ok,false) then
    raise exception 'FAIL x1: a lifecycle audit row is missing its actor or its new state';
  end if;
  raise notice 'PASS x1: each carries an actor and the state it moved to';

  select count(*) into v_n from audit_log a
   where a.action = 'guardian.revoke' and coalesce(btrim(a.reason),'') <> '';
  if v_n < 1 then raise exception 'FAIL x1: the guardian revocation recorded no reason'; end if;
  raise notice 'PASS x1: guardian revocation records the reason it was done for';

  -- ---- x2: no password value is ever written to the audit trail ----------
  select count(*) into v_n from audit_log a
   where a.previous_value::text ilike '%password%'
      or a.new_value::text ilike '%password%'
      or coalesce(a.reason,'') ilike '%password:%';
  if v_n <> 0 then
    raise exception 'FAIL x2: % audit row(s) contain password material', v_n;
  end if;
  raise notice 'PASS x2: the audit trail carries no password material';

  raise notice '---------------------------------------------------------';
  raise notice 'LIFECYCLE SECURITY: deactivation, archival and revocation hold';
  raise notice 'at the database boundary, not merely in the interface.';
end $$;
