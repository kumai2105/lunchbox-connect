-- 0006: read-model views -------------------------------------------------------
-- security_invoker views: the viewer's own RLS still applies row-by-row, so a
-- parent querying the dashboard view sees only their own institution, etc.

-- Per-institution serving summary for the command-center dashboard.
create or replace view v_dashboard_institutions
with (security_invoker = true) as
select
  i.id as institution_id,
  i.name,
  count(distinct c.id)::int as classrooms,
  count(distinct s.id) filter (where s.enrollment_status = 'enrolled')::int as active_students,
  count(distinct sr.id) filter (where sr.serving_date = current_date)::int as meals_today
from institutions i
left join classes c on c.institution_id = i.id
left join students s on s.institution_id = i.id
left join serving_records sr on sr.class_id = c.id and sr.serving_date = current_date
group by i.id, i.name
order by i.name;

-- One day's serving breakdown for the classroom "Today" screen.
create or replace view v_serving_day
with (security_invoker = true) as
select
  sr.serving_date,
  sr.class_id,
  c.name as class_name,
  sr.period,
  count(*)::int as recorded,
  count(*) filter (where sr.outcome = 'full')::int as full_count,
  count(*) filter (where sr.outcome = 'partial')::int as partial_count,
  count(*) filter (where sr.outcome = 'refused')::int as refused_count,
  count(*) filter (where sr.outcome = 'absent')::int as absent_count
from serving_records sr
join classes c on c.id = sr.class_id
group by sr.serving_date, sr.class_id, c.name, sr.period;

-- Whole menu grid for the parent / menu screens (already RLS-restricted by menus_select).
create or replace view v_menu_week
with (security_invoker = true) as
select week_number, weekday, period, dish_name, allergens, published
from menus
order by week_number, weekday, period;