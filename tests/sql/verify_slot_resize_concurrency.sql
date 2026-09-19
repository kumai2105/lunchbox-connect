-- =====================================================================
-- 0035 item 4 — rotation_slots.week_number <= rotations.week_count must hold
-- under CONCURRENT transactions, not only sequential ones.
--
-- guard_rotation_slot_week() used to read the parent rotation's week_count with
-- no lock, while set_rotation_week_count() takes `for update` on that same row.
-- Two sessions could therefore interleave so a slot validated against a
-- week_count that was being lowered, and the invariant broke with neither
-- statement having failed.
--
-- This suite uses dblink for a REAL second session. It manages its own state
-- (the second session cannot see an uncommitted fixture) and cleans up after
-- itself, so it deliberately does not use the one-transaction/ROLLBACK shape.
-- =====================================================================
create extension if not exists dblink;

-- ---- committed fixture, visible to both sessions ---------------------
insert into meals (id, name)
  values ('cc111111-1111-1111-1111-111111111111', 'ZZ CONC Meal')
  on conflict (id) do nothing;
insert into rotations (id, name, week_count, active)
  values ('cc222222-2222-2222-2222-222222222222', 'ZZ CONC Rotation', 4, true)
  on conflict (id) do update set week_count = 4;
delete from rotation_slots where rotation_id = 'cc222222-2222-2222-2222-222222222222';

do $$
declare
  v_conn text := 'host=/tmp port=5433 dbname=lbc user=postgres';
  v_rot uuid := 'cc222222-2222-2222-2222-222222222222';
  v_meal uuid := 'cc111111-1111-1111-1111-111111111111';
  v_sql text;
  n int;
  v_blocked boolean := false;
begin
  v_sql := format(
    'set statement_timeout = ''1500ms''; insert into rotation_slots '
    '(rotation_id, week_number, weekday, period, meal_id) values (%L, 4, 0, ''lunch'', %L)',
    v_rot, v_meal);

  -- ---- CONTROL: with no resize in flight the write goes straight through,
  -- so the timeout below can only mean "it waited", never "it always fails".
  perform dblink_exec(v_conn, v_sql);
  select count(*) into n from rotation_slots where rotation_id = v_rot and week_number = 4;
  if n <> 1 then
    raise exception 'FAIL c1: the control insert did not land (%)', n;
  end if;
  raise notice 'PASS c1: control — a slot write with no resize in flight succeeds immediately';
  perform dblink_exec(v_conn, format('delete from rotation_slots where rotation_id = %L', v_rot));

  -- c3 fixture, seeded BEFORE any lock is held (a remote write would otherwise
  -- block forever behind our own row lock).
  perform dblink_exec(v_conn, format(
    'insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id) '
    'values (%L, 1, 1, ''lunch'', %L)', v_rot, v_meal));

  -- ---- THE TEST: hold the parent row exactly as set_rotation_week_count()
  -- does, then have the OTHER session attempt a slot write.
  perform 1 from rotations where id = v_rot for update;

  begin
    perform dblink_exec(v_conn, v_sql);
  -- NOTE: plpgsql's `when others` does NOT trap query_canceled (57014), which is
  -- exactly what the remote statement_timeout raises, so it is listed by name.
  exception
    when sqlstate '57014' or sqlstate '55P03' or others then
      v_blocked := true;
      raise notice 'PASS c2: the concurrent slot write BLOCKED on the resize lock (%)', sqlerrm;
  end;

  if not v_blocked then
    raise exception
      'FAIL c2: the slot write did not wait for the in-flight resize — it validated '
      'against a week_count another transaction was changing';
  end if;

  -- The blocked write must not have landed. (Scoped to week 4 — the c3 fixture
  -- slot at week 1 was seeded before any lock was taken and is expected.)
  select count(*) into n from rotation_slots where rotation_id = v_rot and week_number = 4;
  if n <> 0 then
    raise exception 'FAIL c2: % week-4 slot(s) were written during the resize', n;
  end if;
  raise notice 'PASS c2: no slot row was written while the Menu was being resized';

  -- ---- c3: the case that isolates the TRIGGER's lock.
  --
  -- c2 above is satisfied by the foreign key alone: inserting a child row takes
  -- FOR KEY SHARE on the parent, which already conflicts with the resize's FOR
  -- UPDATE. Removing the lock from the trigger does not make c2 fail, so c2
  -- proves the invariant holds but not WHY.
  --
  -- UPDATING an existing slot's week_number does not re-check the foreign key
  -- (rotation_id is unchanged), so no FK lock is taken. Only the explicit lock
  -- inside guard_rotation_slot_week() can serialize this one — which makes this
  -- check fail if that lock is ever removed.
  --
  -- The parent row is already held FOR UPDATE by this transaction from c2.
  v_blocked := false;
  begin
    perform dblink_exec(v_conn, format(
      'set statement_timeout = ''1500ms''; update rotation_slots set week_number = 2 '
      'where rotation_id = %L and week_number = 1', v_rot));
  exception
    when sqlstate '57014' or sqlstate '55P03' or others then
      v_blocked := true;
      raise notice 'PASS c3: a slot UPDATE also waits on the resize lock (%)', sqlerrm;
  end;

  if not v_blocked then
    raise exception
      'FAIL c3: a slot UPDATE validated its week against a week_count another '
      'transaction was changing — guard_rotation_slot_week() is not taking the '
      'parent row lock';
  end if;

  -- and the update must not have taken effect
  select count(*) into n from rotation_slots where rotation_id = v_rot and week_number = 2;
  if n <> 0 then
    raise exception 'FAIL c3: the slot UPDATE landed during the resize';
  end if;
  raise notice 'PASS c3: no slot row was moved while the Menu was being resized';

  raise notice '---------------------------------------------------------';
  raise notice 'SLOT/RESIZE CONCURRENCY: the invariant holds across sessions.';
end $$;

-- ---- cleanup (the lock is released with the DO block above) -----------
delete from rotation_slots where rotation_id = 'cc222222-2222-2222-2222-222222222222';
delete from institution_rotation_assignments where rotation_id = 'cc222222-2222-2222-2222-222222222222';
delete from rotations where id = 'cc222222-2222-2222-2222-222222222222';
delete from meals where id = 'cc111111-1111-1111-1111-111111111111';
