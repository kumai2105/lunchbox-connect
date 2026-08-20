-- =====================================================================
-- 0036 item 13 — republishing vs Classroom recording, across REAL sessions.
--
-- The approved rule: a FUTURE, UNSERVED published Meal Service may deliberately
-- re-resolve; once serving history exists, its Meal truth is immutable. What
-- was missing was the boundary between those two states.
--
-- publish_meal_services() tested "does this service have any serving_record?"
-- with no lock, then mutated or deleted the row. The FK on
-- serving_records.meal_service_id is ON DELETE SET NULL, so a racing delete
-- would have ORPHANED the very record that was making the service historical.
--
-- Uses dblink for a genuine second session; manages and cleans up its own
-- committed state.
-- =====================================================================
create extension if not exists dblink;

-- ---- committed fixture, visible to both sessions ---------------------
insert into institutions (id, name, kind)
  values ('dd000000-0000-0000-0000-000000000001','ZZ Race Nursery','nursery')
  on conflict (id) do nothing;
insert into auth.users (id, email)
  values ('dd000000-0000-0000-0000-00000000000a','race.staff@t.test')
  on conflict (id) do nothing;
insert into app_users (user_id, role, full_name, email, institution_id)
  values ('dd000000-0000-0000-0000-00000000000a','classroom_staff','Race Staff','race.staff@t.test',
          'dd000000-0000-0000-0000-000000000001')
  on conflict (user_id) do nothing;
insert into classes (id, institution_id, name, grade)
  values ('dd000000-0000-0000-0000-00000000000c','dd000000-0000-0000-0000-000000000001','ZZ Race Class','T')
  on conflict (id) do nothing;
insert into class_staff (class_id, user_id)
  values ('dd000000-0000-0000-0000-00000000000c','dd000000-0000-0000-0000-00000000000a')
  on conflict do nothing;
insert into students (id, student_no, institution_id, given_name, family_name, class_id, operational_status)
  values ('dd000000-0000-0000-0000-00000000000d','ZZ-RACE','dd000000-0000-0000-0000-000000000001',
          'Race','Kid','dd000000-0000-0000-0000-00000000000c','ACTIVE_BILLABLE_TO_NURSERY')
  on conflict (id) do nothing;
insert into meals (id, name) values ('dd000000-0000-0000-0000-00000000000e','ZZ Race Meal')
  on conflict (id) do nothing;
insert into meal_revisions (id, meal_id, revision_no, name)
  values ('dd000000-0000-0000-0000-00000000000f','dd000000-0000-0000-0000-00000000000e',1,'ZZ Race Meal')
  on conflict (id) do nothing;
delete from serving_records where student_id = 'dd000000-0000-0000-0000-00000000000d';
insert into meal_services (id, institution_id, service_date, period, meal_revision_id, published, published_at)
  values ('dd000000-0000-0000-0000-000000000010','dd000000-0000-0000-0000-000000000001',
          app_operational_date(),'lunch','dd000000-0000-0000-0000-00000000000f',true, now())
  on conflict (id) do update set meal_revision_id = excluded.meal_revision_id, published = true;

do $$
declare
  v_conn text := 'host=/tmp port=5433 dbname=lbc user=postgres';
  v_service uuid := 'dd000000-0000-0000-0000-000000000010';
  v_blocked boolean := false;
  n int; v_link uuid;
begin
  -- =================================================================
  -- r1 — BEFORE any serving exists, the publisher may re-resolve freely.
  -- =================================================================
  update meal_services set meal_revision_id = 'dd000000-0000-0000-0000-00000000000f'
   where id = v_service;
  select count(*) into n from serving_records where meal_service_id = v_service;
  if n <> 0 then raise exception 'FAIL r1: fixture already has serving history'; end if;
  raise notice 'PASS r1: an unserved future service carries no history and may re-resolve';

  -- =================================================================
  -- r2 — the publisher holds the service row; a concurrent FIRST recording
  -- must WAIT rather than slip in behind the history check.
  -- =================================================================
  perform 1 from meal_services where id = v_service for update;

  -- The remote session must be a REAL authenticated classroom user, or the RPC
  -- refuses on authorization and a naive handler would read that refusal as
  -- "it blocked" — a false pass. The JWT claims are set inside that session,
  -- and ONLY a statement timeout (57014) counts as evidence of waiting.
  begin
    perform dblink_exec(v_conn, format(
      'set statement_timeout = ''1500ms''; '
      'select set_config(''request.jwt.claims'', %L, false); '
      'set role authenticated; '
      'select record_serving_batch(%L, '
      'jsonb_build_array(jsonb_build_object(''student_id'', %L, ''period'', ''lunch'', '
      '''served_status'', ''served'', ''consumption_pct'', ''100'')), app_operational_date())',
      json_build_object('sub','dd000000-0000-0000-0000-00000000000a','role','authenticated')::text,
      'dd000000-0000-0000-0000-00000000000c', 'dd000000-0000-0000-0000-00000000000d'));
  exception
    -- plpgsql's `when others` does NOT trap query_canceled (57014).
    when sqlstate '57014' then
      v_blocked := true;
      raise notice 'PASS r2: the first Classroom record WAITED for the publisher (statement timeout)';
      -- NOTE: r2 alone is satisfied by the foreign key — inserting the child row
      -- takes FOR KEY SHARE on the service, which already conflicts with a
      -- FOR UPDATE holder. r4 below is the case that isolates the PUBLISHER's
      -- own lock, and fails without it.
    when others then
      raise exception
        'FAIL r2: the remote recording failed for a reason OTHER than waiting on the '
        'publish boundary (%: %) — this test would otherwise report a false pass',
        sqlstate, sqlerrm;
  end;

  if not v_blocked then
    raise exception
      'FAIL r2: a Classroom record was created while the publisher held the service — '
      'the publisher could have swapped the revision or deleted it underneath';
  end if;

  select count(*) into n from serving_records where meal_service_id = v_service;
  if n <> 0 then raise exception 'FAIL r2: % record(s) landed during the publish window', n; end if;
  raise notice 'PASS r2: no observation was filed while the publish boundary was held';
end $$;

-- The publisher's transaction has ended, so the boundary is released.
-- =====================================================================
-- r3 — the OTHER order: once the first serving wins, the service is
-- historical and the publisher can neither change nor delete it.
-- =====================================================================
do $$
declare
  v_service uuid := 'dd000000-0000-0000-0000-000000000010';
  v_rev_before uuid; v_rev_after uuid; n int; v_orphans int;
begin
  -- the classroom records first, in this session
  perform set_config('request.jwt.claims',
    json_build_object('sub','dd000000-0000-0000-0000-00000000000a','role','authenticated')::text, true);
  set local role authenticated;
  perform record_serving_batch('dd000000-0000-0000-0000-00000000000c',
    jsonb_build_array(jsonb_build_object('student_id','dd000000-0000-0000-0000-00000000000d',
      'period','lunch','served_status','served','consumption_pct','100')),
    app_operational_date());
  reset role;

  select count(*) into n from serving_records where meal_service_id = v_service;
  if n <> 1 then raise exception 'FAIL r3: the classroom record did not land (%)', n; end if;
  select meal_revision_id into v_rev_before from meal_services where id = v_service;

  -- now the publisher runs over the same window
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000a1','role','authenticated')::text, true);
  set local role authenticated;
  perform publish_meal_services('dd000000-0000-0000-0000-000000000001',
                                app_operational_date(), app_operational_date());
  reset role;

  -- the historical service must be untouched...
  select meal_revision_id into v_rev_after from meal_services where id = v_service;
  if v_rev_after is distinct from v_rev_before then
    raise exception 'FAIL r3: republishing changed the revision of a SERVED Meal Service';
  end if;
  select count(*) into n from meal_services where id = v_service;
  if n <> 1 then raise exception 'FAIL r3: republishing DELETED a served Meal Service'; end if;

  -- ...and no observation may have been orphaned (the FK is ON DELETE SET NULL,
  -- so a deleted service would silently blank the link rather than fail).
  select count(*) into v_orphans from serving_records
   where student_id = 'dd000000-0000-0000-0000-00000000000d' and meal_service_id is null;
  if v_orphans <> 0 then
    raise exception 'FAIL r3: % serving record(s) were orphaned by republishing', v_orphans;
  end if;
  raise notice 'PASS r3: once served, the Meal Service is immutable — no revision change, no delete';
  raise notice 'PASS r3: no Serving Record was orphaned (ON DELETE SET NULL never fired)';

  raise notice '---------------------------------------------------------';
  raise notice 'PUBLISH/RECORD RACE: the boundary between future and historical holds.';
end $$;


-- =====================================================================
-- r4 — the case that ISOLATES the publisher's lock.
--
-- r2/r3 are both satisfied by the foreign key: a child insert takes FOR KEY
-- SHARE, and a DELETE of the parent conflicts with it. What the FK does NOT
-- stop is an UPDATE of a non-key column: changing meal_revision_id needs only
-- FOR NO KEY UPDATE, which is compatible with FOR KEY SHARE. So a publisher
-- with no lock can swap the revision underneath an in-flight first record.
--
-- Here a REAL second session holds an UNCOMMITTED first observation while the
-- publisher runs. With FOR UPDATE the publisher waits (and times out); without
-- it, the publisher rewrites the revision of a service that is in the act of
-- becoming historical.
-- =====================================================================
insert into meal_revisions (id, meal_id, revision_no, name)
  values ('dd000000-0000-0000-0000-000000000011','dd000000-0000-0000-0000-00000000000e',2,'ZZ Race Meal v2')
  on conflict (id) do nothing;
update meals set current_revision_id = 'dd000000-0000-0000-0000-000000000011'
 where id = 'dd000000-0000-0000-0000-00000000000e';
-- planning so resolve_meal() actually resolves a meal (otherwise the publisher
-- takes the closure/delete path, which the FK already protects)
insert into rotations (id, name, week_count, active)
  values ('dd000000-0000-0000-0000-000000000012','ZZ Race Rotation',1,true) on conflict (id) do nothing;
insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id)
  values ('dd000000-0000-0000-0000-000000000012',1,
          extract(isodow from app_operational_date())::int - 1,'lunch',
          'dd000000-0000-0000-0000-00000000000e') on conflict do nothing;
insert into institution_service_plans (institution_id, periods, effective_from)
  values ('dd000000-0000-0000-0000-000000000001', array['lunch']::app_period[], app_operational_date() - 30)
  on conflict do nothing;
insert into institution_rotation_assignments (institution_id, rotation_id, anchor_week, effective_from)
  values ('dd000000-0000-0000-0000-000000000001','dd000000-0000-0000-0000-000000000012',1,
          app_operational_date() - 30) on conflict do nothing;
-- back to an UNSERVED published service pointing at revision 1
delete from serving_records where student_id = 'dd000000-0000-0000-0000-00000000000d';
update meal_services set meal_revision_id = 'dd000000-0000-0000-0000-00000000000f'
 where id = 'dd000000-0000-0000-0000-000000000010';

-- Step 1: a second session holds exactly what an in-flight first observation
-- holds — FOR KEY SHARE on the Meal Service. That is the lock
-- record_serving_batch takes explicitly, and the one the foreign key takes
-- anyway while the child row is being inserted. Simulating the lock keeps the
-- assertion about what the PUBLISHER does, and nothing else.
-- (dblink_exec refuses commands that return rows, hence the DO wrapper.)
do $$
declare v_conn text := 'host=/tmp port=5433 dbname=lbc user=postgres';
begin
  perform dblink_connect('recorder', v_conn);
  perform dblink_exec('recorder', 'begin');
  perform dblink_exec('recorder',
    'do $x$ begin perform 1 from meal_services '
    'where id = ''dd000000-0000-0000-0000-000000000010'' for key share; end $x$');
end $$;

-- Step 2: arm the timeout OUTSIDE the block. SET LOCAL inside a DO block cannot
-- cancel that same DO statement — a statement's timeout is armed when it begins.
set statement_timeout = '1500ms';

-- Step 3: the publisher runs while that lock is held.
do $$
declare v_blocked boolean := false;
begin
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub','00000000-0000-0000-0000-0000000000a1','role','authenticated')::text, true);
    set local role authenticated;
    perform publish_meal_services('dd000000-0000-0000-0000-000000000001',
                                  app_operational_date(), app_operational_date());
    reset role;
  exception
    when sqlstate '57014' then
      v_blocked := true;
      raise notice 'PASS r4: the publisher WAITED for the in-flight first observation';
    when others then
      raise exception 'FAIL r4: the publisher failed for an unexpected reason (%: %)', sqlstate, sqlerrm;
  end;

  if not v_blocked then
    raise exception
      'FAIL r4: the publisher did NOT wait — it was free to rewrite the Meal '
      'revision of a service that was in the act of becoming historical';
  end if;
end $$;

set statement_timeout = '0';

-- Step 4: release the second session and confirm nothing was rewritten.
do $$
declare v_rev_after uuid;
begin
  perform dblink_exec('recorder', 'rollback');
  perform dblink_disconnect('recorder');
  select meal_revision_id into v_rev_after
    from meal_services where id = 'dd000000-0000-0000-0000-000000000010';
  if v_rev_after is distinct from 'dd000000-0000-0000-0000-00000000000f'::uuid then
    raise exception 'FAIL r4: the Meal revision was swapped to % under the in-flight observation', v_rev_after;
  end if;
  raise notice 'PASS r4: the Meal revision was NOT swapped under an in-flight observation';
  raise notice '---------------------------------------------------------';
  raise notice 'PUBLISH/RECORD RACE: the boundary between future and historical holds.';
end $$;

-- ---- cleanup ---------------------------------------------------------
-- Restore a VALID (empty) claims object first. The DO blocks above set
-- request.jwt.claims with is_local = true, so once their transactions end the
-- setting reverts to '' — and auth.uid(), which the audit trigger calls, then
-- fails parsing '' as json. This is a harness detail, not a product boundary.
select set_config('request.jwt.claims', '{}', false);
reset role;
delete from serving_records where student_id = 'dd000000-0000-0000-0000-00000000000d';
delete from meal_services where id = 'dd000000-0000-0000-0000-000000000010';
delete from students where id = 'dd000000-0000-0000-0000-00000000000d';
delete from class_staff where class_id = 'dd000000-0000-0000-0000-00000000000c';
delete from classes where id = 'dd000000-0000-0000-0000-00000000000c';
delete from app_users where user_id = 'dd000000-0000-0000-0000-00000000000a';
delete from auth.users where id = 'dd000000-0000-0000-0000-00000000000a';
delete from institution_rotation_assignments where rotation_id = 'dd000000-0000-0000-0000-000000000012';
delete from institution_service_plans where institution_id = 'dd000000-0000-0000-0000-000000000001';
delete from rotation_slots where rotation_id = 'dd000000-0000-0000-0000-000000000012';
delete from rotations where id = 'dd000000-0000-0000-0000-000000000012';
update meals set current_revision_id = null where id = 'dd000000-0000-0000-0000-00000000000e';
delete from meal_revisions where id = 'dd000000-0000-0000-0000-000000000011';
delete from meal_revisions where id = 'dd000000-0000-0000-0000-00000000000f';
delete from meals where id = 'dd000000-0000-0000-0000-00000000000e';
delete from institutions where id = 'dd000000-0000-0000-0000-000000000001';
