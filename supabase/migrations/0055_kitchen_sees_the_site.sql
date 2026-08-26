-- 0055 — the Kitchen can see WHICH SITE each production line is for.
--
-- Finding 17. The Kitchen's "Production and packing" table lists one row per
-- finalised sitting and renders only the period label. With one Institution
-- operating that is unambiguous. With two operating on the same day it shows
--
--     Sitting   Required   Production   Packing
--     Lunch     18         READY        WAITING_FOR_PRODUCTION
--     Lunch     23         READY        WAITING_FOR_PRODUCTION
--
-- and nothing on the screen says which crate belongs to which site. The
-- operator has to guess, and the two actions beside those rows — mark produced,
-- mark packed — are exactly the ones that must not be applied to the wrong
-- site's food.
--
-- This is the SAME defect 0054 closed for the Dispatch table, one screen along,
-- and it has the same cause: `final_demand` carries `institution_id` but the
-- Kitchen cannot read `institutions` — `app_can_see_institution()` has no
-- `kitchen` branch — so `select *, institutions(name)` would hand the screen a
-- null and no error, because PostgREST renders an unreadable embedded row as
-- missing data rather than as a failure.
--
-- Closed the same way: BY PROJECTION, NOT BY POLICY.
--
-- final_demand_select is
--     using (app_is_super_admin() or app_current_role() = 'kitchen')
-- and the predicate below restates that word for word. No role can see a
-- finalised sitting it could not already see; the row simply now carries the
-- name of the place the food is going to. The Kitchen still cannot read
-- `institutions`, and verify_kitchen_sees_the_site asserts exactly that while
-- the Kitchen reads two named production lines.
--
-- Nothing else changes. No quantity, no state machine, no authorization, no
-- Demand arithmetic, and no existing migration.

create or replace function final_demand_for_date(p_date date)
returns table (
  id                uuid,
  institution_id    uuid,
  institution_name  text,
  service_date      date,
  period            app_period,
  meal_service_id   uuid,
  meal_revision_id  uuid,
  entitled_students integer,
  standard_quantity integer,
  special_quantity  integer,
  total_quantity    integer,
  plan_enforced     boolean,
  finalized_at      timestamptz,
  superseded_at     timestamptz
)
language sql stable security definer set search_path = public as $$
  select f.id, f.institution_id, i.name, f.service_date, f.period,
         f.meal_service_id, f.meal_revision_id, f.entitled_students,
         f.standard_quantity, f.special_quantity, f.total_quantity,
         f.plan_enforced, f.finalized_at, f.superseded_at
    from final_demand f
    join institutions i on i.id = f.institution_id
   where f.service_date = p_date
     and f.superseded_at is null
     -- final_demand_select, restated verbatim (0050).
     and (app_is_super_admin() or app_current_role() = 'kitchen')
   -- The site is what the bench sorts by when more than one is in the kitchen.
   order by i.name, f.period;
$$;

-- Stated rather than inherited. 0047 exists because eight functions silently
-- kept PostgreSQL's default EXECUTE to PUBLIC, and anon is in PUBLIC.
revoke all on function final_demand_for_date(date) from public, anon;
grant execute on function final_demand_for_date(date) to authenticated;
