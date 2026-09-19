-- =====================================================================
-- §33/§34 KITCHEN DEMAND — per published meal, not per-institution blanket.
-- One transaction, ROLLBACK.
-- =====================================================================
begin;
do $$
declare v_super uuid; iA uuid; iB uuid; mChicken uuid; mBeef uuid; n int; qty bigint;
begin
  select user_id into v_super from app_users where role='super_admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub',v_super,'role','authenticated')::text, true);

  -- Fixture is built on the OWNER path (migrations/service-role equivalent).
  -- 0033 makes meal_services a controlled write path: no client role — not
  -- even a Super Admin — writes that table directly; publication goes through
  -- publish_meal_services(). The fixture is not the thing under test here, so
  -- it is staged as the owner and only the READ is exercised as the client.
  insert into institutions (name,kind) values ('ZZ KD A','nursery') returning id into iA;
  insert into institutions (name,kind) values ('ZZ KD B','nursery') returning id into iB;
  mChicken := save_meal(null,'KD Chicken Pasta',null,null,null,null,null);
  mBeef := save_meal(null,'KD Beef Rice',null,null,null,null,null);
  insert into students (student_no,institution_id,given_name,family_name,enrollment_status,operational_status)
    select 'KA'||g,iA,'K',g::text,'enrolled','ACTIVE_BILLABLE_TO_NURSERY' from generate_series(1,3) g;
  insert into students (student_no,institution_id,given_name,family_name,enrollment_status,operational_status)
    select 'KB'||g,iB,'K',g::text,'enrolled','ACTIVE_BILLABLE_TO_NURSERY' from generate_series(1,2) g;
  insert into meal_services (institution_id,service_date,period,meal_revision_id,published,published_at)
    values (iA,current_date,'lunch',(select current_revision_id from meals where id=mChicken),true,now()),
           (iB,current_date,'lunch',(select current_revision_id from meals where id=mBeef),true,now());

  set local role authenticated;
  select count(*) into n from meal_production_demand(current_date);
  if n<>2 then raise exception 'FAIL expected 2 per-meal demand rows, got %', n; end if;
  select eligible_students into qty from meal_production_demand(current_date) where meal_name='KD Chicken Pasta';
  if qty<>3 then raise exception 'FAIL Chicken Pasta demand % (want 3)', qty; end if;
  select eligible_students into qty from meal_production_demand(current_date) where meal_name='KD Beef Rice';
  if qty<>2 then raise exception 'FAIL Beef Rice demand % (want 2)', qty; end if;
  raise notice 'PASS §34 per-meal demand: Chicken Pasta=3, Beef Rice=2 (each meal its own quantity)';

  -- §35: a date with nothing published yields no demand (service day = publication)
  select count(*) into n from meal_production_demand(current_date + 400);
  if n<>0 then raise exception 'FAIL future unpublished date shows demand (%)', n; end if;
  raise notice 'PASS §35 service days come from publication, not a weekend rule';

  reset role;
  raise notice '---------------------------------------------------------';
  raise notice 'KITCHEN DEMAND: per-meal quantities verified.';
end $$;
rollback;
