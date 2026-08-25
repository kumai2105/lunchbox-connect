-- =====================================================================
-- OPERATIONAL SPINE — SCENARIOS AND BOUNDARIES
--
-- The remaining named cases: two delivery runs (§78), the effective-dated Plan
-- change (§80), a special Meal missing at handover (§79), and the authorization
-- boundaries for every new domain (§76).
--
-- Self-contained disposable fixture, one transaction, ROLLBACK.
-- =====================================================================
begin;
do $$
declare
  v_super uuid; v_inst uuid; v_other uuid; v_class uuid;
  v_morning uuid; v_full uuid; v_meal uuid; v_alt uuid;
  v_svc_b uuid; v_svc_s uuid; v_svc_l uuid; v_svc_p uuid;
  v_fd_b uuid; v_fd_s uuid; v_fd_l uuid; v_fd_p uuid;
  v_m1 uuid; v_m2 uuid; v_cfg uuid;
  v_driver uuid; v_admin uuid; v_parent uuid; v_kitchen uuid; v_other_admin uuid;
  v_kid uuid;
  v_stu uuid; v_req uuid; v_line uuid; v_issue uuid;
  n bigint; q bigint;
begin
  select user_id into v_super from app_users where role='super_admin' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);

  insert into institutions (name,kind) values ('ZZ SCN A','nursery') returning id into v_inst;
  insert into institutions (name,kind) values ('ZZ SCN B','nursery') returning id into v_other;
  insert into classes (institution_id,name,grade) values (v_inst,'ZZ Scn Class','KG1')
    returning id into v_class;
  insert into institution_service_plans (institution_id,periods,effective_from)
    values (v_inst, array['breakfast','snack','lunch','afternoon_snack']::app_period[],
            current_date - 60);
  insert into institution_service_plans (institution_id,periods,effective_from)
    values (v_other, array['breakfast','lunch']::app_period[], current_date - 60);

  -- A Kitchen account must belong to a Kitchen (app_users_kitchen_needs_kitchen).
  insert into kitchens (name) values ('ZZ Scn Kitchen Site') returning id into v_kid;

  -- Generated ids, NOT hard-coded ones. A fixed UUID collided with a row another
  -- suite had already committed, and `on conflict do nothing` then silently kept
  -- the OTHER row — so this fixture's "driver" was actually a super_admin and the
  -- failure surfaced far away from its cause. Generating them cannot collide.
  v_driver := gen_random_uuid();
  v_admin  := gen_random_uuid();
  v_parent := gen_random_uuid();
  v_kitchen := gen_random_uuid();
  v_other_admin := gen_random_uuid();

  insert into auth.users (id,email) values
    (v_driver,'zz.scn.driver@zz.test'), (v_admin,'zz.scn.admin@zz.test'),
    (v_parent,'zz.scn.parent@zz.test'), (v_kitchen,'zz.scn.kitchen@zz.test'),
    (v_other_admin,'zz.scn.otheradmin@zz.test');
  insert into app_users (user_id,role,full_name,email,institution_id,kitchen_id) values
    (v_driver,'driver','ZZ Scn Driver','zz.scn.driver@zz.test',null,null),
    (v_admin,'school_admin','ZZ Scn Admin','zz.scn.admin@zz.test',v_inst,null),
    (v_parent,'parent','ZZ Scn Parent','zz.scn.parent@zz.test',null,null),
    (v_kitchen,'kitchen','ZZ Scn Kitchen','zz.scn.kitchen@zz.test',null,v_kid),
    (v_other_admin,'school_admin','ZZ Scn Other','zz.scn.otheradmin@zz.test',v_other,null);

  v_meal := save_meal(null,'ZZ Scn Standard',null,null,null,null,null);
  v_alt  := save_meal(null,'ZZ Scn Alternative',null,null,null,null,null);

  insert into students (student_no,institution_id,class_id,given_name,family_name,
                        enrollment_status,operational_status)
    select 'ZZS'||g, v_inst, v_class, 'Child', g::text, 'enrolled',
           'ACTIVE_BILLABLE_TO_NURSERY' from generate_series(1,10) g;

  insert into meal_services (institution_id,service_date,period,meal_revision_id,published,published_at)
    values (v_inst,current_date,'breakfast',(select current_revision_id from meals where id=v_meal),true,now()),
           (v_inst,current_date,'snack',(select current_revision_id from meals where id=v_meal),true,now()),
           (v_inst,current_date,'lunch',(select current_revision_id from meals where id=v_meal),true,now()),
           (v_inst,current_date,'afternoon_snack',(select current_revision_id from meals where id=v_meal),true,now());
  select id into v_svc_b from meal_services where institution_id=v_inst and period='breakfast';
  select id into v_svc_s from meal_services where institution_id=v_inst and period='snack';
  select id into v_svc_l from meal_services where institution_id=v_inst and period='lunch';
  select id into v_svc_p from meal_services where institution_id=v_inst and period='afternoon_snack';

  set local role authenticated;

  v_morning := save_meal_plan(null,'ZZ Scn Morning', array['breakfast','snack']::app_period[]);
  v_full    := save_meal_plan(null,'ZZ Scn Full',
                 array['breakfast','snack','lunch','afternoon_snack']::app_period[]);
  perform set_institution_meal_plans(v_inst, array[v_morning, v_full]);
  perform bulk_assign_student_meal_plan(
    array(select id from students where institution_id=v_inst), v_full, current_date - 30);
  perform activate_student_meal_plans(v_inst, current_date - 30);

  -- ================================================== §80 PLAN CHANGE
  -- One child moves Morning → Full at a date boundary. Yesterday must keep its
  -- meaning; tomorrow must take the new one.
  select id into v_stu from students where student_no='ZZS1';
  perform assign_student_meal_plan(v_stu, v_morning, current_date - 10);

  if app_student_entitled(v_stu, current_date - 5, 'lunch') then
    raise exception 'FAIL a Morning-plan child was entitled to lunch';
  end if;
  if not app_student_entitled(v_stu, current_date - 5, 'breakfast') then
    raise exception 'FAIL a Morning-plan child was not entitled to breakfast';
  end if;
  raise notice 'PASS c1: while on the Morning Plan, Lunch is not theirs and Breakfast is';

  -- The change is scheduled forward; history is not rewritten.
  perform assign_student_meal_plan(v_stu, v_full, current_date);
  if app_student_entitled(v_stu, current_date - 5, 'lunch') then
    raise exception 'FAIL scheduling a future Plan rewrote a past date';
  end if;
  if not app_student_entitled(v_stu, current_date, 'lunch') then
    raise exception 'FAIL the new Plan did not take effect on its own date';
  end if;
  select count(*) into n from student_meal_plans
   where student_id=v_stu and effective_until = current_date - 1;
  if n <> 1 then raise exception 'FAIL the previous assignment was not closed cleanly'; end if;
  raise notice 'PASS c2: a Plan change takes effect forward and leaves history truthful';

  -- ============================================ §78 TWO DELIVERY RUNS
  -- Same entitlement, same totals — only the transport grouping differs.
  select total_required into q from meal_production_demand(current_date) where meal_service_id=v_svc_l;
  if q <> 10 then raise exception 'FAIL lunch before delivery config % (want 10)', q; end if;

  v_fd_b := finalize_demand(v_svc_b);
  v_fd_s := finalize_demand(v_svc_s);
  v_fd_l := finalize_demand(v_svc_l);
  v_fd_p := finalize_demand(v_svc_p);

  v_cfg := set_delivery_config(v_inst, current_date, 2::smallint, 'Main reception',
    '[{"run":1,"from":"07:00","to":"08:30"},{"run":2,"from":"11:00","to":"12:30"}]'::jsonb,
    '{"breakfast":1,"snack":1,"lunch":2,"afternoon_snack":2}'::jsonb);
  perform build_manifests(v_inst, current_date);

  select id into v_m1 from delivery_manifests
   where institution_id=v_inst and service_date=current_date and run_number=1;
  select id into v_m2 from delivery_manifests
   where institution_id=v_inst and service_date=current_date and run_number=2;
  if v_m1 is null or v_m2 is null then raise exception 'FAIL two runs did not produce two manifests'; end if;

  select count(*) into n from manifest_lines where manifest_id=v_m1;
  if n <> 2 then raise exception 'FAIL run 1 carries % lines (want breakfast + snack)', n; end if;
  select count(*) into n from manifest_lines where manifest_id=v_m2;
  if n <> 2 then raise exception 'FAIL run 2 carries % lines (want lunch + afternoon snack)', n; end if;

  -- No period on both runs, and none missing.
  select count(*) into n from manifest_lines ml
    join delivery_manifests dm on dm.id = ml.manifest_id
   where dm.institution_id=v_inst and dm.service_date=current_date;
  if n <> 4 then raise exception 'FAIL % manifest lines across both runs (want 4)', n; end if;
  select count(distinct period) into n from manifest_lines ml
    join delivery_manifests dm on dm.id = ml.manifest_id
   where dm.institution_id=v_inst and dm.service_date=current_date;
  if n <> 4 then raise exception 'FAIL % distinct periods (want 4, each exactly once)', n; end if;

  -- The total quantity is unchanged by splitting the transport.
  select sum(total_quantity) into q from manifest_lines ml
    join delivery_manifests dm on dm.id = ml.manifest_id
   where dm.institution_id=v_inst and dm.service_date=current_date;
  if q <> 40 then raise exception 'FAIL total across two runs % (want 40 = 10x4)', q; end if;
  raise notice 'PASS t1: two runs carry each period exactly once, and the same 40 Meals';

  -- Run 1 completes independently of run 2.
  perform start_production(v_fd_b); perform complete_production(v_fd_b);
  perform start_packing(v_fd_b);    perform complete_packing(v_fd_b);
  perform start_production(v_fd_s); perform complete_production(v_fd_s);
  perform start_packing(v_fd_s);    perform complete_packing(v_fd_s);
  perform assign_manifest_driver(v_m1, v_driver);
  perform release_manifest(v_m1);
  perform set_delivery_receiver(v_inst, v_admin, true);

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_driver,'role','authenticated')::text, true);
  perform driver_confirm_collection(v_m1);
  perform driver_confirm_arrival(v_m1);
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  perform confirm_handover(v_m1);

  if (select state from delivery_manifests where id=v_m2) = 'HANDED_OVER' then
    raise exception 'FAIL run 2 was handed over by run 1 completing';
  end if;
  if (select state from delivery_manifests where id=v_m1) <> 'HANDED_OVER' then
    raise exception 'FAIL run 1 did not reach handover';
  end if;
  raise notice 'PASS t2: run 1 completes handover independently of run 2';

  -- ===================================== §79 SPECIAL MEAL MISSING AT HANDOVER
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);
  select id into v_stu from students where student_no='ZZS2';
  v_req := submit_dietary_requirement(v_stu,'ALLERGY','No sesame.','Institution form');
  perform review_dietary_requirement(v_req,'APPROVED');
  perform resolve_special_meal(v_stu, v_svc_p, 'ALTERNATIVE_ASSIGNED',
            (select current_revision_id from meals where id=v_alt), 'No sesame');

  -- The snapshot for afternoon snack predates the resolution, so it drifts —
  -- which is itself the correct behaviour, and is adjusted deliberately.
  v_fd_p := adjust_final_demand(v_fd_p, 'Special meal assigned after finalisation');
  select special_quantity into q from final_demand where id=v_fd_p;
  if q <> 1 then raise exception 'FAIL adjusted snapshot special % (want 1)', q; end if;
  select total_quantity into q from final_demand where id=v_fd_p;
  if q <> 10 then raise exception 'FAIL adjusted total % (want 10 — replacement, not addition)', q; end if;
  raise notice 'PASS x1: a late special Meal replaces rather than adds (9 + 1 = 10)';

  perform start_production(v_fd_p);
  select id into v_line from final_demand_special_lines where final_demand_id=v_fd_p;
  perform confirm_special_produced(v_line);
  perform complete_production(v_fd_p);
  perform start_packing(v_fd_p);
  perform confirm_special_packed(v_line);
  perform complete_packing(v_fd_p);
  perform start_production(v_fd_l); perform complete_production(v_fd_l);
  perform start_packing(v_fd_l);    perform complete_packing(v_fd_l);

  perform build_manifests(v_inst, current_date);
  perform assign_manifest_driver(v_m2, v_driver);
  perform release_manifest(v_m2);
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_driver,'role','authenticated')::text, true);
  perform driver_confirm_collection(v_m2);
  perform driver_confirm_arrival(v_m2);

  -- The receiver reports the special Meal missing and accepts custody anyway.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  v_issue := report_operational_issue('DELIVERY','Missing Special Meal',
    'The sesame-free afternoon snack was not in the delivery.', v_inst, current_date,
    null, v_m2, v_line);
  perform confirm_handover(v_m2, true);

  select handover_with_issue into q from (
    select case when handover_with_issue then 1 else 0 end from delivery_manifests where id=v_m2
  ) t(handover_with_issue);
  if q <> 1 then raise exception 'FAIL handover did not record the open issue'; end if;
  select count(*) into n from operational_issues where id=v_issue and status='OPEN';
  if n <> 1 then raise exception 'FAIL the delivery issue did not stay open'; end if;
  raise notice 'PASS x2: accepting custody with an issue records both, and closes neither';

  -- The standard Meal is NOT silently substituted: the resolution still names
  -- the alternative, so nothing downstream can quietly serve the standard one.
  select count(*) into n from special_meal_resolutions
   where student_id=v_stu and meal_service_id=v_svc_p and resolution='ALTERNATIVE_ASSIGNED';
  if n <> 1 then raise exception 'FAIL the special Meal decision was lost'; end if;
  raise notice 'PASS x3: a missing special Meal never becomes the standard Meal';

  -- Day closure is allowed with the issue open, because custody was accepted.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);
  perform close_operational_day(current_date, 'One open delivery issue carried forward');
  select count(*) into n from operational_issues where id=v_issue and status='OPEN';
  if n <> 1 then raise exception 'FAIL closing the day silently closed the issue'; end if;
  raise notice 'PASS x4: the day closes; the accepted issue stays open and visible';

  -- ==================================================== §76 BOUNDARIES
  -- Institution Admin: may submit for its own child, never for another site's,
  -- and may never approve.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_other_admin,'role','authenticated')::text, true);
  begin
    perform submit_dietary_requirement(v_stu,'ALLERGY','Cross-institution attempt.');
    raise exception 'FAIL an Institution Admin submitted for another institution''s child';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS b1: an Institution Admin cannot submit for another institution';

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  begin
    perform review_dietary_requirement(v_req,'APPROVED');
    raise exception 'FAIL an Institution Admin approved a dietary requirement';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform resolve_special_meal(v_stu, v_svc_l, 'STANDARD_CONFIRMED');
    raise exception 'FAIL an Institution Admin decided what a child is served';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform finalize_demand(v_svc_l);
    raise exception 'FAIL an Institution Admin finalised demand';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS b2: an Institution Admin may not approve, resolve or finalise';

  -- Institution Admin sees no LunchBox production planning.
  select count(*) into n from final_demand;
  if n <> 0 then raise exception 'FAIL an Institution Admin read % final_demand rows', n; end if;
  select count(*) into n from production_runs;
  if n <> 0 then raise exception 'FAIL an Institution Admin read % production runs', n; end if;
  raise notice 'PASS b3: Kitchen production planning is not an Institution capability';

  -- Kitchen: may not approve requirements, and sees no Parent linkage.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_kitchen,'role','authenticated')::text, true);
  begin
    perform review_dietary_requirement(v_req,'APPROVED');
    raise exception 'FAIL the Kitchen approved a dietary requirement';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  select count(*) into n from student_parents;
  if n <> 0 then raise exception 'FAIL the Kitchen read % guardian links', n; end if;
  -- and its special-meal view carries a minimal child label, not a full profile
  select count(*) into n from kitchen_special_meals(current_date)
   where child_label like '%.' ;
  if n < 1 then raise exception 'FAIL the Kitchen special-meal view is not minimised'; end if;
  raise notice 'PASS b4: the Kitchen approves nothing and sees no guardian data';

  -- Driver: own manifests only, and no student or parent data.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_driver,'role','authenticated')::text, true);
  select count(*) into n from delivery_manifests;
  if n <> 2 then raise exception 'FAIL a Driver sees % manifests (want only their own 2)', n; end if;
  select count(*) into n from students;
  if n <> 0 then raise exception 'FAIL a Driver read % student rows', n; end if;
  select count(*) into n from student_meal_plans;
  if n <> 0 then raise exception 'FAIL a Driver read % Meal Plan assignments', n; end if;
  raise notice 'PASS b5: a Driver sees only assigned deliveries, and no child data';

  -- Parent: own child only, and no logistics at all.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_parent,'role','authenticated')::text, true);
  select count(*) into n from delivery_manifests;
  if n <> 0 then raise exception 'FAIL a Parent read % manifests', n; end if;
  select count(*) into n from final_demand;
  if n <> 0 then raise exception 'FAIL a Parent read % production rows', n; end if;
  select count(*) into n from operational_issues;
  if n <> 0 then raise exception 'FAIL a Parent read % operational issues', n; end if;
  select count(*) into n from student_dietary_requirements;
  if n <> 0 then raise exception 'FAIL a Parent read % internal requirement records', n; end if;
  select count(*) into n from meal_plans;
  if n <> 0 then raise exception 'FAIL a Parent read the Meal Plan catalogue (%)', n; end if;
  raise notice 'PASS b6: a Parent sees no logistics, no production and no review record';

  reset role;
  raise notice '---------------------------------------------------------';
  raise notice 'SPINE SCENARIOS: plan changes, two-run delivery, a missing';
  raise notice 'special meal and every new authorization boundary hold.';
end $$;
rollback;
