-- =====================================================================
-- LunchBox Connect — Cross-Portal Visibility & Authorization Boundary
-- Covers final-verification sections §95, §96, §97, §109, §119,
-- plus the negative authorization cases (§88-§94).
--
-- HOW TO RUN
--   psql -f tests/sql/verify_rls_cross_portal.sql
--   or paste into the Supabase SQL editor. One transaction, ROLLBACK at
--   the end. Nothing persists.
--
-- WHY THIS IS SEPARATE FROM verify_golden_path.sql
--   That script proves the DATA CHAIN is correct. It runs as an admin,
--   so RLS is not the thing under test there. THIS script re-reads the
--   same chain through each role's own policies, which is the only way
--   "every portal sees the same single record" is actually a proof and
--   not an assumption. Reads here run with `set local role authenticated`
--   and a forged request.jwt.claims, exactly as PostgREST would.
--
-- IMPORTANT
--   Do not run this as a superuser-only check. A Postgres SUPERUSER
--   BYPASSES RLS, so every assertion below would trivially pass and
--   prove nothing. The `set local role authenticated` lines are what
--   make it meaningful; if you remove them the script is worthless.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- FIXTURES (created as the migration owner; setup is legitimately admin)
-- Deterministic UUIDs so each role block below can address rows directly
-- without needing to share plpgsql variables across role switches.
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('cc000000-0000-0000-0000-000000000001','zz.super@verify.test'),
  ('cc000000-0000-0000-0000-000000000002','zz.admin1@verify.test'),
  ('cc000000-0000-0000-0000-000000000003','zz.teacher@verify.test'),
  ('cc000000-0000-0000-0000-000000000004','zz.parent@verify.test'),
  ('cc000000-0000-0000-0000-000000000005','zz.kitchen@verify.test'),
  ('cc000000-0000-0000-0000-000000000006','zz.viewer@verify.test'),
  ('cc000000-0000-0000-0000-000000000007','zz.driver@verify.test');

insert into institutions (id, name, kind) values
  ('bb000000-0000-0000-0000-000000000001','ZZ Inst One','nursery'),
  ('bb000000-0000-0000-0000-000000000002','ZZ Inst Two','school');

insert into kitchens (id, name) values
  ('dd000000-0000-0000-0000-000000000001','ZZ Central Kitchen');

insert into app_users (user_id, role, full_name, email, institution_id, kitchen_id) values
  ('cc000000-0000-0000-0000-000000000001','super_admin','ZZ Super','zz.super@verify.test',null,null),
  ('cc000000-0000-0000-0000-000000000002','school_admin','ZZ Admin One','zz.admin1@verify.test','bb000000-0000-0000-0000-000000000001',null),
  ('cc000000-0000-0000-0000-000000000003','classroom_staff','ZZ Teacher','zz.teacher@verify.test','bb000000-0000-0000-0000-000000000001',null),
  ('cc000000-0000-0000-0000-000000000004','parent','ZZ Parent','zz.parent@verify.test',null,null),
  ('cc000000-0000-0000-0000-000000000005','kitchen','ZZ Kitchen','zz.kitchen@verify.test',null,'dd000000-0000-0000-0000-000000000001'),
  ('cc000000-0000-0000-0000-000000000006','viewer','ZZ Viewer','zz.viewer@verify.test',null,null),
  ('cc000000-0000-0000-0000-000000000007','driver','ZZ Driver','zz.driver@verify.test',null,null);

insert into classes (id, institution_id, name, grade, teacher_id) values
  ('ee000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000001','ZZ Class One','T','cc000000-0000-0000-0000-000000000003'),
  ('ee000000-0000-0000-0000-000000000002','bb000000-0000-0000-0000-000000000002','ZZ Class Two','1',null);

-- Two children in the teacher's class (one of them the parent's), one in
-- the other institution entirely.
insert into students (id, student_no, institution_id, given_name, family_name, class_id,
                      enrollment_status, operational_status) values
  ('ff000000-0000-0000-0000-000000000001','ZZ-X1','bb000000-0000-0000-0000-000000000001','Mine','Child','ee000000-0000-0000-0000-000000000001','enrolled','ACTIVE_BILLABLE_TO_NURSERY'),
  ('ff000000-0000-0000-0000-000000000002','ZZ-X2','bb000000-0000-0000-0000-000000000001','NotMine','Child','ee000000-0000-0000-0000-000000000001','enrolled','ACTIVE_BILLABLE_TO_NURSERY'),
  ('ff000000-0000-0000-0000-000000000003','ZZ-X3','bb000000-0000-0000-0000-000000000002','Other','Institution','ee000000-0000-0000-0000-000000000002','enrolled','ACTIVE_BILLABLE_TO_NURSERY');

insert into student_parents (student_id, user_id) values
  ('ff000000-0000-0000-0000-000000000001','cc000000-0000-0000-0000-000000000004');

-- Classroom scope is driven by class_staff now (migration 0025), not teacher_id.
insert into class_staff (class_id, user_id) values
  ('ee000000-0000-0000-0000-000000000001','cc000000-0000-0000-0000-000000000003');

insert into meals (id, name) values ('a1000000-0000-0000-0000-000000000001','ZZ Portal Meal');
insert into meal_revisions (id, meal_id, revision_no, name, ingredients, portion) values
  ('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',1,'ZZ Portal Meal','["rev one"]'::jsonb,'1 portion');
update meals set current_revision_id = 'a2000000-0000-0000-0000-000000000001'
  where id = 'a1000000-0000-0000-0000-000000000001';

-- Both institutions get a PUBLISHED lunch today; institution one also gets
-- an UNPUBLISHED (draft) service, which no downstream role may ever see.
insert into meal_services (id, institution_id, service_date, period, meal_revision_id, published, published_at) values
  ('a3000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000001',current_date,'lunch','a2000000-0000-0000-0000-000000000001',true,now()),
  ('a3000000-0000-0000-0000-000000000002','bb000000-0000-0000-0000-000000000002',current_date,'lunch','a2000000-0000-0000-0000-000000000001',true,now()),
  ('a3000000-0000-0000-0000-000000000003','bb000000-0000-0000-0000-000000000001',current_date,'snack','a2000000-0000-0000-0000-000000000001',false,null);

-- THE single observation. Every portal assertion below reads this one row.
insert into serving_records (id, serving_date, class_id, student_id, period, served_status,
                             consumption_pct, behavior, concern_observed, meal_service_id, recorded_by) values
  ('a4000000-0000-0000-0000-000000000001',current_date,'ee000000-0000-0000-0000-000000000001',
   'ff000000-0000-0000-0000-000000000001','lunch','served',75,'ate_independently',false,
   'a3000000-0000-0000-0000-000000000001','cc000000-0000-0000-0000-000000000003');

-- Same date, the child in the OTHER institution — the leakage canary.
insert into serving_records (id, serving_date, class_id, student_id, period, served_status,
                             consumption_pct, behavior, concern_observed, meal_service_id, recorded_by) values
  ('a4000000-0000-0000-0000-000000000002',current_date,'ee000000-0000-0000-0000-000000000002',
   'ff000000-0000-0000-0000-000000000003','lunch','served',50,'ate_independently',false,
   'a3000000-0000-0000-0000-000000000002','cc000000-0000-0000-0000-000000000001');

-- =====================================================================
-- PARENT — must see exactly one child, one observation, no drafts,
-- nothing from the other institution.
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000004","role":"authenticated"}';

do $$
declare n int; n2 int; pct int;
begin
  select count(*) into n from students;
  if n <> 1 then raise exception 'FAIL §97 parent sees % students, expected exactly 1', n; end if;

  -- Direct-ID probe: guessing another child's UUID must still return nothing.
  select count(*) into n2 from students where id = 'ff000000-0000-0000-0000-000000000002';
  if n2 <> 0 then raise exception 'FAIL §97 parent read another child by direct ID'; end if;
  raise notice 'PASS  §97 parent sees 1 of 3 students; direct-ID probe of another child returns 0';

  select count(*), max(consumption_pct) into n, pct from serving_records;
  if n <> 1 or pct <> 75 then
    raise exception 'FAIL §95 parent sees % observations (pct=%), expected 1 at 75', n, pct;
  end if;
  raise notice 'PASS  §95 parent reads THE SAME single observation, consumption 75%%';

  select count(*) into n from meal_services where published = false;
  if n <> 0 then raise exception 'FAIL §109 parent can see % draft services', n; end if;

  select count(*) into n from meal_services where institution_id = 'bb000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FAIL §119 parent sees the other institution''s services'; end if;
  raise notice 'PASS  §109/§119 parent sees 0 drafts and 0 rows from the other institution';

  -- §44: internal planning data must be invisible to a parent.
  select count(*) into n from rotations;
  if n <> 0 then raise exception 'FAIL §44 parent can read % rotation templates', n; end if;
  select count(*) into n from rotation_slots;
  if n <> 0 then raise exception 'FAIL §44 parent can read % rotation slots (unpublished planning)', n; end if;
  raise notice 'PASS  §44 parent sees 0 rotation templates and 0 rotation slots';

  -- ...but the parent CAN read the dish of their own published meal service.
  select count(*) into n from meal_revisions mr
   where exists (select 1 from meal_services ms
                  where ms.meal_revision_id = mr.id and ms.published
                    and ms.institution_id = 'bb000000-0000-0000-0000-000000000001');
  if n < 1 then raise exception 'FAIL §44 parent cannot read their own published meal dish'; end if;
  raise notice 'PASS  §44 parent CAN read the dish of their own published meal (% revision)', n;
end $$;
reset role;

-- =====================================================================
-- CLASSROOM STAFF — their class only, and the same observation.
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000003","role":"authenticated"}';

do $$
declare n int; pct int;
begin
  select count(*) into n from students;
  if n <> 2 then raise exception 'FAIL §96 classroom staff sees % students, expected 2 (their class)', n; end if;

  select count(*) into n from students where institution_id = 'bb000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FAIL §119 classroom staff sees another institution''s child'; end if;

  select count(*), max(consumption_pct) into n, pct from serving_records;
  if n <> 1 or pct <> 75 then
    raise exception 'FAIL §95 classroom staff sees % observations (pct=%), expected 1 at 75', n, pct;
  end if;
  raise notice 'PASS  §96/§95 classroom staff sees 2 of 3 students and the SAME observation at 75%%';
end $$;
reset role;

-- =====================================================================
-- KITCHEN — production scope only. Must never read child identity.
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000005","role":"authenticated"}';

do $$
declare n int;
begin
  select count(*) into n from students;
  if n <> 0 then raise exception 'FAIL §93 kitchen can read % student rows, expected 0', n; end if;

  select count(*) into n from serving_records;
  if n <> 0 then raise exception 'FAIL §93 kitchen can read % individual observations, expected 0', n; end if;

  select count(*) into n from meal_services where published;
  if n < 2 then raise exception 'FAIL kitchen cannot see published services (got %)', n; end if;

  select count(*) into n from meal_services where published = false;
  if n <> 0 then raise exception 'FAIL §109 kitchen can see % draft services', n; end if;
  raise notice 'PASS  §93/§109 kitchen sees 0 students, 0 observations, published services only';
end $$;
reset role;

-- =====================================================================
-- DRIVER — logistics only, no child data at all.
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000007","role":"authenticated"}';

do $$
declare n int;
begin
  select count(*) into n from students;
  if n <> 0 then raise exception 'FAIL §94 driver can read % student rows, expected 0', n; end if;
  select count(*) into n from serving_records;
  if n <> 0 then raise exception 'FAIL §94 driver can read % observations, expected 0', n; end if;
  raise notice 'PASS  §94 driver sees 0 students and 0 observations';
end $$;
reset role;

-- =====================================================================
-- SCHOOL ADMIN — own institution only.
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
declare n int; leak int;
begin
  select count(*) into n from students;
  select count(*) into leak from students where institution_id = 'bb000000-0000-0000-0000-000000000002';
  if n <> 2 or leak <> 0 then
    raise exception 'FAIL §119 school admin sees % students, % leaked from the other institution', n, leak;
  end if;
  raise notice 'PASS  §119 school admin sees 2 own students, 0 leaked';
end $$;
reset role;

-- =====================================================================
-- NEGATIVE AUTHORIZATION — writes that must be refused by the database,
-- not merely hidden by the UI.
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000006","role":"authenticated"}';

do $$
declare msg text;
begin
  begin
    insert into institutions (name, kind) values ('ZZ Viewer Should Not Create','nursery');
    raise exception 'FAIL §90 a VIEWER successfully created an Institution';
  exception
    when insufficient_privilege then
      msg := SQLERRM;
      -- A missing GRANT and a row-level policy refusal share SQLSTATE 42501.
      -- Insist on the POLICY message: if this ever passes because the role
      -- simply lost its table grant, that is a different bug wearing the same
      -- error code, and it would hide the fact that RLS was never consulted.
      if msg not ilike '%row-level security%' then
        raise exception 'FAIL §90 refused, but by a GRANT not a policy: %', msg;
      end if;
      raise notice 'PASS  §90 viewer INSERT refused by row-level security policy, not by a grant';
  end;
end $$;
reset role;

-- Positive control: the refusal above only means something if the SAME
-- statement succeeds for a role that is supposed to be allowed.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare n int;
begin
  insert into institutions (name, kind) values ('ZZ Super May Create','nursery');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL a SUPER ADMIN cannot create an Institution'; end if;
  raise notice 'PASS  control: super admin CAN create an Institution (so §90 is a real refusal)';
end $$;
reset role;

-- Append-only history: even a SUPER ADMIN cannot rewrite a meal revision.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare n int; ing text;
begin
  update meal_revisions set ingredients = '["REWRITTEN HISTORY"]'::jsonb
   where id = 'a2000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL §28 super admin rewrote % meal_revisions rows', n; end if;

  select ingredients::text into ing from meal_revisions
   where id = 'a2000000-0000-0000-0000-000000000001';
  if ing <> '["rev one"]' then raise exception 'FAIL §28 revision content changed to %', ing; end if;

  -- 0034 item 14: meal history is archive-only. DELETE is no longer merely
  -- filtered away by a policy — the grant itself is revoked, so the attempt is
  -- refused outright. Either way no row may be destroyed; this is the stronger
  -- of the two boundaries.
  begin
    delete from meal_revisions where id = 'a2000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL §28 super admin deleted % meal_revisions rows', n; end if;
    raise notice 'PASS  §28 super admin DELETE on meal_revisions affects 0 rows (policy)';
  exception when insufficient_privilege then
    raise notice 'PASS  §28 super admin DELETE on meal_revisions is refused by grant (archive-only)';
  end;
  raise notice 'PASS  §28 super admin cannot rewrite or destroy a meal revision';

  -- Sanity: the super admin genuinely has full read, so the zeros above are
  -- a policy refusal and not an empty table.
  --
  -- Scoped to the ZZ fixtures ON PURPOSE. An earlier version counted every
  -- student in the database and asserted 3, which is only true on an empty
  -- one; against a real project it failed with "sees 13, expected 3" even
  -- though every access-control check above had passed. A control that breaks
  -- when unrelated rows exist tests the fixture count, not the policy.
  select count(*) into n from students where student_no like 'ZZ-%';
  if n <> 3 then
    raise exception 'FAIL super admin sees % of the 3 ZZ fixture students', n;
  end if;
  select count(*) into n from meal_services
   where published = false
     and institution_id in ('bb000000-0000-0000-0000-000000000001',
                            'bb000000-0000-0000-0000-000000000002');
  if n <> 1 then
    raise exception 'FAIL super admin sees % fixture drafts, expected 1', n;
  end if;
  raise notice 'PASS  control: super admin sees all 3 fixture students and the 1 fixture draft (zeros above were refusals)';
end $$;
reset role;

-- =====================================================================
-- RESOLVER RPC LEAK (migration 0018)
--
-- meal_services enforces cross-institution isolation correctly. The
-- SECURITY DEFINER resolvers took an institution id and did NOT check
-- app_can_see_institution(), so a Parent could read a foreign
-- institution's meal — and, by probing dates that returned nothing, its
-- closure calendar — straight through the RPC while the table returned 0.
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-0000-0000-000000000004","role":"authenticated"}';

do $$
declare leaked text;
begin
  begin
    select mm.name into leaked
      from resolve_meal('bb000000-0000-0000-0000-000000000002', current_date, 'lunch') r
      join meals mm on mm.id = r.meal_id;
    raise exception 'FAIL a Parent executed resolve_meal() against a foreign institution (got %)',
      coalesce(leaked, '<no row, but EXECUTE was permitted>');
  exception
    when insufficient_privilege then
      raise notice 'PASS  resolve_meal() is not executable by a Parent (cross-institution leak closed)';
  end;
end $$;
reset role;

-- The grant, not just the behaviour. PostgreSQL gives EXECUTE to PUBLIC on
-- every new function, so a later `create or replace` silently restores the
-- privilege even though 0018 revoked it. Assert on the privilege directly so
-- that regression cannot pass unnoticed.
do $$
declare f text; bad text := '';
begin
  foreach f in array array[
    'resolve_meal(uuid,date,app_period)',
    'resolve_rotation_week(uuid,date)',
    'service_plan_includes(uuid,date,app_period)',
    'backfill_legacy_menus()'
  ] loop
    if has_function_privilege('authenticated', f, 'EXECUTE')
       or has_function_privilege('anon', f, 'EXECUTE') then
      bad := bad || f || ' ';
    end if;
  end loop;
  if bad <> '' then
    raise exception 'FAIL these SECURITY DEFINER routines are executable by anon/authenticated: %', bad;
  end if;
  raise notice 'PASS  all 4 unguarded SECURITY DEFINER routines are revoked from anon and authenticated';
end $$;

do $$ begin
  raise notice '---------------------------------------------------------';
  raise notice 'ALL CROSS-PORTAL CHECKS PASSED — rolling back, no data retained.';
end $$;

rollback;
