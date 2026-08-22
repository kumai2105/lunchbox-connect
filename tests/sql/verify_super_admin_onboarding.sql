-- =====================================================================
-- verify_super_admin_onboarding — Super Admin is the control plane, and
-- the DATABASE must let it act like one.
--
-- Onboarding a nursery is an ordinary commercial operation: create the
-- Institution, then configure what it purchased. If any step of that needs
-- a developer, a migration or a dashboard edit, the product has failed its
-- own purpose — so the permission to perform it is asserted here, at the
-- boundary that actually decides, rather than assumed from a UI that may
-- simply be showing a button the server will refuse.
--
-- The tests are written as GRANT + RLS together on purpose. PostgreSQL
-- checks grants BEFORE policies, so a policy alone proves nothing: 0033
-- carried institutions_insert and institutions_update for eight migrations
-- while the grant made them unreachable, and nothing noticed.
-- =====================================================================
do $$
declare
  v_sa    uuid := '00000000-0000-0000-0000-00000000e001';  -- super admin
  v_na    uuid := '00000000-0000-0000-0000-00000000e002';  -- nursery admin
  v_inst  uuid;
  v_new   uuid;
  v_privs text;
begin
  -- ---- actors -------------------------------------------------------
  insert into institutions (name, kind) values ('SAO Existing', 'nursery')
    on conflict (name) do nothing;
  select id into v_inst from institutions where name = 'SAO Existing';

  insert into auth.users (id, email) values
    (v_sa, 'sao.super@zz.test'), (v_na, 'sao.na@zz.test')
    on conflict (id) do nothing;
  insert into app_users (user_id, role, institution_id, full_name, email) values
    (v_sa, 'super_admin',  null,   'SAO Super', 'sao.super@zz.test'),
    (v_na, 'school_admin', v_inst, 'SAO NA',    'sao.na@zz.test')
    on conflict (user_id) do update
      set role = excluded.role, institution_id = excluded.institution_id;

  -- ---- g1: the grant exists at all ----------------------------------
  select coalesce(string_agg(privilege_type, ',' order by privilege_type), '(none)')
    into v_privs
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'institutions'
     and grantee = 'authenticated';
  if position('INSERT' in v_privs) = 0 then
    raise exception 'FAIL g1: authenticated cannot INSERT institutions (has %) — a Super Admin cannot onboard a nursery through the software', v_privs;
  end if;
  if position('UPDATE' in v_privs) = 0 then
    raise exception 'FAIL g1: authenticated cannot UPDATE institutions (has %) — a Super Admin cannot rename one', v_privs;
  end if;
  raise notice 'PASS g1: the insert/update grant the 0033 policies assume is present';

  -- ---- g2: DELETE is still refused ----------------------------------
  if position('DELETE' in v_privs) > 0 then
    raise exception 'FAIL g2: authenticated holds DELETE on institutions — 0033 revoked it deliberately; institutions are archived, never destroyed';
  end if;
  raise notice 'PASS g2: DELETE remains revoked — archival only';

  -- ---- s1: a Super Admin can actually create one --------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into institutions (name, kind) values ('SAO Onboarded', 'school')
    returning id into v_new;
  if v_new is null then
    raise exception 'FAIL s1: the Super Admin INSERT returned no row';
  end if;
  raise notice 'PASS s1: a Super Admin creates an Institution';

  -- ---- s2: ...and can rename it -------------------------------------
  update institutions set name = 'SAO Onboarded (renamed)' where id = v_new;
  if not found then
    raise exception 'FAIL s2: the Super Admin could not rename the Institution';
  end if;
  raise notice 'PASS s2: a Super Admin renames an Institution';

  -- ---- b1: a Nursery Admin still cannot create one ------------------
  -- The grant permits the verb; the policy decides the row. This is the
  -- assertion that proves 0041 widened a grant and not the boundary.
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_na, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into institutions (name, kind) values ('SAO Sneaky', 'nursery');
    raise exception 'FAIL b1: a Nursery Admin created an Institution';
  exception
    when insufficient_privilege then
      raise notice 'PASS b1: a Nursery Admin is still refused — RLS, not the grant, is the boundary';
  end;

  -- ---- b2: ...and cannot rename someone else's ----------------------
  begin
    update institutions set name = 'SAO Hijacked' where id = v_new;
    if found then
      raise exception 'FAIL b2: a Nursery Admin renamed an Institution';
    end if;
    raise notice 'PASS b2: a Nursery Admin cannot rename an Institution';
  exception
    when insufficient_privilege then
      raise notice 'PASS b2: a Nursery Admin cannot rename an Institution';
  end;

  -- ---- b3: nobody may destroy one -----------------------------------
  begin
    delete from institutions where id = v_new;
    raise exception 'FAIL b3: an Institution was deleted — history references it';
  exception
    when insufficient_privilege then
      raise notice 'PASS b3: deletion is refused for everyone';
  end;

  reset role;
  raise notice '---------------------------------------------------------';
  raise notice 'SUPER ADMIN ONBOARDING: creating and renaming an Institution';
  raise notice 'works through the client boundary, and only for a Super Admin.';
end $$;
