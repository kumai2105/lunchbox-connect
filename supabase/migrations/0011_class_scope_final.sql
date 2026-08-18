-- 0011: classroom class-scope + kitchen institution scope ---------------------
-- Completes the scope alignment from 0010: a classroom user must not even SEE
-- the class list of unassigned classes (AT-032), and kitchen production scope
-- resolves against the kitchen user's institution.

create or replace function app_can_see_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c
    where c.id = p_class
      and (
        app_is_super_admin()
        or (app_current_role() = 'school_admin' and app_can_manage_institution(c.institution_id))
        or (app_current_role() = 'classroom_staff' and c.teacher_id = auth.uid())
        or exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.class_id = c.id and sp.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function app_current_institution_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from app_users
  where user_id = auth.uid()
    and role in ('school_admin', 'classroom_staff', 'kitchen');
$$;

-- Derived production demand: COUNT-ONLY view for Kitchen / Super Admin.
-- Uses security definer so kitchen never needs student-table access. Returns
-- institution, eligible count and allergy-flagged count — NO student identity
-- (docs/02 §33, AT-034). Exact production formula remains NOT_YET_DEFINED.
create or replace function v_production_demand_impl()
returns table (institution_id uuid, institution_name text, eligible_students bigint, allergy_flagged bigint)
language sql stable security definer set search_path = public as $$
  select
    i.id,
    i.name,
    count(distinct s.id) filter (where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY') as eligible_students,
    count(distinct s.id) filter (
      where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
        and jsonb_array_length(s.medical_notes) > 0
    ) as allergy_flagged
  from institutions i
  join app_users me on me.user_id = auth.uid()
  left join students s on s.institution_id = i.id
  where
    (me.role = 'super_admin')
    or (me.role in ('kitchen', 'school_admin') and i.id = me.institution_id)
  group by i.id, i.name
  having count(distinct s.id) > 0
  order by i.name;
$$;

create or replace view v_production_demand
with (security_invoker = true) as
select * from v_production_demand_impl();