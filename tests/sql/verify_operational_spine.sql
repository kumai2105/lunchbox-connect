-- =====================================================================
-- OPERATIONAL SPINE — Student Meal Plan entitlement through to handover.
--
-- The assertions the release order names explicitly (§75/§77/§78/§79/§80),
-- proved against the real functions rather than against a mock. One
-- transaction, ROLLBACK, so it leaves nothing behind.
--
-- The fixture is staged on the OWNER path where the object under test is not
-- the write authority — the same convention verify_kitchen_demand uses, and for
-- the same reason: publication and seeding are not what these assertions are
-- about, and staging them as a client would test the fixture instead of the rule.
-- =====================================================================
begin;
do $$
declare
  v_super uuid; v_inst uuid; v_inst2 uuid; v_class uuid;
  v_morning uuid; v_full uuid; v_meal uuid; v_alt uuid;
  v_svc_b uuid; v_svc_s uuid; v_svc_l uuid; v_svc_p uuid;
  v_fd uuid; v_mid uuid; v_mid2 uuid;
  v_driver uuid; v_recv uuid; v_admin uuid; v_other_admin uuid;
  n bigint; q bigint; v_req uuid; v_stu uuid; v_line uuid; v_cfg uuid; v_ok boolean;
begin
  select user_id into v_super from app_users where role='super_admin' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);

  -- ---------------------------------------------------------------- fixture
  insert into institutions (name,kind) values ('ZZ SPINE A','nursery') returning id into v_inst;
  insert into institutions (name,kind) values ('ZZ SPINE B','nursery') returning id into v_inst2;
  insert into classes (institution_id,name,grade) values (v_inst,'ZZ Spine Class','KG1')
    returning id into v_class;
  insert into institution_service_plans (institution_id,periods,effective_from)
    values (v_inst, array['breakfast','snack','lunch','afternoon_snack']::app_period[],
            current_date - 30);
  insert into institution_service_plans (institution_id,periods,effective_from)
    values (v_inst2, array['breakfast','lunch']::app_period[], current_date - 30);

  -- Disposable people of this suite's own, with GENERATED ids. A hard-coded
  -- UUID can collide with a row another suite committed, and `on conflict do
  -- nothing` would then silently keep that row instead — giving this fixture a
  -- "driver" that is really a super_admin.
  v_driver := gen_random_uuid();
  v_admin  := gen_random_uuid();
  v_recv   := gen_random_uuid();

  insert into auth.users (id,email) values
    (v_driver,'zz.spine.driver@zz.test'), (v_admin,'zz.spine.admin@zz.test'),
    (v_recv,'zz.spine.parent@zz.test');
  insert into app_users (user_id,role,full_name,email,institution_id) values
    (v_driver,'driver','ZZ Spine Driver','zz.spine.driver@zz.test',null),
    (v_admin,'school_admin','ZZ Spine Admin','zz.spine.admin@zz.test',v_inst),
    (v_recv,'parent','ZZ Spine Parent','zz.spine.parent@zz.test',null);

  v_meal := save_meal(null,'ZZ Spine Chicken Curry',null,null,null,null,null);
  v_alt  := save_meal(null,'ZZ Spine Dairy-Free Curry',null,null,null,null,null);

  -- 120 children: 40 morning-only, 80 full.
  insert into students (student_no,institution_id,class_id,given_name,family_name,
                        enrollment_status,operational_status)
    select 'ZZM'||g, v_inst, v_class, 'Morning', g::text, 'enrolled',
           'ACTIVE_BILLABLE_TO_NURSERY' from generate_series(1,40) g;
  insert into students (student_no,institution_id,class_id,given_name,family_name,
                        enrollment_status,operational_status)
    select 'ZZF'||g, v_inst, v_class, 'Full', g::text, 'enrolled',
           'ACTIVE_BILLABLE_TO_NURSERY' from generate_series(1,80) g;

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

  -- ============================================================ MEAL PLANS
  v_morning := save_meal_plan(null,'ZZ Morning Plan', array['breakfast','snack']::app_period[]);
  v_full    := save_meal_plan(null,'ZZ Full Plan',
                 array['breakfast','snack','lunch','afternoon_snack']::app_period[]);
  perform set_institution_meal_plans(v_inst, array[v_morning, v_full]);

  -- p1: a Plan may only use the existing period enum, and needs at least one.
  begin
    perform save_meal_plan(null,'ZZ Empty Plan', array[]::app_period[]);
    raise exception 'FAIL a Meal Plan with no periods was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS p1: a Meal Plan must include at least one Meal Period';

  -- p2: legacy demand is untouched before enforcement. 120 children, no Plans
  -- assigned at all, and Lunch still reads 120 exactly as it did pre-0048.
  select total_required into q from meal_production_demand(current_date)
   where meal_service_id = v_svc_l;
  if q <> 120 then raise exception 'FAIL pre-enforcement lunch demand % (want 120)', q; end if;
  select plan_enforced into v_ok from meal_production_demand(current_date)
   where meal_service_id = v_svc_l;
  if v_ok then raise exception 'FAIL plan_enforced true before activation'; end if;
  raise notice 'PASS p2: before enforcement, demand keeps its existing verified meaning (120)';

  -- p3: activation REFUSES while any served child lacks a Plan.
  begin
    perform activate_student_meal_plans(v_inst, current_date);
    raise exception 'FAIL activation succeeded with 120 unplanned Students';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  select count(*) into n from institution_plan_readiness(v_inst, current_date);
  if n <> 120 then raise exception 'FAIL readiness listed % gaps (want 120)', n; end if;
  raise notice 'PASS p3: activation refuses, and names all 120 incomplete Students';

  -- assign the mixed plans
  perform bulk_assign_student_meal_plan(
    array(select id from students where institution_id=v_inst and given_name='Morning'),
    v_morning, current_date - 7);
  perform bulk_assign_student_meal_plan(
    array(select id from students where institution_id=v_inst and given_name='Full'),
    v_full, current_date - 7);

  -- p4: no overlapping effective assignments (the exclusion constraint).
  select id into v_stu from students where institution_id=v_inst and student_no='ZZM1';
  begin
    insert into student_meal_plans (student_id, meal_plan_id, effective_from)
      values (v_stu, v_full, current_date - 3);
    raise exception 'FAIL overlapping Meal Plan assignment was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS p4: a Student cannot hold two effective Meal Plans on one date';

  -- p5: a Plan unavailable at the institution cannot be assigned.
  begin
    perform assign_student_meal_plan(
      (select id from students where institution_id=v_inst2 limit 1), v_full, current_date);
    raise exception 'FAIL assigned a Plan not available at that institution';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS p5: a Meal Plan must be available at the Student''s institution';

  -- p6: a retired Plan takes no new assignment.
  perform retire_meal_plan(v_morning, false);
  begin
    perform assign_student_meal_plan(v_stu, v_morning, current_date + 30);
    raise exception 'FAIL a retired Meal Plan accepted a new assignment';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform retire_meal_plan(v_morning, true);
  raise notice 'PASS p6: a retired Meal Plan accepts no new assignment';

  -- ==================================================== THE 120/40/80 CASE
  perform activate_student_meal_plans(v_inst, current_date);

  select total_required into q from meal_production_demand(current_date) where meal_service_id=v_svc_b;
  if q <> 120 then raise exception 'FAIL breakfast % (want 120)', q; end if;
  select total_required into q from meal_production_demand(current_date) where meal_service_id=v_svc_s;
  if q <> 120 then raise exception 'FAIL morning snack % (want 120)', q; end if;
  select total_required into q from meal_production_demand(current_date) where meal_service_id=v_svc_l;
  if q <> 80 then raise exception 'FAIL lunch % (want 80)', q; end if;
  select total_required into q from meal_production_demand(current_date) where meal_service_id=v_svc_p;
  if q <> 80 then raise exception 'FAIL afternoon snack % (want 80)', q; end if;
  raise notice 'PASS d1: mixed plans give exactly 120 / 120 / 80 / 80';

  -- d2: the 40 morning-only children contribute ZERO to lunch — they are not
  -- absent, not 0%, not incomplete. They are simply not on that service.
  select count(*) into n from service_roster(v_svc_l)
   where entitled and student_no like 'ZZM%';
  if n <> 0 then raise exception 'FAIL % morning-only Students entitled to lunch', n; end if;
  select count(*) into n from service_roster(v_svc_l) where entitled;
  if n <> 80 then raise exception 'FAIL lunch roster entitled % (want 80)', n; end if;
  raise notice 'PASS d2: an unentitled Student contributes zero and is not a missed meal';

  -- d3: an inactive Student contributes zero.
  update students set operational_status = null where student_no = 'ZZF1';
  select total_required into q from meal_production_demand(current_date) where meal_service_id=v_svc_l;
  if q <> 79 then raise exception 'FAIL lunch after deactivating one child % (want 79)', q; end if;
  update students set operational_status = 'ACTIVE_BILLABLE_TO_NURSERY' where student_no = 'ZZF1';
  raise notice 'PASS d3: an operationally inactive Student contributes zero';

  -- ============================================== DIETARY / SPECIAL MEALS
  select id into v_stu from students where student_no = 'ZZF2';
  v_req := submit_dietary_requirement(v_stu,'ALLERGY','No dairy in any meal.','Institution form');

  -- s1: an unreviewed requirement does not yet block; an APPROVED one does.
  perform review_dietary_requirement(v_req,'APPROVED','Confirmed with the nursery.');
  begin
    perform finalize_demand(v_svc_l);
    raise exception 'FAIL finalised with an unresolved approved requirement';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  select count(*) into n from unresolved_meal_decisions(v_svc_l);
  if n <> 1 then raise exception 'FAIL unresolved decisions % (want 1)', n; end if;
  raise notice 'PASS s1: an unresolved approved requirement blocks finalisation';

  -- s2: the alternative must be a real Meal Library revision.
  begin
    perform resolve_special_meal(v_stu, v_svc_l, 'ALTERNATIVE_ASSIGNED',
                                 '00000000-0000-0000-0000-000000000000');
    raise exception 'FAIL an invented alternative Meal was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS s2: a special Meal must come from the Meal Library';

  -- s3: three alternatives among the 80 → 77 standard + 3 special = 80.
  perform resolve_special_meal(v_stu, v_svc_l, 'ALTERNATIVE_ASSIGNED',
            (select current_revision_id from meals where id=v_alt), 'No dairy');
  select id into v_stu from students where student_no='ZZF3';
  v_req := submit_dietary_requirement(v_stu,'DIETARY_RESTRICTION','No pork.','Institution form');
  perform review_dietary_requirement(v_req,'APPROVED');
  perform resolve_special_meal(v_stu, v_svc_l, 'ALTERNATIVE_ASSIGNED',
            (select current_revision_id from meals where id=v_alt));
  select id into v_stu from students where student_no='ZZF4';
  v_req := submit_dietary_requirement(v_stu,'OTHER_MEAL_REQUIREMENT','Soft texture.','Institution form');
  perform review_dietary_requirement(v_req,'APPROVED');
  perform resolve_special_meal(v_stu, v_svc_l, 'ALTERNATIVE_ASSIGNED',
            (select current_revision_id from meals where id=v_alt));

  select standard_required into n from meal_production_demand(current_date) where meal_service_id=v_svc_l;
  select special_required  into q from meal_production_demand(current_date) where meal_service_id=v_svc_l;
  if n <> 77 then raise exception 'FAIL standard % (want 77)', n; end if;
  if q <> 3   then raise exception 'FAIL special % (want 3)', q; end if;
  select total_required into q from meal_production_demand(current_date) where meal_service_id=v_svc_l;
  if q <> 80 then raise exception 'FAIL total % (want 80 — a special REPLACES a standard)', q; end if;
  raise notice 'PASS s3: 77 standard + 3 special = 80 total, never 83';

  -- s4: STANDARD_CONFIRMED is a decision that unblocks without changing the Meal.
  select id into v_stu from students where student_no='ZZF5';
  v_req := submit_dietary_requirement(v_stu,'ALLERGY','Avoid nuts.','Institution form');
  perform review_dietary_requirement(v_req,'APPROVED');
  perform resolve_special_meal(v_stu, v_svc_l, 'STANDARD_CONFIRMED');
  select total_required into q from meal_production_demand(current_date) where meal_service_id=v_svc_l;
  if q <> 80 then raise exception 'FAIL confirming the standard Meal changed the total (%)', q; end if;
  raise notice 'PASS s4: confirming the standard Meal resolves without adding a Meal';

  -- ============================================================= FINALISE
  v_fd := finalize_demand(v_svc_l);
  select total_quantity into q from final_demand where id=v_fd;
  if q <> 80 then raise exception 'FAIL snapshot total % (want 80)', q; end if;
  select count(*) into n from final_demand_special_lines where final_demand_id=v_fd;
  if n <> 3 then raise exception 'FAIL snapshot special lines % (want 3)', n; end if;

  -- f1: a later Plan change does NOT silently rewrite the frozen snapshot.
  perform assign_student_meal_plan(
    (select id from students where student_no='ZZM2'), v_full, current_date);
  select total_quantity into q from final_demand where id=v_fd;
  if q <> 80 then raise exception 'FAIL the snapshot moved to % after a plan change', q; end if;
  select count(*) into n from demand_drift(current_date) where final_demand_id=v_fd;
  if n <> 1 then raise exception 'FAIL drift not detected after a late plan change'; end if;
  raise notice 'PASS f1: a late change is surfaced as drift, never written silently';

  -- f2: adjusting supersedes rather than overwrites, and demands a reason.
  begin
    perform adjust_final_demand(v_fd, '   ');
    raise exception 'FAIL adjusted finalised demand with no reason';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  v_fd := adjust_final_demand(v_fd, 'Late plan change for ZZM2');
  select count(*) into n from final_demand
   where meal_service_id=v_svc_l and superseded_at is not null;
  if n <> 1 then raise exception 'FAIL superseded snapshot not preserved'; end if;
  select total_quantity into q from final_demand where id=v_fd;
  if q <> 81 then raise exception 'FAIL adjusted total % (want 81)', q; end if;
  raise notice 'PASS f2: adjustment supersedes with a reason and preserves the original';

  -- ================================================= PRODUCTION / PACKING
  perform start_production(v_fd);
  begin
    perform complete_production(v_fd);
    raise exception 'FAIL production completed with unconfirmed special Meals';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS r1: production cannot complete while a special Meal is unconfirmed';

  for v_line in select id from final_demand_special_lines where final_demand_id=v_fd loop
    perform confirm_special_produced(v_line);
  end loop;
  perform complete_production(v_fd);
  perform start_packing(v_fd);
  for v_line in select id from final_demand_special_lines where final_demand_id=v_fd loop
    perform confirm_special_packed(v_line);
  end loop;
  perform complete_packing(v_fd);
  raise notice 'PASS r2: production and packing complete only with every special accounted for';

  -- ==================================================== DELIVERY — ONE RUN
  begin
    perform build_manifests(v_inst, current_date);
    raise exception 'FAIL a manifest was built with no delivery configuration';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS v1: no delivery configuration means no manifest, never a guess';

  v_cfg := set_delivery_config(v_inst, current_date - 1, 1::smallint, 'Main gate',
    '[{"run":1,"from":"07:00","to":"08:30"}]'::jsonb,
    '{"breakfast":1,"snack":1,"lunch":1,"afternoon_snack":1}'::jsonb);
  perform build_manifests(v_inst, current_date);
  select id into v_mid from delivery_manifests
   where institution_id=v_inst and service_date=current_date and run_number=1;
  select count(*) into n from manifest_lines where manifest_id=v_mid;
  if n <> 1 then raise exception 'FAIL one-run manifest lines % (want 1 finalised line)', n; end if;
  raise notice 'PASS v2: one run carries every serviced period';

  -- v3: a configuration that leaves a serviced period unassigned is refused.
  begin
    perform set_delivery_config(v_inst, current_date + 5, 2::smallint, 'Main gate',
      '[{"run":1,"from":"07:00","to":"08:30"},{"run":2,"from":"11:00","to":"12:30"}]'::jsonb,
      '{"breakfast":1,"snack":1,"lunch":2}'::jsonb);
    raise exception 'FAIL a serviced Meal Period was left off every delivery run';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS v3: every serviced Meal Period must belong to exactly one run';

  -- ================================================== DISPATCH / HANDOVER
  perform assign_manifest_driver(v_mid, v_driver);
  perform release_manifest(v_mid);

  -- h1: a Driver may collect and arrive, and may NOT hand over.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_driver,'role','authenticated')::text, true);
  perform driver_confirm_collection(v_mid);
  perform driver_confirm_arrival(v_mid);
  begin
    perform confirm_handover(v_mid);
    raise exception 'FAIL a Driver completed the institution handover';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS h1: a Driver carries and arrives but never receives';

  -- h2: an Institution user who is NOT an authorised receiver cannot hand over.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  begin
    perform confirm_handover(v_mid);
    raise exception 'FAIL an unauthorised institution user handed over';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS h2: handover needs a deliberate receiver authorisation';

  -- h3: authorised, it works, and custody is recorded.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);
  perform set_delivery_receiver(v_inst, v_admin, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  perform confirm_handover(v_mid);
  select count(*) into n from delivery_manifests
   where id=v_mid and state='HANDED_OVER' and received_by=v_admin;
  if n <> 1 then raise exception 'FAIL handover not recorded against the receiver'; end if;
  raise notice 'PASS h3: an authorised receiver takes custody, and it is recorded';

  -- h4: a Parent may never be authorised to receive.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);
  begin
    perform set_delivery_receiver(v_inst, v_recv, true);
    raise exception 'FAIL a Parent was authorised to receive deliveries';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS h4: a Parent is never a delivery receiver';

  reset role;
  raise notice '---------------------------------------------------------';
  raise notice 'OPERATIONAL SPINE: entitlement, exact demand, special meals,';
  raise notice 'production, packing, delivery and custody all hold at the';
  raise notice 'database boundary.';
end $$;
rollback;
