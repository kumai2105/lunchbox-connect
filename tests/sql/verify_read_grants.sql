-- =====================================================================
-- verify_read_grants — the reads the application performs are actually
-- permitted, and only to the role entitled to them.
--
-- A policy is unreachable without the matching grant, because PostgreSQL
-- checks grants first. Two objects had a policy and no grant, and the
-- symptom was an error banner on /dashboard and /audit for the Super Admin
-- who owns both screens. 0042 states the grants; this asserts both halves
-- so neither can regress: the read WORKS for the entitled role, and it is
-- still REFUSED for everyone else.
-- =====================================================================
do $$
declare
  v_inst  uuid;
  v_sa    uuid := '00000000-0000-0000-0000-0000000000b1';
  v_na    uuid := '00000000-0000-0000-0000-0000000000b2';
  v_privs text;
  v_n     int;
begin
  insert into institutions (name, kind) values ('RG Institution', 'nursery')
    on conflict (name) do nothing;
  select id into v_inst from institutions where name = 'RG Institution';

  insert into auth.users (id, email) values
    (v_sa, 'rg.sa@zz.test'), (v_na, 'rg.na@zz.test')
    on conflict (id) do nothing;
  insert into app_users (user_id, role, institution_id, full_name, email) values
    (v_sa, 'super_admin',  null,   'RG Super', 'rg.sa@zz.test'),
    (v_na, 'school_admin', v_inst, 'RG NA',    'rg.na@zz.test')
    on conflict (user_id) do update
      set role = excluded.role, institution_id = excluded.institution_id;

  -- ---- g1: the grants exist at all ----------------------------------
  select coalesce(string_agg(privilege_type, ',' order by privilege_type), '(none)')
    into v_privs
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'audit_log' and grantee = 'authenticated';
  if position('SELECT' in v_privs) = 0 then
    raise exception 'FAIL g1: authenticated cannot SELECT audit_log (has %) — the /audit screen shows permission denied', v_privs;
  end if;

  select coalesce(string_agg(privilege_type, ',' order by privilege_type), '(none)')
    into v_privs
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'v_dashboard_institutions' and grantee = 'authenticated';
  if position('SELECT' in v_privs) = 0 then
    raise exception 'FAIL g1: authenticated cannot SELECT v_dashboard_institutions (has %) — the dashboard shows permission denied', v_privs;
  end if;
  raise notice 'PASS g1: both reads the application performs are granted to authenticated';

  -- ---- g2: anon holds nothing on either -----------------------------
  select count(*) into v_n
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('audit_log', 'v_dashboard_institutions')
     and grantee = 'anon';
  if v_n <> 0 then
    raise exception 'FAIL g2: anon holds % grant(s) on audit_log / the dashboard view', v_n;
  end if;
  raise notice 'PASS g2: an anonymous caller holds no grant on either object';

  -- ---- s1: a Super Admin can actually read both ----------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform count(*) from audit_log;
    perform count(*) from v_dashboard_institutions;
  exception when others then
    reset role;
    raise exception 'FAIL s1: a Super Admin could not read audit_log / the dashboard view (%: %)', sqlstate, sqlerrm;
  end;
  reset role;
  raise notice 'PASS s1: a Super Admin reads the audit trail and the dashboard view';

  -- ---- s2: the grant did NOT widen who sees audit rows ---------------
  -- The grant makes the policy reachable. The policy still decides.
  insert into audit_log (actor_user_id, action, entity_type, entity_id)
  values (v_sa, 'rg.probe', 'students', gen_random_uuid())
    on conflict do nothing;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_na, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from audit_log;
  reset role;
  if v_n <> 0 then
    raise exception 'FAIL s2: a Nursery Admin read % audit row(s) — the audit trail is Super Admin only', v_n;
  end if;
  raise notice 'PASS s2: a Nursery Admin still reads no audit row — the grant did not widen visibility';

  -- ---- s3: the dashboard read model is SCOPED, not merely reachable --
  -- The Institutions figure on the dashboard is `rows.length` of this view.
  -- An Institution Admin seeing a company-wide customer count would be
  -- operational information about other customers; the view is
  -- security_invoker (0039) so institutions_select scopes it, and this asserts
  -- that rather than trusting it. The Founder asked whether the number was a
  -- leak: it is not, and this is what keeps it that way.
  insert into institutions (name, kind) values ('RG Second Institution', 'school')
    on conflict (name) do nothing;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_na, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from v_dashboard_institutions;
  reset role;
  if v_n <> 1 then
    raise exception
      'FAIL s3: an Institution Admin sees % institution row(s) in the dashboard read model, expected exactly their own', v_n;
  end if;
  raise notice 'PASS s3: an Institution Admin sees exactly one institution — their own';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from v_dashboard_institutions;
  reset role;
  if v_n < 2 then
    raise exception
      'FAIL s3: a Super Admin sees only % institution row(s) — the operator must see every customer', v_n;
  end if;
  raise notice 'PASS s3: a Super Admin sees every institution (% rows)', v_n;

  raise notice '---------------------------------------------------------';
  raise notice 'READ GRANTS: /dashboard and /audit are reachable by the role';
  raise notice 'that owns them, by nobody else, and the dashboard read model';
  raise notice 'is scoped to the caller rather than merely readable.';
end $$;
