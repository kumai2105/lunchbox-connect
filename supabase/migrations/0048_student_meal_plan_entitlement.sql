-- =====================================================================
-- 0048 — STUDENT MEAL PLAN ENTITLEMENT
--
-- THE RULE THIS ENCODES, AND THE ONE IT REFUSES TO ENCODE
--
-- An Institution's `institution_service_plans.periods` already answers a real
-- question and keeps answering exactly that question here:
--
--     "What can LunchBox Connect provide at this SITE?"
--
-- It has never answered, and must never be made to answer:
--
--     "What does THIS CHILD receive?"
--
-- Those are different facts. Two children in the same Class, eating from the
-- same published Menu, may hold different entitlements — one on Breakfast +
-- Morning snack, another on all four sittings. Collapsing the two would make
-- the first child look like a 0% Lunch, a missed Lunch, or an absence, when in
-- truth Lunch is simply not part of what they receive.
--
-- So this migration ADDS a child-level layer. It does not mutate, rename or
-- repurpose institution_service_plans, and it does not create a second
-- Institution service model beside it.
--
-- WHAT IS DELIBERATELY NOT BUILT HERE
--
--   * No prices, no package names, no "Package 1 / Package 2", no AED figures.
--     A Meal Plan is a SERVICE ENTITLEMENT. Commercial terms attach later
--     through their own approved rules, and hard-coding today's price list into
--     the schema would outlive the price list.
--   * No new Meal Period. A Plan selects a subset of the EXISTING app_period
--     enum (breakfast, snack, lunch, afternoon_snack) and nothing else.
--   * No catalogue. "Morning Plan" and "Full Plan" are examples in the order,
--     not rows this migration is entitled to invent.
--
-- THE NON-DESTRUCTIVE ROLLOUT — THE MOST IMPORTANT PART OF THIS FILE
--
-- Production already serves real children who have NO explicit Plan, because
-- the concept did not exist until now. Three things would each be a way of
-- guessing, and all three are refused:
--
--   * copying the Institution's service periods onto every Student,
--   * inferring a Plan from historical serving records,
--   * defaulting every Student to "everything".
--
-- Instead each Institution carries an explicit boundary date,
-- `student_plan_enforced_from`. Before it, demand keeps its existing verified
-- meaning to the row. On and after it, entitlement is mandatory. The boundary
-- is set by a Super Admin through activate_student_meal_plans(), which REFUSES
-- to activate while any Student who would be served lacks a valid Plan — so the
-- switch cannot silently drop a child out of production.
--
-- Until an Institution is activated, nothing about its service changes.
-- =====================================================================

-- btree_gist lets a GiST exclusion constraint mix plain equality (student_id)
-- with range overlap (the effective dates). Without it the one-Plan-per-child
-- invariant could only be enforced in application code, which is exactly where
-- it would eventually not be enforced.
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- MEAL PLAN — a reusable LunchBox-controlled entitlement definition.
-- ---------------------------------------------------------------------
create table if not exists meal_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  retired_at  timestamptz,
  retired_by  uuid references app_users (user_id) on delete set null,
  created_by  uuid references app_users (user_id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint meal_plans_name_not_blank check (btrim(name) <> '')
);

-- Name is the operator's handle for the Plan; two live Plans called the same
-- thing would make every assignment screen ambiguous. Retired Plans keep their
-- names (history stays readable) so the uniqueness is partial.
create unique index if not exists meal_plans_active_name_idx
  on meal_plans (lower(btrim(name))) where active;

comment on table meal_plans is
  'Reusable entitlement definition: which Meal Periods a child on this Plan '
  'receives. NOT a commercial package — no price, no billing. Retired Plans '
  'accept no new assignments but remain truthful for assignments already made.';

-- The periods a Plan includes. A join table rather than an array so the
-- membership can be joined, counted and constrained directly.
create table if not exists meal_plan_periods (
  meal_plan_id uuid not null references meal_plans (id) on delete cascade,
  period       app_period not null,
  primary key (meal_plan_id, period)
);

create index if not exists meal_plan_periods_period_idx
  on meal_plan_periods (period, meal_plan_id);

comment on table meal_plan_periods is
  'Which existing app_period values a Meal Plan includes. No new period type is '
  'introduced by the Meal Plan model.';

-- ---------------------------------------------------------------------
-- INSTITUTION AVAILABILITY — which Plans a Super Admin has made available to
-- a given site. An Institution Admin may read this; it is not theirs to write.
-- ---------------------------------------------------------------------
create table if not exists institution_meal_plans (
  institution_id uuid not null references institutions (id) on delete cascade,
  meal_plan_id   uuid not null references meal_plans (id) on delete restrict,
  created_by     uuid references app_users (user_id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (institution_id, meal_plan_id)
);

comment on table institution_meal_plans is
  'Which Meal Plans a Super Admin has made available at an Institution. '
  'Availability is a precondition of assignment, not an assignment.';

-- ---------------------------------------------------------------------
-- STUDENT ASSIGNMENT — effective-dated, one live Plan per child per date.
--
-- effective_until is INCLUSIVE, matching institution_service_plans.effective_to
-- rather than inventing a second date convention in the same database.
-- ---------------------------------------------------------------------
create table if not exists student_meal_plans (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students (id) on delete cascade,
  meal_plan_id    uuid not null references meal_plans (id) on delete restrict,
  effective_from  date not null,
  effective_until date,
  assigned_by     uuid references app_users (user_id) on delete set null,
  assigned_at     timestamptz not null default now(),
  ended_by        uuid references app_users (user_id) on delete set null,
  ended_at        timestamptz,
  note            text,
  constraint student_meal_plans_dates check (
    effective_until is null or effective_until >= effective_from
  )
);

create index if not exists student_meal_plans_lookup_idx
  on student_meal_plans (student_id, effective_from desc);

-- THE INVARIANT: one child, one effective Plan on any given date.
--
-- Enforced by the database with an exclusion constraint rather than by
-- application code, because "only one Plan applies today" is the assumption
-- every demand calculation downstream is entitled to make. daterange is
-- half-open, so effective_until (inclusive) is materialised as +1 day.
alter table student_meal_plans drop constraint if exists student_meal_plans_no_overlap;
alter table student_meal_plans
  add constraint student_meal_plans_no_overlap
  exclude using gist (
    student_id with =,
    daterange(effective_from, effective_until + 1, '[)') with &&
  );

comment on table student_meal_plans is
  'Effective-dated Meal Plan assignment for one child. A Student may hold only '
  'ONE effective Plan on any date (enforced by an exclusion constraint). '
  'Changing a Plan ENDS the old row and opens a new one — September is never '
  'rewritten because October changed.';

-- ---------------------------------------------------------------------
-- THE ENFORCEMENT BOUNDARY.
--
-- NULL means "this Institution has not been switched over"; its demand keeps
-- the pre-0048 meaning exactly. A date means entitlement is authoritative on
-- and after it.
-- ---------------------------------------------------------------------
alter table institutions
  add column if not exists student_plan_enforced_from date,
  add column if not exists student_plan_activated_by uuid
    references app_users (user_id) on delete set null,
  add column if not exists student_plan_activated_at timestamptz;

comment on column institutions.student_plan_enforced_from is
  'The date on and after which Student Meal Plan entitlement governs Production '
  'Demand at this Institution. NULL = not yet activated; legacy demand '
  'behaviour is preserved unchanged. Set only by activate_student_meal_plans().';

-- =====================================================================
-- READ HELPERS
--
-- SECURITY DEFINER and gated at source, in the same style as the 0044 helpers:
-- they answer a question about entitlement without granting the caller any
-- ability to read a table they could not already read.
-- =====================================================================

-- The Plan in force for a child on a date, or NULL.
create or replace function app_student_plan_on(p_student uuid, p_date date)
returns uuid language sql stable security definer set search_path = public as $$
  select smp.meal_plan_id
    from student_meal_plans smp
   where smp.student_id = p_student
     and smp.effective_from <= p_date
     and (smp.effective_until is null or smp.effective_until >= p_date)
   limit 1;
$$;

-- Does the child's Plan on that date include that sitting?
create or replace function app_student_entitled(p_student uuid, p_date date, p_period app_period)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from student_meal_plans smp
      join meal_plan_periods mpp on mpp.meal_plan_id = smp.meal_plan_id
     where smp.student_id = p_student
       and smp.effective_from <= p_date
       and (smp.effective_until is null or smp.effective_until >= p_date)
       and mpp.period = p_period
  );
$$;

-- Is entitlement authoritative for this Institution on this date?
--
-- This is the single place the legacy/enforced boundary is decided. Everything
-- downstream asks this rather than re-deriving it, so the cutover cannot mean
-- one thing to the Kitchen and another to the Classroom.
create or replace function app_plan_enforced(p_inst uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select i.student_plan_enforced_from is not null
            and p_date >= i.student_plan_enforced_from
       from institutions i where i.id = p_inst),
    false);
$$;

-- THE ENTITLEMENT QUESTION, ANSWERED ONCE.
--
-- Before enforcement: every operationally active child counts, which is exactly
-- what the system did before this migration existed.
-- On/after enforcement: the child must additionally hold a Plan containing the
-- sitting.
create or replace function app_student_counts_for(
  p_student uuid, p_inst uuid, p_date date, p_period app_period
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
     where s.id = p_student
       and s.institution_id = p_inst
       and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
  )
  and (
    not app_plan_enforced(p_inst, p_date)
    or app_student_entitled(p_student, p_date, p_period)
  );
$$;

-- =====================================================================
-- WRITE PATHS — Super Admin authority, audited, no silent partial application.
-- =====================================================================

create or replace function save_meal_plan(
  p_plan_id uuid,
  p_name    text,
  p_periods app_period[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_plan uuid; v_used boolean; v_old_periods app_period[];
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may manage Meal Plans';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Meal Plan name is required';
  end if;
  if p_periods is null or array_length(p_periods, 1) is null then
    raise exception 'A Meal Plan must include at least one Meal Period';
  end if;

  if p_plan_id is null then
    insert into meal_plans (name, created_by) values (btrim(p_name), auth.uid())
      returning id into v_plan;
  else
    v_plan := p_plan_id;
    if not exists (select 1 from meal_plans where id = v_plan) then
      raise exception 'Meal Plan not found';
    end if;
    if not (select active from meal_plans where id = v_plan) then
      raise exception 'That Meal Plan is retired. Retired Plans are not edited.';
    end if;

    -- HISTORY IS NOT REWRITTEN BY AN EDIT.
    --
    -- Changing which sittings a Plan contains changes what every assignment
    -- already made under it MEANS, including assignments covering dates that
    -- have already been served. Renaming is safe; re-composing is not. So a
    -- Plan that is already assigned to anybody may be renamed but its periods
    -- are frozen — the operator creates a new Plan and schedules a change,
    -- which is the mechanism that exists precisely for this.
    select exists (select 1 from student_meal_plans where meal_plan_id = v_plan)
      into v_used;
    select array_agg(period order by period) into v_old_periods
      from meal_plan_periods where meal_plan_id = v_plan;

    if v_used and coalesce(v_old_periods, '{}') is distinct from (
      select array_agg(p order by p) from unnest(p_periods) as p
    ) then
      raise exception
        'This Meal Plan is already assigned to Students, so the Meal Periods it '
        'contains cannot be changed — that would rewrite what past assignments '
        'meant. Create a new Meal Plan and schedule a change instead.';
    end if;

    update meal_plans set name = btrim(p_name), updated_at = now() where id = v_plan;
  end if;

  delete from meal_plan_periods where meal_plan_id = v_plan and period <> all (p_periods);
  insert into meal_plan_periods (meal_plan_id, period)
    select v_plan, p from unnest(p_periods) as p on conflict do nothing;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value)
  values (auth.uid(),
          case when p_plan_id is null then 'meal_plan.create' else 'meal_plan.update' end,
          'meal_plans', v_plan,
          case when p_plan_id is null then null
               else jsonb_build_object('periods', to_jsonb(v_old_periods)) end,
          jsonb_build_object('name', btrim(p_name), 'periods', to_jsonb(p_periods)));

  return v_plan;
end $$;

create or replace function retire_meal_plan(p_plan uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_was boolean;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may retire a Meal Plan';
  end if;
  select active into v_was from meal_plans where id = p_plan;
  if v_was is null then raise exception 'Meal Plan not found'; end if;

  update meal_plans
     set active = p_active,
         retired_at = case when p_active then null else now() end,
         retired_by = case when p_active then null else auth.uid() end,
         updated_at = now()
   where id = p_plan;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value)
  values (auth.uid(),
          case when p_active then 'meal_plan.reactivate' else 'meal_plan.retire' end,
          'meal_plans', p_plan,
          jsonb_build_object('active', v_was),
          jsonb_build_object('active', p_active));
end $$;

create or replace function set_institution_meal_plans(p_inst uuid, p_plans uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_before uuid[]; v_orphans int;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may set which Meal Plans an Institution may use';
  end if;
  if not app_institution_is_active(p_inst) then
    raise exception 'That institution is archived.' using errcode = 'check_violation';
  end if;

  select array_agg(meal_plan_id) into v_before
    from institution_meal_plans where institution_id = p_inst;

  -- Removing availability must not strand a live assignment: a child would be
  -- holding a Plan their site is no longer allowed to use, and the next
  -- activation validation would refuse for a reason nobody could act on.
  select count(*) into v_orphans
    from student_meal_plans smp
    join students s on s.id = smp.student_id
   where s.institution_id = p_inst
     and (smp.effective_until is null or smp.effective_until >= current_date)
     and smp.meal_plan_id <> all (coalesce(p_plans, '{}'::uuid[]));
  if v_orphans > 0 then
    raise exception
      'Cannot remove those Meal Plans: % Student assignment(s) at this institution '
      'still use them. End or replace those assignments first.', v_orphans;
  end if;

  delete from institution_meal_plans
   where institution_id = p_inst
     and meal_plan_id <> all (coalesce(p_plans, '{}'::uuid[]));
  insert into institution_meal_plans (institution_id, meal_plan_id, created_by)
    select p_inst, p, auth.uid() from unnest(coalesce(p_plans, '{}'::uuid[])) as p
    on conflict do nothing;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value)
  values (auth.uid(), 'institution.meal_plans_available', 'institutions', p_inst,
          jsonb_build_object('plans', to_jsonb(v_before)),
          jsonb_build_object('plans', to_jsonb(p_plans)));
end $$;

-- Assign (or schedule) a Plan for one Student.
--
-- Returns the new assignment id. Ends an open assignment that would otherwise
-- overlap, rather than failing on the exclusion constraint with a message no
-- operator could read.
create or replace function assign_student_meal_plan(
  p_student uuid,
  p_plan    uuid,
  p_from    date,
  p_note    text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_inst uuid; v_id uuid; v_prev uuid; v_prev_from date;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may set a Student''s Meal Plan';
  end if;
  if p_from is null then raise exception 'An effective date is required'; end if;

  select institution_id into v_inst from students where id = p_student;
  if v_inst is null then raise exception 'Student not found'; end if;
  if not app_institution_is_active(v_inst) then
    raise exception 'That institution is archived.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from meal_plans where id = p_plan and active) then
    raise exception 'That Meal Plan does not exist or is retired';
  end if;
  if not exists (
    select 1 from institution_meal_plans
     where institution_id = v_inst and meal_plan_id = p_plan
  ) then
    raise exception 'That Meal Plan is not available at this Student''s institution';
  end if;

  -- A Plan may only promise sittings the site actually serves on that date.
  -- Otherwise demand would be asked to produce a Meal the Institution has no
  -- service configuration for.
  if exists (
    select 1 from meal_plan_periods mpp
     where mpp.meal_plan_id = p_plan
       and not exists (
         select 1 from institution_service_plans isp
          where isp.institution_id = v_inst
            and isp.effective_from <= p_from
            and (isp.effective_to is null or isp.effective_to >= p_from)
            and mpp.period = any (isp.periods)
       )
  ) then
    raise exception
      'That Meal Plan includes a Meal Period this institution does not serve on %. '
      'Update the institution service configuration first.', p_from;
  end if;

  -- Close any assignment still open on the day before the new one starts.
  select id, effective_from into v_prev, v_prev_from
    from student_meal_plans
   where student_id = p_student
     and effective_until is null
     and effective_from < p_from
   order by effective_from desc limit 1;
  if v_prev is not null then
    update student_meal_plans
       set effective_until = p_from - 1, ended_by = auth.uid(), ended_at = now()
     where id = v_prev;
  end if;

  insert into student_meal_plans (student_id, meal_plan_id, effective_from,
                                  assigned_by, note)
  values (p_student, p_plan, p_from, auth.uid(), nullif(btrim(coalesce(p_note,'')), ''))
  returning id into v_id;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(), 'student.meal_plan_assigned', 'students', p_student,
          case when v_prev is null then null
               else jsonb_build_object('ended_assignment', v_prev,
                                       'effective_from', v_prev_from) end,
          jsonb_build_object('meal_plan_id', p_plan, 'effective_from', p_from,
                             'assignment_id', v_id),
          nullif(btrim(coalesce(p_note,'')), ''));
  return v_id;
end $$;

create or replace function end_student_meal_plan(
  p_assignment uuid, p_until date, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_from date; v_was date;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may end a Student''s Meal Plan';
  end if;
  select student_id, effective_from, effective_until
    into v_student, v_from, v_was
    from student_meal_plans where id = p_assignment;
  if v_student is null then raise exception 'Assignment not found'; end if;
  if p_until < v_from then
    raise exception 'A Meal Plan cannot end before it started';
  end if;

  update student_meal_plans
     set effective_until = p_until, ended_by = auth.uid(), ended_at = now()
   where id = p_assignment;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(), 'student.meal_plan_ended', 'students', v_student,
          jsonb_build_object('effective_until', v_was),
          jsonb_build_object('effective_until', p_until, 'assignment_id', p_assignment),
          nullif(btrim(coalesce(p_reason,'')), ''));
end $$;

-- Bulk assignment. Onboarding an Institution means many children at once, and
-- doing that one row at a time through the UI is how mistakes happen.
--
-- ATOMIC BY CONSTRUCTION: a plpgsql function runs in a single transaction, so
-- any raise below rolls the whole call back. The failure names every refused
-- Student rather than stopping at the first, because an operator fixing a
-- roster wants the whole list, not one name at a time.
create or replace function bulk_assign_student_meal_plan(
  p_students uuid[],
  p_plan     uuid,
  p_from     date,
  p_note     text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_count int := 0; v_failures text[] := '{}';
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may set Student Meal Plans';
  end if;
  if p_students is null or array_length(p_students, 1) is null then
    raise exception 'Select at least one Student';
  end if;

  foreach v_id in array p_students loop
    begin
      perform assign_student_meal_plan(v_id, p_plan, p_from, p_note);
      v_count := v_count + 1;
    exception when others then
      v_failures := v_failures || format('%s: %s',
        coalesce((select given_name || ' ' || family_name from students where id = v_id),
                 v_id::text),
        sqlerrm);
    end;
  end loop;

  if array_length(v_failures, 1) is not null then
    raise exception 'No Students were changed. % of % could not be assigned: %',
      array_length(v_failures, 1), array_length(p_students, 1),
      array_to_string(v_failures, ' | ');
  end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value, reason)
  values (auth.uid(), 'student.meal_plan_bulk_assigned', 'meal_plans', p_plan,
          jsonb_build_object('students', v_count, 'effective_from', p_from),
          nullif(btrim(coalesce(p_note,'')), ''));
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- READINESS + ACTIVATION
--
-- The activation gate is the whole reason this rollout is safe. It answers
-- "who is not ready" BEFORE anything changes, so the Super Admin fixes a roster
-- instead of discovering the gap in tomorrow's production numbers.
-- ---------------------------------------------------------------------
create or replace function institution_plan_readiness(p_inst uuid, p_from date)
returns table (
  student_id   uuid,
  student_no   text,
  student_name text,
  class_name   text,
  problem      text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.student_no, s.given_name || ' ' || s.family_name, c.name,
         case
           when app_student_plan_on(s.id, p_from) is null
             then 'No Meal Plan covering ' || p_from
           when not exists (
             select 1 from institution_meal_plans imp
              where imp.institution_id = s.institution_id
                and imp.meal_plan_id = app_student_plan_on(s.id, p_from))
             then 'Assigned Plan is not available at this institution'
           else 'Plan includes a Meal Period this institution does not serve'
         end
    from students s
    left join classes c on c.id = s.class_id
   where s.institution_id = p_inst
     and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
     and (app_is_super_admin() or app_can_manage_institution(p_inst))
     and (
       app_student_plan_on(s.id, p_from) is null
       or not exists (
         select 1 from institution_meal_plans imp
          where imp.institution_id = s.institution_id
            and imp.meal_plan_id = app_student_plan_on(s.id, p_from))
       or exists (
         select 1 from meal_plan_periods mpp
          where mpp.meal_plan_id = app_student_plan_on(s.id, p_from)
            and not exists (
              select 1 from institution_service_plans isp
               where isp.institution_id = p_inst
                 and isp.effective_from <= p_from
                 and (isp.effective_to is null or isp.effective_to >= p_from)
                 and mpp.period = any (isp.periods)))
     )
   order by c.name nulls last, s.family_name, s.given_name;
$$;

create or replace function activate_student_meal_plans(p_inst uuid, p_from date)
returns void language plpgsql security definer set search_path = public as $$
declare v_gaps int; v_prev date;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may activate Student Meal Plans';
  end if;
  if p_from is null then raise exception 'An activation date is required'; end if;
  if not app_institution_is_active(p_inst) then
    raise exception 'That institution is archived.' using errcode = 'check_violation';
  end if;

  select count(*) into v_gaps from institution_plan_readiness(p_inst, p_from);
  if v_gaps > 0 then
    raise exception
      'Not activated. % Student(s) do not have a valid Meal Plan covering %. '
      'Resolve them on the Students screen first.', v_gaps, p_from;
  end if;

  select student_plan_enforced_from into v_prev from institutions where id = p_inst;

  update institutions
     set student_plan_enforced_from = p_from,
         student_plan_activated_by = auth.uid(),
         student_plan_activated_at = now()
   where id = p_inst;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value)
  values (auth.uid(), 'institution.plan_enforcement_activated', 'institutions', p_inst,
          jsonb_build_object('student_plan_enforced_from', v_prev),
          jsonb_build_object('student_plan_enforced_from', p_from));
end $$;

-- =====================================================================
-- RLS + GRANTS
--
-- Table grants come first deliberately: PostgreSQL checks privileges BEFORE it
-- consults a policy, so a table with policies and no grant is unreachable and a
-- function with no explicit grant is executable by PUBLIC — which includes
-- anon. 0042 and 0047 were each one half of that lesson.
-- =====================================================================
alter table meal_plans             enable row level security;
alter table meal_plan_periods      enable row level security;
alter table institution_meal_plans enable row level security;
alter table student_meal_plans     enable row level security;

grant select on meal_plans, meal_plan_periods, institution_meal_plans,
                student_meal_plans to authenticated;
revoke all on meal_plans, meal_plan_periods, institution_meal_plans,
              student_meal_plans from anon;

-- Catalogue readable by any signed-in operator; a Parent has no use for it and
-- gets no row.
drop policy if exists meal_plans_select on meal_plans;
create policy meal_plans_select on meal_plans for select
  using (app_current_role() is not null and app_current_role() <> 'parent');

drop policy if exists meal_plan_periods_select on meal_plan_periods;
create policy meal_plan_periods_select on meal_plan_periods for select
  using (app_current_role() is not null and app_current_role() <> 'parent');

-- Availability is visible to the site it concerns.
drop policy if exists institution_meal_plans_select on institution_meal_plans;
create policy institution_meal_plans_select on institution_meal_plans for select
  using (app_can_see_institution(institution_id));

-- A child's entitlement follows the existing "who may see this child" rule, so
-- a Parent sees their own child's Plan and nobody else's, and no new visibility
-- is invented here.
drop policy if exists student_meal_plans_select on student_meal_plans;
create policy student_meal_plans_select on student_meal_plans for select
  using (app_can_see_student(student_id));

-- No INSERT/UPDATE/DELETE policy on any of the four: every write goes through
-- the SECURITY DEFINER functions above, which is where the authority, the
-- validation and the audit row live together.

revoke all on function save_meal_plan(uuid,text,app_period[])                   from public, anon;
revoke all on function retire_meal_plan(uuid,boolean)                           from public, anon;
revoke all on function set_institution_meal_plans(uuid,uuid[])                  from public, anon;
revoke all on function assign_student_meal_plan(uuid,uuid,date,text)            from public, anon;
revoke all on function end_student_meal_plan(uuid,date,text)                    from public, anon;
revoke all on function bulk_assign_student_meal_plan(uuid[],uuid,date,text)     from public, anon;
revoke all on function activate_student_meal_plans(uuid,date)                   from public, anon;
revoke all on function institution_plan_readiness(uuid,date)                    from public, anon;
revoke all on function app_student_plan_on(uuid,date)                           from public, anon;
revoke all on function app_student_entitled(uuid,date,app_period)               from public, anon;
revoke all on function app_plan_enforced(uuid,date)                             from public, anon;
revoke all on function app_student_counts_for(uuid,uuid,date,app_period)        from public, anon;

grant execute on function save_meal_plan(uuid,text,app_period[])               to authenticated;
grant execute on function retire_meal_plan(uuid,boolean)                       to authenticated;
grant execute on function set_institution_meal_plans(uuid,uuid[])              to authenticated;
grant execute on function assign_student_meal_plan(uuid,uuid,date,text)        to authenticated;
grant execute on function end_student_meal_plan(uuid,date,text)                to authenticated;
grant execute on function bulk_assign_student_meal_plan(uuid[],uuid,date,text) to authenticated;
grant execute on function activate_student_meal_plans(uuid,date)               to authenticated;
grant execute on function institution_plan_readiness(uuid,date)                to authenticated;
grant execute on function app_student_plan_on(uuid,date)                       to authenticated;
grant execute on function app_student_entitled(uuid,date,app_period)           to authenticated;
grant execute on function app_plan_enforced(uuid,date)                         to authenticated;
grant execute on function app_student_counts_for(uuid,uuid,date,app_period)    to authenticated;
