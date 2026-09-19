-- =====================================================================
-- 0023 — Valid Dashboard completion KPI (§38) + authoritative eligibility (§41).
--
-- §38: "fill rate" was meals_today / active_students. Each student can have
-- several meals a day, so that ratio exceeds 100%. Completion must be
-- completed applicable records / EXPECTED applicable records, where expected =
-- eligible students × the number of published meal-service periods the
-- institution actually has that day. If nothing is published today, there is
-- no expectation and the rate is undefined (NULL), not a divide-by-zero.
--
-- §41: eligibility for the meal chain is operational_status =
-- 'ACTIVE_BILLABLE_TO_NURSERY', not the legacy enrollment_status = 'enrolled'.
-- The dashboard now counts eligible students by the authoritative gate.
-- =====================================================================

create or replace view v_dashboard_institutions
with (security_invoker = true) as
with periods_today as (
  select ms.institution_id, count(distinct ms.period)::int as periods_today
  from meal_services ms
  where ms.published and ms.service_date = current_date
  group by ms.institution_id
),
records_today as (
  select s.institution_id, count(distinct sr.id)::int as meals_today
  from serving_records sr
  join students s on s.id = sr.student_id
  where sr.serving_date = current_date
  group by s.institution_id
)
select
  i.id as institution_id,
  i.name,
  count(distinct c.id)::int as classrooms,
  count(distinct s.id) filter (where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY')::int
    as active_students,
  coalesce(rt.meals_today, 0) as meals_today,
  coalesce(pt.periods_today, 0) as periods_today,
  -- expected applicable student-meal records for today
  (count(distinct s.id) filter (where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY')
    * coalesce(pt.periods_today, 0))::int as expected_today
from institutions i
left join classes c on c.institution_id = i.id
left join students s on s.institution_id = i.id
left join periods_today pt on pt.institution_id = i.id
left join records_today rt on rt.institution_id = i.id
group by i.id, i.name, pt.periods_today, rt.meals_today
order by i.name;

comment on view v_dashboard_institutions is
  'Per-institution dashboard. completion = meals_today / expected_today where '
  'expected_today = eligible students (ACTIVE_BILLABLE_TO_NURSERY) × published '
  'meal-service periods today. Undefined when expected_today = 0.';
