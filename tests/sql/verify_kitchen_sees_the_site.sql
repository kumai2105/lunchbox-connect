-- =====================================================================
-- FINDING 17 — the Kitchen can see WHICH SITE each production line is for.
--
-- The rule 0055 states: final_demand_for_date() gives the Kitchen the name of
-- the Institution each finalised sitting belongs to, WITHOUT giving it a read
-- on `institutions`, and without letting anyone see a sitting they could not
-- already see.
--
-- The assertion that matters is s2. `final_demand` carries institution_id, and
-- the obvious fix — embedding institutions(name) — silently returns NULL for
-- the Kitchen, because app_can_see_institution() has no `kitchen` branch and
-- PostgREST renders an unreadable embed as missing data rather than an error.
-- That is exactly how the site went missing from this screen. So the suite
-- proves the Kitchen reads TWO NAMED production lines while reading ZERO rows
-- from institutions.
--
-- Self-contained disposable fixture, one transaction, ROLLBACK.
-- =====================================================================
begin;
do $$
declare
  v_super uuid; v_a uuid; v_b uuid; v_kid uuid;
  v_kitchen uuid; v_admin uuid; v_parent uuid;
  v_svc_a uuid; v_svc_b uuid;
  n bigint; nm text; first_name text;
begin
  select user_id into v_super from app_users where role='super_admin' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);

  -- Two sites operating the SAME day. 'ZZ Site B' is created first and named
  -- second alphabetically on purpose, so the ordering assertion cannot pass by
  -- accident of insertion order.
  insert into institutions (name,kind) values ('ZZ Site B','nursery') returning id into v_b;
  insert into institutions (name,kind) values ('ZZ Site A','school')  returning id into v_a;
  insert into kitchens (name) values ('ZZ F17 Kitchen') returning id into v_kid;

  v_kitchen := gen_random_uuid();
  v_admin   := gen_random_uuid();
  v_parent  := gen_random_uuid();
  insert into auth.users (id,email) values
    (v_kitchen,'zz.f17.kitchen@zz.test'),
    (v_admin,'zz.f17.admin@zz.test'),
    (v_parent,'zz.f17.parent@zz.test');
  insert into app_users (user_id,role,full_name,email,institution_id,kitchen_id,active) values
    (v_kitchen,'kitchen','ZZ F17 Kitchen User','zz.f17.kitchen@zz.test',null,v_kid,true),
    (v_admin,'school_admin','ZZ F17 Admin','zz.f17.admin@zz.test',v_a,null,true),
    (v_parent,'parent','ZZ F17 Parent','zz.f17.parent@zz.test',null,null,true);

  insert into meal_services (institution_id,service_date,period,published)
    values (v_a,current_date,'lunch',true) returning id into v_svc_a;
  insert into meal_services (institution_id,service_date,period,published)
    values (v_b,current_date,'lunch',true) returning id into v_svc_b;

  -- Both sites serve Lunch on the same day: the exact situation in which the
  -- two rows were previously indistinguishable on screen.
  insert into final_demand
    (institution_id,service_date,period,meal_service_id,entitled_students,
     standard_quantity,special_quantity,total_quantity,plan_enforced)
  values
    (v_a,current_date,'lunch',v_svc_a,18,18,0,18,false),
    (v_b,current_date,'lunch',v_svc_b,23,21,2,23,false);

  -- A superseded row for site A. It must not appear: the screen shows what is
  -- being made now, and a superseded sitting is a quantity nobody is cooking.
  insert into final_demand
    (institution_id,service_date,period,meal_service_id,entitled_students,
     standard_quantity,special_quantity,total_quantity,plan_enforced,superseded_at)
  values
    (v_a,current_date,'breakfast',v_svc_a,9,9,0,9,false,now());

  -- Fixture creation above runs as the owner, which bypasses RLS entirely.
  -- Everything below asks what a SIGNED-IN PERSON can actually do.
  set local role authenticated;

  -- ================================================================= s1
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_kitchen,'role','authenticated')::text, true);

  select count(*) into n from final_demand_for_date(current_date);
  if n <> 2 then
    raise exception 'FAIL s1: the Kitchen sees % production lines (want 2, superseded excluded)', n;
  end if;
  select count(*) into n from final_demand_for_date(current_date)
   where institution_name is null or institution_name = '';
  if n <> 0 then
    raise exception 'FAIL s1: % production line(s) reached the Kitchen with no site name', n;
  end if;
  raise notice 'PASS s1: the Kitchen sees both sites'' lunch, each named, and no superseded row';

  -- ================================================================= s2
  -- The one that matters. The name arrives WITHOUT a read on institutions.
  select count(*) into n from institutions;
  if n <> 0 then
    raise exception 'FAIL s2: the Kitchen read % institution row(s) directly — the projection was supposed to make that unnecessary, not permitted', n;
  end if;
  select institution_name into nm from final_demand_for_date(current_date)
   where total_quantity = 23;
  if nm <> 'ZZ Site B' then
    raise exception 'FAIL s2: the 23-portion line is named % (want ZZ Site B)', coalesce(nm,'<null>');
  end if;
  raise notice 'PASS s2: the site name reaches the Kitchen while it reads zero institution rows';

  -- ================================================================= s3
  -- Ordered by site, so a two-site day groups on the bench instead of
  -- interleaving. B was inserted first; A must still come first.
  select institution_name into first_name from final_demand_for_date(current_date) limit 1;
  if first_name <> 'ZZ Site A' then
    raise exception 'FAIL s3: the first line is for % (want ZZ Site A — ordered by site, not insertion)', coalesce(first_name,'<null>');
  end if;
  raise notice 'PASS s3: production lines are ordered by site, not by insertion';

  -- ================================================================= s4
  -- The projection restates final_demand_select and widens nobody. Production
  -- planning is LunchBox-internal (0050): not the Institution, not the Parent.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  select count(*) into n from final_demand_for_date(current_date);
  if n <> 0 then
    raise exception 'FAIL s4: an Institution Admin read % production line(s) through the projection', n;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_parent,'role','authenticated')::text, true);
  select count(*) into n from final_demand_for_date(current_date);
  if n <> 0 then
    raise exception 'FAIL s4: a Parent read % production line(s) through the projection', n;
  end if;
  raise notice 'PASS s4: the projection widens nobody — Kitchen production stays LunchBox-internal';

  -- ================================================================= s5
  -- A Super Admin sees it too: final_demand_select names both, and the
  -- projection must not quietly drop one of them.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);
  select count(*) into n from final_demand_for_date(current_date);
  if n <> 2 then
    raise exception 'FAIL s5: a Super Admin sees % production lines (want 2)', n;
  end if;
  raise notice 'PASS s5: a Super Admin sees the same two named lines';

  raise notice '---------------------------------------------------------';
  raise notice 'FINDING 17: the Kitchen knows which site every production';
  raise notice 'line is for, and still cannot read institutions.';
end $$;
rollback;
