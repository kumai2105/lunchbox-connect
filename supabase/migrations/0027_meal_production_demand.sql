-- =====================================================================
-- 0027 — Per-meal Kitchen production demand (§33/§34).
--
-- The old demand was "eligible students per institution", implicitly applied
-- to every meal. Real production is per PUBLISHED MEAL SERVICE: on a given
-- date each institution has specific meals for specific periods, and two
-- institutions may serve different meals for the same period. The kitchen
-- must see the quantity for EACH ACTUAL MEAL.
--
-- This returns one row per (published meal_service that day) with the eligible
-- headcount for that institution — counts only, never student identity (§56).
-- The kitchen UI aggregates by meal to get "make N of Chicken Pasta".
--
-- Whether a date is a service day is decided ENTIRELY by whether meals are
-- published for it (§35) — there is no hard-coded weekend rule here.
-- =====================================================================

create or replace function meal_production_demand(p_date date)
returns table (
  institution_id   uuid,
  institution_name text,
  period           app_period,
  meal_revision_id uuid,
  meal_name        text,
  eligible_students bigint,
  allergy_flagged   bigint
)
language sql stable security definer set search_path = public as $$
  select
    ms.institution_id,
    i.name,
    ms.period,
    ms.meal_revision_id,
    mr.name,
    count(distinct s.id) filter (where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'),
    count(distinct s.id) filter (
      where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
        and jsonb_array_length(s.medical_notes) > 0
    )
  from meal_services ms
  join institutions i on i.id = ms.institution_id
  join meal_revisions mr on mr.id = ms.meal_revision_id
  left join students s on s.institution_id = ms.institution_id
  join app_users me on me.user_id = auth.uid()
  where ms.published
    and ms.service_date = p_date
    and (
      me.role = 'super_admin'
      or me.role = 'kitchen'                       -- the kitchen cooks for everyone it serves
      or (me.role = 'school_admin' and me.institution_id = ms.institution_id)
    )
  group by ms.institution_id, i.name, ms.period, ms.meal_revision_id, mr.name
  order by ms.period, mr.name, i.name;
$$;

revoke all on function meal_production_demand(date) from public, anon;
grant execute on function meal_production_demand(date) to authenticated;

comment on function meal_production_demand(date) is
  'Per-published-meal Kitchen demand for a date (§33/§34): one row per '
  'institution×period×meal with the eligible headcount, counts only. Service '
  'days are defined by publication, not a hard-coded weekend rule.';
