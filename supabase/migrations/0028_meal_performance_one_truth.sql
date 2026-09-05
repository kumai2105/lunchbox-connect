-- =====================================================================
-- 0028 — Management analytics use the authoritative meal identity (§31).
--
-- v_meal_performance joined serving_records on the legacy menu_item_id, so
-- post-cutover observations (which carry meal_service_id, not menu_item_id)
-- were invisible to management analytics — a second, stale source of truth.
--
-- Rebuild it to aggregate by the real Meal, via
-- serving_records.meal_service_id -> meal_services -> meal_revisions -> meals.
-- The same meal served on many days aggregates as one meal, matching the Meal
-- Analytics screen and Parent Insights (§30).
--
-- The legacy week_number/weekday output columns are DROPPED, not zeroed: a
-- reusable meal is not tied to a single calendar week/weekday, and leaving
-- them as always-0 compatibility columns would be exactly the kind of
-- vestigial architecture this correction order removes. menu_item_id is kept
-- as the row key but now carries the stable meal id. Dropping columns changes
-- the function's return type, so the dependent view and the function are both
-- dropped and recreated.
-- =====================================================================

drop view if exists v_meal_performance;
drop function if exists v_meal_performance_impl();

create function v_meal_performance_impl()
returns table (
  menu_item_id uuid,
  dish_name text,
  period app_period,
  total_observations bigint,
  valid_observations bigint,
  avg_consumption_pct numeric,
  refusal_count bigint,
  encouragement_count bigint,
  did_not_like_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    mm.id                          as menu_item_id,   -- stable MEAL id now
    mm.name                        as dish_name,
    ms.period,
    count(sr.id) as total_observations,
    count(sr.id) filter (
      where sr.served_status = 'served'
        and coalesce(sr.low_intake_reason::text, '') not in ('absent', 'unwell', 'sleeping')
    ) as valid_observations,
    round(avg(sr.consumption_pct) filter (
      where sr.served_status = 'served'
        and coalesce(sr.low_intake_reason::text, '') not in ('absent', 'unwell', 'sleeping')
    ), 1) as avg_consumption_pct,
    count(sr.id) filter (where sr.behavior = 'refused') as refusal_count,
    count(sr.id) filter (where sr.behavior = 'needed_encouragement') as encouragement_count,
    count(sr.id) filter (where sr.low_intake_reason = 'did_not_like_it') as did_not_like_count
  from serving_records sr
  join meal_services ms on ms.id = sr.meal_service_id
  join meal_revisions mr on mr.id = ms.meal_revision_id
  join meals mm on mm.id = mr.meal_id
  where exists (select 1 from app_users me where me.user_id = auth.uid() and me.role = 'super_admin')
  group by mm.id, mm.name, ms.period
$$;

create view v_meal_performance
with (security_invoker = true) as
select * from v_meal_performance_impl();

grant select on v_meal_performance to authenticated;
