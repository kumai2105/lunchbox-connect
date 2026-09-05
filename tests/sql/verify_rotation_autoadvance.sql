-- =====================================================================
-- verify_rotation_autoadvance — the rotation anchor is entered ONCE and
-- the calendar advances it, and configuration changes are effective-dated.
--
-- The Founder's requirement is explicit: "the rotation anchor should allow
-- the system to calculate subsequent weeks automatically, not require me to
-- manually choose the rotation week every week". That is a property of
-- resolve_rotation_week (0016), so it is asserted here against the real
-- function rather than inferred from a screen.
--
-- The second half asserts the other half of the same requirement — that the
-- configuration can be CHANGED later without rewriting what already happened.
-- Both record sets are effective-dated: a change is a new row with a later
-- effective_from, and the resolver takes the newest row at or before the date
-- being resolved. Days before that date keep the configuration they ran under.
-- =====================================================================
do $$
declare
  v_inst   uuid;
  v_rotA   uuid;   -- 4-week menu
  v_rotB   uuid;   -- 2-week menu (the later replacement)
  v_mon    date := date '2026-03-02';   -- a Monday
  v_wk     int;
  v_rid    uuid;
  v_n      int;
  d        date;
  expected int;
begin
  -- ---- fixture ------------------------------------------------------
  insert into institutions (name, kind) values ('RAA Nursery', 'nursery')
    on conflict (name) do nothing;
  select id into v_inst from institutions where name = 'RAA Nursery';

  insert into rotations (name, week_count, active) values ('RAA Menu A', 4, true)
    on conflict do nothing;
  select id into v_rotA from rotations where name = 'RAA Menu A';
  insert into rotations (name, week_count, active) values ('RAA Menu B', 2, true)
    on conflict do nothing;
  select id into v_rotB from rotations where name = 'RAA Menu B';

  -- The Founder enters this ONCE: this menu, from this date, starting on
  -- week 3. Nothing else about rotation position is ever entered again.
  delete from institution_rotation_assignments where institution_id = v_inst;
  insert into institution_rotation_assignments
    (institution_id, rotation_id, effective_from, anchor_week)
  values (v_inst, v_rotA, v_mon, 3);

  -- ---- a1: subsequent weeks advance by themselves --------------------
  -- One row on file. Week 3 → 4 → 1 → 2 → 3 …, purely from the calendar.
  for i in 0..8 loop
    expected := ((3 - 1 + i) % 4) + 1;
    select week_number into v_wk from resolve_rotation_week(v_inst, v_mon + (i * 7));
    if v_wk is distinct from expected then
      raise exception 'FAIL a1: week % after the anchor resolved to %, expected % — the anchor is not advancing the rotation by itself', i, v_wk, expected;
    end if;
  end loop;
  select count(*) into v_n from institution_rotation_assignments where institution_id = v_inst;
  if v_n <> 1 then
    raise exception 'FAIL a1: % rotation rows exist — nine weeks of correct rotation must come from ONE entered anchor, not from weekly entries', v_n;
  end if;
  raise notice 'PASS a1: nine consecutive weeks resolve correctly from a single entered anchor';

  -- ---- a2: still correct a year later, with nothing re-entered -------
  -- 52 whole weeks is exactly 13 turns of a 4-week menu, so the cycle is
  -- back on the anchor week; 53 weeks on it has moved one further.
  select week_number into v_wk from resolve_rotation_week(v_inst, v_mon + 364);
  if v_wk <> 3 then
    raise exception 'FAIL a2: 52 weeks after the anchor resolved to %, expected 3 (13 whole turns of a 4-week menu) — the rotation stops being self-maintaining', v_wk;
  end if;
  select week_number into v_wk from resolve_rotation_week(v_inst, v_mon + 371);
  if v_wk <> 4 then
    raise exception 'FAIL a2: 53 weeks after the anchor resolved to %, expected 4 — the rotation stops advancing', v_wk;
  end if;
  raise notice 'PASS a2: a year later the rotation is still resolved from the same single anchor';

  -- ---- a3: the week does not change mid-week -------------------------
  for i in 0..6 loop
    select week_number into v_wk from resolve_rotation_week(v_inst, v_mon + i);
    if v_wk <> 3 then
      raise exception 'FAIL a3: day % of the anchor week resolved to week %, expected 3 — position must be whole ISO weeks', i, v_wk;
    end if;
  end loop;
  raise notice 'PASS a3: every day of an ISO week resolves to the same rotation week';

  -- ---- a4: an anchor entered mid-week still anchors its whole week ---
  update institution_rotation_assignments
     set effective_from = v_mon + 2      -- Wednesday
   where institution_id = v_inst;
  select week_number into v_wk from resolve_rotation_week(v_inst, v_mon + 7);
  if v_wk <> 4 then
    raise exception 'FAIL a4: the week after a Wednesday anchor resolved to %, expected 4 — a mid-week effective date must not desynchronise the rotation', v_wk;
  end if;
  update institution_rotation_assignments set effective_from = v_mon where institution_id = v_inst;
  raise notice 'PASS a4: an effective date mid-week anchors that whole ISO week';

  -- ---- a5: before the anchor, nothing is resolved --------------------
  select count(*) into v_n from resolve_rotation_week(v_inst, v_mon - 1);
  if v_n <> 0 then
    raise exception 'FAIL a5: a date before the anchor resolved to a rotation week — the system must return nothing, never a guessed position';
  end if;
  raise notice 'PASS a5: dates before the anchor resolve to nothing, not to a guess';

  -- ---- a6: a closure does not shift the rotation ---------------------
  -- Decision 033: a closure suppresses service for those dates; it never
  -- moves the menu along. Week 2 is closed all week; week 3 must still be
  -- the week it would have been.
  delete from calendar_exceptions where institution_id = v_inst;
  insert into calendar_exceptions (institution_id, kind, date_from, date_to, reason)
  values (v_inst, 'closure', v_mon + 7, v_mon + 13, 'RAA closed week');
  select week_number into v_wk from resolve_rotation_week(v_inst, v_mon + 14);
  if v_wk <> 1 then
    raise exception 'FAIL a6: after a full closed week the rotation resolved to %, expected 1 — a closure must not shift the rotation', v_wk;
  end if;
  delete from calendar_exceptions where institution_id = v_inst;
  raise notice 'PASS a6: a whole-week closure leaves the rotation position untouched';

  -- ---- b1: the menu can be replaced from a later date ----------------
  -- The Founder switches to a different menu from week 4 onwards, starting
  -- that menu on its week 2. The earlier dates must keep Menu A.
  insert into institution_rotation_assignments
    (institution_id, rotation_id, effective_from, anchor_week)
  values (v_inst, v_rotB, v_mon + 21, 2);

  select rotation_id, week_number into v_rid, v_wk from resolve_rotation_week(v_inst, v_mon + 7);
  if v_rid <> v_rotA or v_wk <> 4 then
    raise exception 'FAIL b1: a date before the change resolved to menu %/week % — history must keep the menu it ran under', v_rid, v_wk;
  end if;
  select rotation_id, week_number into v_rid, v_wk from resolve_rotation_week(v_inst, v_mon + 21);
  if v_rid <> v_rotB or v_wk <> 2 then
    raise exception 'FAIL b1: the changeover date resolved to menu %/week %, expected the new menu on week 2', v_rid, v_wk;
  end if;
  select rotation_id, week_number into v_rid, v_wk from resolve_rotation_week(v_inst, v_mon + 28);
  if v_rid <> v_rotB or v_wk <> 1 then
    raise exception 'FAIL b1: the week after the changeover resolved to menu %/week %, expected the new menu wrapping to week 1', v_rid, v_wk;
  end if;
  raise notice 'PASS b1: a later menu assignment takes over on its date and advances on its own weeks, and earlier dates keep the old menu';

  -- ---- b2: the package can be changed from a later date --------------
  delete from institution_service_plans where institution_id = v_inst;
  insert into institution_service_plans (institution_id, periods, effective_from) values
    (v_inst, array['lunch']::app_period[], v_mon),
    (v_inst, array['breakfast','lunch']::app_period[], v_mon + 21);

  if service_plan_includes(v_inst, v_mon + 7, 'breakfast') then
    raise exception 'FAIL b2: breakfast was included before the package change — an upgrade must not reach backwards';
  end if;
  if not service_plan_includes(v_inst, v_mon + 7, 'lunch') then
    raise exception 'FAIL b2: lunch was not included before the package change — the earlier plan must keep governing its own days';
  end if;
  if not service_plan_includes(v_inst, v_mon + 21, 'breakfast') then
    raise exception 'FAIL b2: breakfast was not included from the change date — a scheduled package change must take effect by itself';
  end if;
  if service_plan_includes(v_inst, v_mon - 1, 'lunch') then
    raise exception 'FAIL b2: a date before any plan received a meal — no plan on file must mean no service, never an assumed one';
  end if;
  raise notice 'PASS b2: a later service plan takes over on its date, and earlier days keep theirs';

  -- ---- b3: one configuration per date, so a re-save corrects ---------
  begin
    insert into institution_service_plans (institution_id, periods, effective_from)
    values (v_inst, array['snack']::app_period[], v_mon + 21);
    raise exception 'FAIL b3: two service plans exist for the same date — which one governs is then undefined';
  exception
    when unique_violation then
      raise notice 'PASS b3: a second plan for the same date is refused, so re-saving corrects that date instead of racing it';
  end;

  begin
    insert into institution_rotation_assignments
      (institution_id, rotation_id, effective_from, anchor_week)
    values (v_inst, v_rotA, v_mon + 21, 1);
    raise exception 'FAIL b3: two rotation assignments exist for the same date';
  exception
    when unique_violation then
      raise notice 'PASS b3: a second rotation assignment for the same date is refused';
  end;

  -- ---- b4: an anchor outside the menu is refused ---------------------
  -- Guarded in 0033: an anchor beyond the menu's week_count would resolve to
  -- a week that has no slots, silently producing days with no meal.
  begin
    insert into institution_rotation_assignments
      (institution_id, rotation_id, effective_from, anchor_week)
    values (v_inst, v_rotB, v_mon + 60, 3);   -- Menu B only has 2 weeks
    raise exception 'FAIL b4: an anchor week beyond the menu was accepted';
  exception
    when others then
      if sqlstate = 'P0001' and sqlerrm like 'FAIL b4%' then raise; end if;
      raise notice 'PASS b4: an anchor week the chosen menu does not have is refused (%)', sqlstate;
  end;

  raise notice '---------------------------------------------------------';
  raise notice 'ROTATION ANCHOR: entered once, advanced by the calendar.';
  raise notice 'CONFIGURATION: changed by dating a new row, never by editing';
  raise notice 'the past. Nobody picks a rotation week week by week.';
end $$;
