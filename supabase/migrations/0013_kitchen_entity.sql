-- 0013: Kitchen operational entity (docs/13 Decision 031) --------------------
-- Kitchen belongs to the LunchBox Connect operational side, not any
-- Institution. MVP: Jazeel Restaurant is the current active Kitchen — data,
-- not hard-coded logic. Multi-kitchen routing/capacity/territory rules stay
-- NOT_YET_DEFINED (see docs/00 §5A, docs/13 Decision 031).

create table kitchens (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table kitchens is
  'LunchBox Connect operational Kitchen entity (docs/13 Decision 031). Not owned '
  'by any Institution. MVP: Jazeel Restaurant is the current active Kitchen; '
  'multi-kitchen routing/capacity/territory rules remain NOT_YET_DEFINED.';

alter table kitchens enable row level security;

create policy kitchens_select on kitchens for select
  using (exists (select 1 from app_users au where au.user_id = auth.uid()));
create policy kitchens_write on kitchens for all
  using (app_is_super_admin()) with check (app_is_super_admin());

revoke all on kitchens from anon;
grant select, insert, update, delete on kitchens to authenticated;

insert into kitchens (name, active) values ('Jazeel Restaurant', true);

-- app_users: kitchen role belongs to a Kitchen entity, not an Institution.
alter table app_users add column kitchen_id uuid references kitchens (id) on delete set null;

alter table app_users drop constraint if exists app_users_staff_needs_institution;
alter table app_users
  add constraint app_users_staff_needs_institution
  check (role not in ('school_admin', 'classroom_staff') or institution_id is not null);

alter table app_users
  add constraint app_users_kitchen_needs_kitchen
  check (role <> 'kitchen' or kitchen_id is not null);

alter table app_users
  add constraint app_users_kitchen_no_institution
  check (role <> 'kitchen' or institution_id is null);

-- kitchen role is no longer institution-scoped.
create or replace function app_current_institution_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from app_users
  where user_id = auth.uid()
    and role in ('school_admin', 'classroom_staff');
$$;

create or replace function app_current_kitchen_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select kitchen_id from app_users
  where user_id = auth.uid() and role = 'kitchen';
$$;

-- production demand: Kitchen sees demand across ALL institutions (it is not
-- institution-scoped) and now carries the responsible Kitchen reference.
-- Return shape changes, so drop/recreate rather than replace-in-place.
drop view if exists v_production_demand;
drop function if exists v_production_demand_impl();

create function v_production_demand_impl()
returns table (
  institution_id uuid,
  institution_name text,
  kitchen_id uuid,
  kitchen_name text,
  eligible_students bigint,
  allergy_flagged bigint
)
language sql stable security definer set search_path = public as $$
  select
    i.id,
    i.name,
    k.id,
    k.name,
    count(distinct s.id) filter (where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY') as eligible_students,
    count(distinct s.id) filter (
      where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
        and jsonb_array_length(s.medical_notes) > 0
    ) as allergy_flagged
  from institutions i
  join app_users me on me.user_id = auth.uid()
  left join students s on s.institution_id = i.id
  left join lateral (
    select id, name from kitchens where active = true order by created_at limit 1
  ) k on true
  where
    (me.role = 'super_admin')
    or (me.role = 'school_admin' and i.id = me.institution_id)
    or (me.role = 'kitchen')
  group by i.id, i.name, k.id, k.name
  having count(distinct s.id) > 0
  order by i.name;
$$;

create view v_production_demand
with (security_invoker = true) as
select * from v_production_demand_impl();

grant select on v_production_demand to authenticated;
