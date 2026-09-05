-- =====================================================================
-- 00_diagnose.sql — READ ONLY. Writes nothing. Safe anywhere.
--
-- Run this on production FIRST. It reports the authoritative current
-- state so no later step has to guess. Nothing here inserts, updates,
-- deletes, grants, or revokes. You can run it in the Supabase SQL editor
-- without risk — there is nothing to commit.
--
-- Read the six result sets it returns top to bottom. Send them back and
-- the corrective steps get chosen from real data, not assumptions.
-- =====================================================================

-- (1) SECURITY: are the resolver RPCs still reachable by client roles?
--     Want every column false. If any is true, the leak is open.
select '1_security' as section,
  has_function_privilege('anon','resolve_meal(uuid,date,app_period)','EXECUTE')              as anon_resolve_meal,
  has_function_privilege('authenticated','resolve_meal(uuid,date,app_period)','EXECUTE')      as auth_resolve_meal,
  has_function_privilege('anon','resolve_rotation_week(uuid,date)','EXECUTE')                 as anon_rotation_week,
  has_function_privilege('anon','service_plan_includes(uuid,date,app_period)','EXECUTE')      as anon_plan_includes;

-- (2) SERVICE PLANS currently on record, per institution. These define the
--     contracted meal periods. If a plan here was inferred from the menu
--     rather than agreed with the institution, it is not authoritative.
select '2_service_plans' as section,
  i.name as institution, p.periods, p.effective_from, p.id as plan_id
from institutions i
left join institution_service_plans p on p.institution_id = i.id
order by i.name, p.effective_from;

-- (3) ROTATION ASSIGNMENTS currently on record, per institution.
select '3_rotation_assignments' as section,
  i.name as institution, r.name as rotation, r.week_count,
  a.effective_from, a.anchor_week, a.id as assignment_id
from institutions i
left join institution_rotation_assignments a on a.institution_id = i.id
left join rotations r on r.id = a.rotation_id
order by i.name;

-- (4) PUBLISHED meal_services: how many, and over what date span, per
--     institution. Hundreds spanning a year indicates the mass-publish.
select '4_published_services' as section,
  i.name as institution,
  count(*) filter (where ms.published)                        as published,
  count(*) filter (where not ms.published)                    as drafts,
  min(ms.service_date) filter (where ms.published)            as earliest_published,
  max(ms.service_date) filter (where ms.published)            as latest_published
from institutions i
left join meal_services ms on ms.institution_id = i.id
group by i.name order by i.name;

-- (5) TEST FIXTURE FOOTPRINT — every table that can reference a `Test %`
--     meal/rotation, counted. This is the COMPLETE dependency set (the FK
--     graph has no Packing/Dispatch/Delivery tables; they are unbuilt).
--     Any non-zero downstream count means a Test row is referenced by
--     something and must not be blindly deleted.
select '5_test_footprint' as section, 'meals named Test %' as what,
       (select count(*) from meals where name like 'Test %') as n
union all select '5_test_footprint','meal_revisions of Test meals',
  (select count(*) from meal_revisions r join meals m on m.id=r.meal_id where m.name like 'Test %')
union all select '5_test_footprint','rotation_slots using a Test meal',
  (select count(*) from rotation_slots rs join meals m on m.id=rs.meal_id where m.name like 'Test %')
union all select '5_test_footprint','rotations named Test %',
  (select count(*) from rotations where name like 'Test %')
union all select '5_test_footprint','rotation_assignments to a Test rotation',
  (select count(*) from institution_rotation_assignments a join rotations r on r.id=a.rotation_id where r.name like 'Test %')
union all select '5_test_footprint','calendar_exceptions referencing a Test meal/rotation',
  (select count(*) from calendar_exceptions ce
     left join meals m on m.id=ce.meal_id left join rotations r on r.id=ce.rotation_id
     where m.name like 'Test %' or r.name like 'Test %')
union all select '5_test_footprint','meal_services built from a Test meal',
  (select count(*) from meal_services ms join meal_revisions r on r.id=ms.meal_revision_id
     join meals m on m.id=r.meal_id where m.name like 'Test %')
union all select '5_test_footprint','serving_records linked to a Test-meal service (REAL HISTORY IF >0)',
  (select count(*) from serving_records sr join meal_services ms on ms.id=sr.meal_service_id
     join meal_revisions r on r.id=ms.meal_revision_id join meals m on m.id=r.meal_id
     where m.name like 'Test %');

-- (6) OPERATIONAL HISTORY that must never be collateral damage: any
--     serving_records at all, and how they are linked.
select '6_history' as section,
  count(*)                                            as serving_records_total,
  count(*) filter (where meal_service_id is not null) as linked_to_a_service,
  count(*) filter (where menu_item_id  is not null)   as linked_to_legacy_menu,
  min(serving_date) as earliest, max(serving_date) as latest
from serving_records;
