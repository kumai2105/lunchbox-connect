-- =====================================================================
-- Item 1 — future published Meal Services are genuinely manageable, while
-- served history is immutable. One transaction, ROLLBACK.
--
--   publish future date → add Override → republish → future Meal changes
--   publish future date → add Closure  → republish → future Meal disappears
--   historical served date → republish → historical Meal revision unchanged
-- =====================================================================
begin;
do $$
declare
  v_super uuid := '00000000-0000-0000-0000-0000000000a1';
  v_rot uuid := '00000000-0000-4000-8000-000000000171';  -- backfill's rotation
  v_inst uuid; v_class uuid; v_student uuid;
  v_base date := date_trunc('week', current_date)::date;   -- this week's Monday
  v_past_mon date; v_fut_mon date; v_fut_tue date;
  v_mealB uuid; v_revB uuid;
  v_svc_past uuid; v_past_rev_before uuid; v_past_rev_after uuid;
  v_svc_fut uuid; v_fut_rev_before uuid; v_fut_rev_after uuid;
  n int;
begin
  v_past_mon := v_base - 7;   -- last week's Monday (strictly past)
  v_fut_mon  := v_base + 7;   -- next Monday  (weekday 0, has slots)
  v_fut_tue  := v_base + 8;   -- next Tuesday (weekday 1, has slots)

  insert into institutions (name, kind) values ('ZZ PF Nursery','nursery') returning id into v_inst;
  insert into classes (institution_id, name, grade) values (v_inst,'PF Class','T') returning id into v_class;
  insert into students (student_no, institution_id, given_name, family_name, class_id,
                        enrollment_status, operational_status)
    values ('PF-1', v_inst,'Kid','PF', v_class,'enrolled','ACTIVE_BILLABLE_TO_NURSERY')
    returning id into v_student;

  -- legacy menus -> backfill builds the meal library + rotation template
  insert into menus (week_number, weekday, period, dish_name, published)
    select w, dd, p::app_period, 'ZZ PF W'||w||'D'||dd||'-'||p, true
    from generate_series(1,2) w cross join generate_series(0,4) dd
    cross join unnest(array['breakfast','lunch']) p;
  perform backfill_legacy_menus();

  -- effective_from must precede every test date (incl. last week's Monday), or
  -- resolve_meal returns nothing before the assignment begins.
  insert into institution_rotation_assignments (institution_id, rotation_id, effective_from, anchor_week)
    values (v_inst, v_rot, v_base - 14, 1);
  insert into institution_service_plans (institution_id, periods, effective_from)
    values (v_inst, array['breakfast','lunch']::app_period[], v_base - 14);

  -- The Override meal (a distinct Meal with its own current revision).
  insert into meals (name) values ('ZZ PF Override Meal') returning id into v_mealB;
  insert into meal_revisions (meal_id, revision_no, name)
    values (v_mealB, 1, 'ZZ PF Override Meal') returning id into v_revB;
  update meals set current_revision_id = v_revB where id = v_mealB;

  -- Publish an initial window spanning last week's Monday .. next Tuesday.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_super, 'role','authenticated')::text, true);
  perform publish_meal_services(v_inst, v_past_mon, v_fut_tue);

  select id, meal_revision_id into v_svc_past, v_past_rev_before
    from meal_services where institution_id = v_inst and service_date = v_past_mon and period = 'lunch';
  select id, meal_revision_id into v_svc_fut, v_fut_rev_before
    from meal_services where institution_id = v_inst and service_date = v_fut_mon and period = 'lunch';
  if v_svc_past is null or v_svc_fut is null then
    raise exception 'FAIL setup: expected published lunch services on % and %', v_past_mon, v_fut_mon;
  end if;

  -- Lock the PAST service with a served Classroom record (historical truth).
  insert into serving_records (serving_date, class_id, student_id, period, served_status,
                               consumption_pct, behavior, concern_observed, meal_service_id, recorded_by)
    values (v_past_mon, v_class, v_student, 'lunch','served', 75,'ate_independently', false,
            v_svc_past, v_super);

  -- Overrides: future Monday AND past Monday both point at the Override meal.
  insert into calendar_exceptions (institution_id, kind, date_from, date_to, period, meal_id)
    values (v_inst,'override', v_fut_mon, v_fut_mon, 'lunch', v_mealB),
           (v_inst,'override', v_past_mon, v_past_mon,'lunch', v_mealB);
  -- Closure: future Tuesday lunch.
  insert into calendar_exceptions (institution_id, kind, date_from, date_to, period)
    values (v_inst,'closure', v_fut_tue, v_fut_tue, 'lunch');

  -- Republish the same window.
  perform publish_meal_services(v_inst, v_past_mon, v_fut_tue);

  -- (1) Future Override took effect: the future service now serves the Override revision.
  select meal_revision_id into v_fut_rev_after
    from meal_services where id = v_svc_fut;
  if v_fut_rev_after is distinct from v_revB then
    raise exception 'FAIL item1: future Override did not take effect (rev % expected %)', v_fut_rev_after, v_revB;
  end if;
  raise notice 'PASS item1: publish → override → republish changes the future Meal';

  -- (2) Future Closure removed the service entirely.
  select count(*) into n from meal_services
   where institution_id = v_inst and service_date = v_fut_tue and period = 'lunch';
  if n <> 0 then
    raise exception 'FAIL item1: future Closure did not remove the future Meal Service (% rows)', n;
  end if;
  raise notice 'PASS item1: publish → closure → republish removes the future Meal';

  -- (3) Historical served service is untouched despite an override on its date.
  select meal_revision_id into v_past_rev_after from meal_services where id = v_svc_past;
  if v_past_rev_after is distinct from v_past_rev_before then
    raise exception 'FAIL item1: a served historical Meal Service was rewritten (% -> %)',
      v_past_rev_before, v_past_rev_after;
  end if;
  if v_past_rev_after = v_revB then
    raise exception 'FAIL item1: the override leaked onto the locked historical service';
  end if;
  raise notice 'PASS item1: a historical served date is never rewritten by republish';

  raise notice '---------------------------------------------------------';
  raise notice 'PUBLISH FUTURE: overrides/closures apply forward, history is immutable.';
end $$;
rollback;
