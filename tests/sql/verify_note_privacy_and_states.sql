-- =====================================================================
-- 0034 pass — the Parent free-text boundary END TO END, classroom-record
-- state validity, the concern flag, atomic Menu resizing, and archive-only
-- lifecycle. Raw/direct data access, not UI assertions.
-- One transaction, ROLLBACK.
-- =====================================================================
begin;
do $$
declare
  v_super uuid := '00000000-0000-0000-0000-0000000000a1';
  v_inst uuid; v_cls uuid; v_staff uuid; v_parent uuid; v_student uuid;
  v_meal uuid; v_rev uuid; v_service uuid; v_rec uuid; v_note uuid;
  v_rot uuid; v_legacy uuid;
  v_d1 uuid; v_d2 uuid; v_d3 uuid;
  v_valid bigint; v_scored bigint; v_share_total numeric;
  n int; b boolean; t text;
begin
  -- ---- fixture -----------------------------------------------------------
  insert into institutions (name, kind) values ('ZZ NP Nursery','nursery') returning id into v_inst;
  insert into auth.users (email) values ('np.staff@t.test') returning id into v_staff;
  insert into auth.users (email) values ('np.parent@t.test') returning id into v_parent;
  insert into app_users (user_id, role, full_name, email, institution_id) values
    (v_staff,'classroom_staff','NP Staff','np.staff@t.test',v_inst);
  insert into app_users (user_id, role, full_name, email) values
    (v_parent,'parent','NP Parent','np.parent@t.test');
  insert into classes (institution_id, name, grade) values (v_inst,'NP Class','T') returning id into v_cls;
  insert into students (student_no, institution_id, given_name, family_name, class_id, operational_status)
    values ('NP-1', v_inst,'Kid','NP', v_cls,'ACTIVE_BILLABLE_TO_NURSERY') returning id into v_student;
  insert into class_staff (class_id, user_id) values (v_cls, v_staff);
  insert into student_parents (student_id, user_id) values (v_student, v_parent);
  insert into meals (name) values ('NP Meal') returning id into v_meal;
  insert into meal_revisions (meal_id, revision_no, name) values (v_meal,1,'NP Meal') returning id into v_rev;
  insert into meal_services (institution_id, service_date, period, meal_revision_id, published)
    values (v_inst, app_operational_date(), 'lunch', v_rev, true) returning id into v_service;

  -- =================================================================
  -- ITEM 2 — valid classroom meal-record states.
  -- =================================================================
  -- (a) an outcome-free SERVED row is refused by the RPC.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(v_cls,
      jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
        'served_status','served')),   -- no consumption, no behaviour, no exception
      app_operational_date());
    reset role;
    raise exception 'FAIL s2a: an outcome-free SERVED record was accepted';
  exception when check_violation then
    reset role;
    raise notice 'PASS s2a: a SERVED record with no consumption, behaviour or exception is refused';
  end;

  -- (b) the approved behaviour-free exception form IS accepted.
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  select out_id into v_rec from record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','low_intake_reason','absent')),
    app_operational_date());
  reset role;
  if v_rec is null then raise exception 'FAIL s2b: the ABSENT exception form was refused'; end if;
  raise notice 'PASS s2b: ABSENT/UNWELL/SLEEPING remain behaviour-free and recordable';

  -- (c) a normal served result with consumption is accepted.
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  select out_id into v_rec from record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','consumption_pct','75','behavior','ate_independently')),
    app_operational_date());
  reset role;
  select consumption_pct into n from serving_records where id = v_rec;
  if n <> 75 then raise exception 'FAIL s2c: a normal served result did not persist (%)', n; end if;
  raise notice 'PASS s2c: a normal SERVED result records its consumption';

  -- (d) NOT_SERVED stays distinct from 0% — it carries neither.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(v_cls,
      jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
        'served_status','not_served','consumption_pct','0')),
      app_operational_date());
    reset role;
    raise exception 'FAIL s2d: NOT_SERVED was allowed to carry a consumption of 0%%';
  exception when check_violation then
    reset role;
    raise notice 'PASS s2d: NOT_SERVED cannot carry consumption — it is not 0%%';
  end;

  -- (e) the table CHECK holds on the raw path too (defence in depth).
  begin
    insert into serving_records (serving_date, class_id, student_id, period, served_status,
                                 meal_service_id, recorded_by)
      values (app_operational_date(), v_cls, v_student, 'breakfast','served', v_service, v_staff);
    raise exception 'FAIL s2e: the raw path accepted an outcome-free SERVED row';
  exception when check_violation then
    raise notice 'PASS s2e: the table constraint refuses an outcome-free SERVED row';
  end;

  -- =================================================================
  -- 0035 ITEM 3 — the COMPLETE approved record-state semantics.
  -- Contradictory combinations must be refused; approved ones accepted.
  -- =================================================================
  -- helper: attempt one row through the RPC and report the verdict.
  -- (inline rather than a function so the suite stays one transaction)

  -- ---- NEGATIVES: contradictory states ----------------------------
  -- 100% + ate_independently + absent  → an exception cannot carry a result
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(v_cls,
      jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
        'served_status','served','consumption_pct','100','behavior','ate_independently',
        'low_intake_reason','absent')),
      app_operational_date());
    reset role;
    raise exception 'FAIL n1: 100%% + ate_independently + absent was accepted';
  exception when check_violation then
    reset role;
    raise notice 'PASS n1: 100%% + ate_independently + ABSENT is refused';
  end;

  -- 75% + unwell → an exception cannot carry a consumption reading
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(v_cls,
      jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
        'served_status','served','consumption_pct','75','low_intake_reason','unwell')),
      app_operational_date());
    reset role;
    raise exception 'FAIL n2: 75%% + unwell was accepted';
  exception when check_violation then
    reset role;
    raise notice 'PASS n2: 75%% + UNWELL is refused';
  end;

  -- 100% + did_not_like_it → a preference reason contradicts a full plate
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(v_cls,
      jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
        'served_status','served','consumption_pct','100','low_intake_reason','did_not_like_it')),
      app_operational_date());
    reset role;
    raise exception 'FAIL n3: 100%% + did_not_like_it was accepted';
  exception when check_violation then
    reset role;
    raise notice 'PASS n3: 100%% + DID_NOT_LIKE_IT is refused';
  end;

  -- NOT_SERVED + did_not_like_it → a not-served meal carries nothing
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(v_cls,
      jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
        'served_status','not_served','low_intake_reason','did_not_like_it')),
      app_operational_date());
    reset role;
    raise exception 'FAIL n4: NOT_SERVED + did_not_like_it was accepted';
  exception when check_violation then
    reset role;
    raise notice 'PASS n4: NOT_SERVED + DID_NOT_LIKE_IT is refused';
  end;

  -- 50% + distracted → a preference reason only applies at 0%/25%
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
    set local role authenticated;
    perform record_serving_batch(v_cls,
      jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
        'served_status','served','consumption_pct','50','low_intake_reason','distracted')),
      app_operational_date());
    reset role;
    raise exception 'FAIL n5: 50%% + distracted was accepted';
  exception when check_violation then
    reset role;
    raise notice 'PASS n5: 50%% + DISTRACTED is refused (reasons explain LOW intake)';
  end;

  -- the raw path is guarded too
  begin
    insert into serving_records (serving_date, class_id, student_id, period, served_status,
                                 consumption_pct, behavior, low_intake_reason, meal_service_id, recorded_by)
      values (app_operational_date(), v_cls, v_student, 'snack','served',
              100, 'ate_independently', 'absent', v_service, v_staff);
    raise exception 'FAIL n6: the raw path accepted 100%% + absent';
  exception when check_violation then
    raise notice 'PASS n6: the table constraint refuses a contradictory state on the raw path';
  end;

  -- ---- POSITIVES: every approved state -----------------------------
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  -- normal full intake, no reason
  select out_id into v_rec from record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','consumption_pct','100','behavior','ate_independently')),
    app_operational_date());
  -- low intake WITH a preference reason
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','consumption_pct','25','behavior','needed_encouragement',
      'low_intake_reason','did_not_like_it')),
    app_operational_date());
  -- low intake with NO reason: a reason is NOT mandatory (not invented)
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','consumption_pct','0','behavior','refused')),
    app_operational_date());
  -- consumption with NO behaviour: no mandatory-behaviour rule is invented
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','consumption_pct','50')),
    app_operational_date());
  -- each exception form
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','low_intake_reason','unwell')),
    app_operational_date());
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','served','low_intake_reason','sleeping')),
    app_operational_date());
  -- not served
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_student,'period','lunch',
      'served_status','not_served')),
    app_operational_date());
  reset role;
  raise notice 'PASS p1: every approved state records — incl. low intake with no reason';
  raise notice 'PASS p2: a low-intake reason and an eating behaviour both stay OPTIONAL';

  -- =================================================================
  -- ITEM 1 + 15 — the Parent free-text boundary, END TO END, on raw paths.
  -- =================================================================
  -- The classroom writes an INTERNAL note against the real record.
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  insert into serving_notes (serving_record_id, body) values (v_rec, 'INTERNAL: staff-only text')
    returning id into v_note;
  reset role;

  -- (a) the Parent cannot read the unpublished note through serving_notes.
  perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from serving_notes where id = v_note;
  reset role;
  if n <> 0 then raise exception 'FAIL s15a: a Parent read an UNPUBLISHED internal note (%)', n; end if;
  raise notice 'PASS s15a: a Parent cannot read an unpublished internal note';

  -- (b) ...nor through ANY legacy serving_records field. The retired `note`
  -- column is not even selectable by an API client any more, so an attempt to
  -- read it is refused outright rather than silently returning text.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
    set local role authenticated;
    select note into t from serving_records where id = v_rec;
    reset role;
    raise exception 'FAIL s15b: a Parent could SELECT the legacy serving_records.note column';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS s15b: the legacy serving_records.note column is not readable by a client';
  end;

  -- (c) a `select *` by a Parent is likewise refused, so no wildcard read can
  -- smuggle the legacy column out.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
    set local role authenticated;
    perform (select row_to_json(sr.*) from serving_records sr where sr.id = v_rec);
    reset role;
    raise exception 'FAIL s15c: a Parent could read every serving_records column';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS s15c: a wildcard read of serving_records is refused for a Parent';
  end;

  -- (d) the RPC no longer writes the legacy column at all.
  select note into t from serving_records where id = v_rec;
  if t is not null then raise exception 'FAIL s1d: record_serving_batch still wrote legacy note text (%)', t; end if;
  raise notice 'PASS s1d: record_serving_batch never writes the legacy note column';

  -- (e) the Super Admin administrative override publishes the reviewed text...
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  update serving_notes set body = 'Approved for the family', published_at = now() where id = v_note;
  get diagnostics n = row_count;
  reset role;
  if n <> 1 then raise exception 'FAIL s15e: the Super Admin override could not publish (%)', n; end if;

  -- (f) ...and ONLY then does the Parent see it — the approved text, nothing else.
  perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
  set local role authenticated;
  select body into t from serving_notes where id = v_note;
  reset role;
  if t is distinct from 'Approved for the family' then
    raise exception 'FAIL s15f: the Parent did not read exactly the published text (%)', t;
  end if;
  raise notice 'PASS s15e/f: only after publication does the Parent read exactly the approved text';

  -- (g) historical legacy text is PRESERVED, not destroyed — it lives in the
  -- archive, which no API role can read.
  insert into serving_record_note_archive (serving_record_id, note) values (v_rec, 'historical text');
  select count(*) into n from serving_record_note_archive where serving_record_id = v_rec;
  if n < 1 then raise exception 'FAIL s1g: the note archive did not retain history'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
    set local role authenticated;
    perform count(*) from serving_record_note_archive;
    reset role;
    raise exception 'FAIL s1g: a Parent could read the legacy note archive';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS s1g: history is preserved in an archive no API client can read';
  end;

  -- =================================================================
  -- ITEM 3 — the concern flag persists without touching anything else.
  -- =================================================================
  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  perform set_concern_observed(v_rec, true);
  reset role;
  select concern_observed, consumption_pct into b, n from serving_records where id = v_rec;
  if not b then raise exception 'FAIL s3: the concern flag did not persist'; end if;
  if n <> 75 then raise exception 'FAIL s3: setting the concern flag overwrote the meal result (%)', n; end if;
  raise notice 'PASS s3: the concern flag persists and no other meal-result field changes';

  -- a Parent may not set it.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
    set local role authenticated;
    perform set_concern_observed(v_rec, false);
    reset role;
    raise exception 'FAIL s3: a Parent flagged a concern';
  exception when check_violation then
    reset role;
    raise notice 'PASS s3: a Parent cannot set the concern flag';
  end;

  -- =================================================================
  -- 0035 ITEM 5 — the consumption distribution needs the SCORED denominator.
  --
  -- A valid, non-exception record can carry a BEHAVIOUR but no consumption
  -- reading. It belongs to the behavioural metrics and to none of the
  -- 100/75/50/25/0 buckets, so dividing the buckets by valid_observations made
  -- the five shares sum to less than 100%.
  -- =================================================================
  -- three more children in the same class, all eligible
  insert into students (student_no, institution_id, given_name, family_name, class_id, operational_status)
    values ('NP-D1', v_inst,'Dist','One', v_cls,'ACTIVE_BILLABLE_TO_NURSERY') returning id into v_d1;
  insert into students (student_no, institution_id, given_name, family_name, class_id, operational_status)
    values ('NP-D2', v_inst,'Dist','Two', v_cls,'ACTIVE_BILLABLE_TO_NURSERY') returning id into v_d2;
  insert into students (student_no, institution_id, given_name, family_name, class_id, operational_status)
    values ('NP-D3', v_inst,'Dist','Three', v_cls,'ACTIVE_BILLABLE_TO_NURSERY') returning id into v_d3;

  perform set_config('request.jwt.claims', json_build_object('sub',v_staff,'role','authenticated')::text, true);
  set local role authenticated;
  -- two SCORED rows...
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_d1,'period','lunch',
      'served_status','served','consumption_pct','100','behavior','ate_independently')),
    app_operational_date());
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_d2,'period','lunch',
      'served_status','served','consumption_pct','50')),
    app_operational_date());
  -- ...and one BEHAVIOUR-ONLY valid row: no consumption reading at all.
  perform record_serving_batch(v_cls,
    jsonb_build_array(jsonb_build_object('student_id',v_d3,'period','lunch',
      'served_status','served','behavior','needed_encouragement')),
    app_operational_date());
  reset role;

  -- Read the analytics view as the Super Admin (its own RLS gate).
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  select valid_observations, scored_observations,
         coalesce(ate_all_share,0) + coalesce(ate_most_share,0) + coalesce(ate_half_share,0)
           + coalesce(ate_some_share,0) + coalesce(ate_none_share,0)
    into v_valid, v_scored, v_share_total
    from v_meal_performance where dish_name = 'NP Meal' and period = 'lunch';
  reset role;

  if v_valid is null then raise exception 'FAIL d1: the meal did not appear in analytics'; end if;
  -- The behaviour-only row counts as VALID but is not SCORED.
  if v_scored >= v_valid then
    raise exception 'FAIL d1: scored (%) should be fewer than valid (%) — the behaviour-only row is unscored',
      v_scored, v_valid;
  end if;
  raise notice 'PASS d1: valid=% includes a behaviour-only row; scored=% excludes it', v_valid, v_scored;

  -- THE POINT: the five bands describe the scored population exactly.
  if v_share_total <> 100.0 then
    raise exception 'FAIL d2: the five consumption shares total %%%, not 100%% of the scored population', v_share_total;
  end if;
  raise notice 'PASS d2: the 100/75/50/25/0 shares total 100%% of the SCORED population';

  -- =================================================================
  -- ITEM 4 — Menu resizing is atomic; a REJECTED shrink loses nothing.
  -- =================================================================
  insert into rotations (name, week_count, active) values ('NP Rotation', 4, true) returning id into v_rot;
  insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id) values
    (v_rot, 1, 0, 'lunch', v_meal),
    (v_rot, 4, 0, 'lunch', v_meal);   -- this one falls outside a 2-week menu
  -- An institution anchored at week 4 makes a shrink to 2 weeks invalid.
  insert into institution_rotation_assignments (institution_id, rotation_id, anchor_week, effective_from)
    values (v_inst, v_rot, 4, app_operational_date());

  begin
    perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
    set local role authenticated;
    perform set_rotation_week_count(v_rot, 2);
    reset role;
    raise exception 'FAIL s4: an invalid shrink was allowed';
  exception when check_violation then
    reset role;
    raise notice 'PASS s4: a shrink that would strand an anchored institution is refused';
  end;

  -- THE POINT: the refusal must not have destroyed the out-of-range slots.
  select count(*) into n from rotation_slots where rotation_id = v_rot;
  if n <> 2 then raise exception 'FAIL s4: a REJECTED shrink destroyed meal slots (% left of 2)', n; end if;
  select week_count into n from rotations where id = v_rot;
  if n <> 4 then raise exception 'FAIL s4: a rejected shrink still changed week_count (%)', n; end if;
  raise notice 'PASS s4: a rejected shrink leaves every meal slot and the week count unchanged';

  -- A legitimate shrink (after re-anchoring) removes the out-of-range slot and
  -- resizes together.
  update institution_rotation_assignments set anchor_week = 1 where rotation_id = v_rot;
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  perform set_rotation_week_count(v_rot, 2);
  reset role;
  select count(*) into n from rotation_slots where rotation_id = v_rot;
  if n <> 1 then raise exception 'FAIL s4: the valid shrink did not remove the out-of-range slot (%)', n; end if;
  select week_count into n from rotations where id = v_rot;
  if n <> 2 then raise exception 'FAIL s4: the valid shrink did not resize (%)', n; end if;
  raise notice 'PASS s4: a valid shrink removes out-of-range slots and resizes atomically';

  -- The invariant cannot be broken from the raw path either.
  begin
    insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id)
      values (v_rot, 9, 0, 'lunch', v_meal);
    raise exception 'FAIL s4: a slot beyond week_count was accepted';
  exception when check_violation then
    raise notice 'PASS s4: rotation_slots.week_number cannot exceed rotations.week_count';
  end;
  begin
    update rotations set week_count = 1 where id = v_rot;   -- slot at week 1 only, so this is fine
    update rotations set week_count = 0 where id = v_rot;   -- below the minimum
    raise exception 'FAIL s4: week_count 0 was accepted';
  exception when check_violation then
    raise notice 'PASS s4: the rotation week-count invariant holds on raw updates';
  end;

  -- =================================================================
  -- ITEM 14 — archive, not hard delete, for entities that have `active`.
  -- =================================================================
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    delete from meals where id = v_meal;
    reset role;
    raise exception 'FAIL s14: a Super Admin hard-deleted a Meal';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS s14: Meals cannot be hard-deleted by any client';
  end;

  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    delete from rotations where id = v_rot;
    reset role;
    raise exception 'FAIL s14: a Super Admin hard-deleted a Menu';
  exception when insufficient_privilege then
    reset role;
    raise notice 'PASS s14: Menus/Rotations cannot be hard-deleted by any client';
  end;

  -- ...but the approved archive action still works.
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  update meals set active = false where id = v_meal;
  get diagnostics n = row_count;
  reset role;
  if n <> 1 then raise exception 'FAIL s14: archiving a Meal was blocked (%)', n; end if;
  raise notice 'PASS s14: the approved archive/deactivate action still works';

  -- Genuinely implemented configuration deletes are untouched.
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);
  set local role authenticated;
  delete from rotation_slots where rotation_id = v_rot;
  reset role;
  raise notice 'PASS s14: clearing a Menu slot (a real configuration action) still works';

  raise notice '---------------------------------------------------------';
  raise notice 'NOTE PRIVACY / STATES: parent free-text boundary, record states,';
  raise notice 'concern flag, atomic resize and archive-only lifecycle verified.';
end $$;
rollback;
