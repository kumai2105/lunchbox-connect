-- =====================================================================
-- 0049 — DIETARY REQUIREMENTS AND SPECIAL MEALS
--
-- WHAT THIS REFUSES TO DO, FIRST, BECAUSE IT MATTERS MOST
--
-- `students.medical_notes` is free text an Institution typed. It is NOT
-- converted into an authoritative dietary requirement here. It is not parsed,
-- not string-matched into a clinical decision, not migrated, and not touched at
-- all. A Super Admin is shown that a legacy note EXISTS and must read it; the
-- software draws no conclusion from it.
--
-- There is no severity scale, no diagnosis field, no "medically safe" flag and
-- no automatic conflict engine matching allergen strings against ingredient
-- strings. Free text cannot carry a child-safety guarantee, and a screen that
-- said "safe" on the strength of a LIKE would be worse than one that says
-- nothing — it would be trusted.
--
-- WHAT IT DOES INSTEAD
--
-- A controlled record with a human decision at the end of it:
--
--   Institution Admin SUBMITS a factual requirement for their own child
--     → Super Admin REVIEWS it (approve / needs clarification / reject)
--       → for every entitled Published Meal Service, a Super Admin RESOLVES
--         what that child is actually served: the standard Meal, deliberately
--         confirmed, or a named alternative Meal Revision from the Meal Library.
--
-- The system records WHO decided and WHEN. It never decides by itself, and it
-- never silently serves the standard Meal to a child with an open requirement.
--
-- ONE FOR ONE. A special Meal REPLACES the standard Meal for that child. It is
-- not an extra Meal. 80 entitled children with 3 alternatives is 77 + 3 = 80,
-- never 80 + 3. That invariant is asserted in the demand layer (0050) and in
-- the SQL suite, not merely intended here.
-- =====================================================================

create type dietary_requirement_type as enum (
  'ALLERGY',
  'DIETARY_RESTRICTION',
  'OTHER_MEAL_REQUIREMENT'
);

create type dietary_review_status as enum (
  'SUBMITTED',
  'APPROVED',
  'NEEDS_CLARIFICATION',
  'REJECTED',
  'ENDED'
);

-- 'STANDARD_CONFIRMED' — a human looked at this requirement and this Meal and
-- decided the standard Meal is the right one to serve. It is a DECISION, not a
-- default, which is why it is stored rather than inferred from absence.
create type special_meal_resolution_kind as enum (
  'STANDARD_CONFIRMED',
  'ALTERNATIVE_ASSIGNED'
);

-- ---------------------------------------------------------------------
create table if not exists student_dietary_requirements (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students (id) on delete cascade,
  requirement_type dietary_requirement_type not null,
  requirement_text text not null,
  source           text,
  effective_from   date not null default current_date,
  effective_until  date,
  submitted_by     uuid references app_users (user_id) on delete set null,
  submitted_at     timestamptz not null default now(),
  review_status    dietary_review_status not null default 'SUBMITTED',
  reviewed_by      uuid references app_users (user_id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text,
  constraint dietary_text_not_blank check (btrim(requirement_text) <> ''),
  constraint dietary_dates check (
    effective_until is null or effective_until >= effective_from
  )
);

create index if not exists dietary_student_idx
  on student_dietary_requirements (student_id, review_status);
create index if not exists dietary_review_queue_idx
  on student_dietary_requirements (review_status, submitted_at);

comment on table student_dietary_requirements is
  'Controlled dietary / meal requirement for one child, submitted by the '
  'Institution and reviewed by LunchBox. Deliberately carries NO severity, NO '
  'diagnosis and NO clinical judgement — it is a factual operational '
  'requirement plus a recorded human review. Separate from, and never derived '
  'from, students.medical_notes free text.';

-- ---------------------------------------------------------------------
-- THE OPERATIONAL DECISION, per child per published service.
-- ---------------------------------------------------------------------
create table if not exists special_meal_resolutions (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students (id) on delete cascade,
  meal_service_id  uuid not null references meal_services (id) on delete cascade,
  requirement_id   uuid references student_dietary_requirements (id) on delete set null,
  resolution       special_meal_resolution_kind not null,
  -- Populated only for ALTERNATIVE_ASSIGNED, and it must be a real Meal
  -- Revision from the Meal Library. No invisible one-off food typed into a box.
  meal_revision_id uuid references meal_revisions (id) on delete restrict,
  reference        text not null,
  prep_note        text,
  resolved_by      uuid references app_users (user_id) on delete set null,
  resolved_at      timestamptz not null default now(),
  constraint special_meal_alternative_needs_meal check (
    (resolution = 'ALTERNATIVE_ASSIGNED' and meal_revision_id is not null)
    or (resolution = 'STANDARD_CONFIRMED' and meal_revision_id is null)
  ),
  -- ONE decision per child per service. This is what makes the replacement
  -- one-for-one at the database level rather than by convention.
  unique (student_id, meal_service_id)
);

create index if not exists special_meal_service_idx
  on special_meal_resolutions (meal_service_id, resolution);

comment on table special_meal_resolutions is
  'What a child with an approved dietary requirement is ACTUALLY served for one '
  'published Meal Service. Exactly one row per child per service, so a special '
  'Meal always REPLACES the standard Meal and never adds to the count. '
  '`reference` is the short human-readable handle printed on the special label '
  'and used at handover.';

-- A short stable handle for the packing bench and the classroom. Derived from
-- the row's own id so it needs no counter and cannot collide.
create or replace function app_special_meal_reference(p_id uuid)
returns text language sql immutable as $$
  select 'SM-' || upper(substring(replace(p_id::text, '-', '') from 1 for 6));
$$;

-- =====================================================================
-- WHO NEEDS A DECISION — the question the finalisation gate asks.
--
-- A child needs one when they hold an APPROVED requirement in force on the
-- service date AND they are entitled to that sitting. Entitlement comes from
-- 0048, so a Morning-only child never blocks a Lunch service.
-- =====================================================================
create or replace function app_requires_meal_decision(p_student uuid, p_service uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from meal_services ms
      join student_dietary_requirements r on r.student_id = p_student
     where ms.id = p_service
       and r.review_status = 'APPROVED'
       and r.effective_from <= ms.service_date
       and (r.effective_until is null or r.effective_until >= ms.service_date)
       and app_student_counts_for(p_student, ms.institution_id, ms.service_date, ms.period)
  );
$$;

-- Every child on a service who still has no recorded decision.
create or replace function unresolved_meal_decisions(p_service uuid)
returns table (
  student_id   uuid,
  student_no   text,
  student_name text,
  requirement_type dietary_requirement_type,
  requirement_text text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.student_no, s.given_name || ' ' || s.family_name,
         r.requirement_type, r.requirement_text
    from meal_services ms
    join students s on s.institution_id = ms.institution_id
    join student_dietary_requirements r on r.student_id = s.id
   where ms.id = p_service
     and app_is_super_admin()
     and r.review_status = 'APPROVED'
     and r.effective_from <= ms.service_date
     and (r.effective_until is null or r.effective_until >= ms.service_date)
     and app_student_counts_for(s.id, ms.institution_id, ms.service_date, ms.period)
     and not exists (
       select 1 from special_meal_resolutions smr
        where smr.student_id = s.id and smr.meal_service_id = ms.id)
   order by s.family_name, s.given_name;
$$;

-- =====================================================================
-- WRITE PATHS
-- =====================================================================

-- SUBMIT — the Institution may speak for its own child, and only its own.
create or replace function submit_dietary_requirement(
  p_student uuid,
  p_type    dietary_requirement_type,
  p_text    text,
  p_source  text default null,
  p_from    date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_inst uuid;
begin
  select institution_id into v_inst from students where id = p_student;
  if v_inst is null then raise exception 'Student not found'; end if;

  -- app_can_manage_institution() already means "Super Admin, or the Admin of
  -- THIS institution", so cross-institution submission is refused here rather
  -- than by a second rule that could drift from it.
  if not app_can_manage_institution(v_inst) then
    raise exception 'You may not submit a requirement for this Student';
  end if;
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'Describe the requirement';
  end if;

  insert into student_dietary_requirements
    (student_id, requirement_type, requirement_text, source, effective_from, submitted_by)
  values (p_student, p_type, btrim(p_text), nullif(btrim(coalesce(p_source,'')), ''),
          coalesce(p_from, current_date), auth.uid())
  returning id into v_id;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'dietary.submitted', 'student_dietary_requirements', v_id,
          jsonb_build_object('student_id', p_student, 'type', p_type,
                             'effective_from', coalesce(p_from, current_date)));
  return v_id;
end $$;

-- REVIEW — LunchBox decides. The Institution that raised it cannot approve it.
create or replace function review_dietary_requirement(
  p_id     uuid,
  p_status dietary_review_status,
  p_note   text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_was dietary_review_status; v_student uuid;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may review a dietary requirement';
  end if;
  if p_status not in ('APPROVED', 'NEEDS_CLARIFICATION', 'REJECTED') then
    raise exception 'Review outcome must be approved, needs clarification, or rejected';
  end if;

  select review_status, student_id into v_was, v_student
    from student_dietary_requirements where id = p_id;
  if v_was is null then raise exception 'Requirement not found'; end if;
  if v_was = 'ENDED' then
    raise exception 'That requirement has ended and is not reviewed again';
  end if;

  update student_dietary_requirements
     set review_status = p_status, reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = nullif(btrim(coalesce(p_note,'')), '')
   where id = p_id;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(), 'dietary.reviewed', 'student_dietary_requirements', p_id,
          jsonb_build_object('review_status', v_was),
          jsonb_build_object('review_status', p_status, 'student_id', v_student),
          nullif(btrim(coalesce(p_note,'')), ''));
end $$;

create or replace function end_dietary_requirement(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_was dietary_review_status;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may end a dietary requirement';
  end if;
  select review_status into v_was from student_dietary_requirements where id = p_id;
  if v_was is null then raise exception 'Requirement not found'; end if;

  -- Ended, never deleted: what was served yesterday was served on the strength
  -- of this record, and that has to stay readable.
  update student_dietary_requirements
     set review_status = 'ENDED',
         effective_until = least(coalesce(effective_until, current_date), current_date),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(), 'dietary.ended', 'student_dietary_requirements', p_id,
          jsonb_build_object('review_status', v_was),
          jsonb_build_object('review_status', 'ENDED'),
          nullif(btrim(coalesce(p_reason,'')), ''));
end $$;

-- RESOLVE — the operational decision for one child on one service.
create or replace function resolve_special_meal(
  p_student   uuid,
  p_service   uuid,
  p_kind      special_meal_resolution_kind,
  p_revision  uuid default null,
  p_prep_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_req uuid; v_inst uuid; v_date date; v_period app_period; v_prev jsonb;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may decide what a child is served';
  end if;

  select institution_id, service_date, period into v_inst, v_date, v_period
    from meal_services where id = p_service;
  if v_inst is null then raise exception 'Meal Service not found'; end if;

  if not app_student_counts_for(p_student, v_inst, v_date, v_period) then
    raise exception
      'That Student is not entitled to this Meal Period on %, so there is '
      'nothing to resolve.', v_date;
  end if;

  select id into v_req from student_dietary_requirements
   where student_id = p_student and review_status = 'APPROVED'
     and effective_from <= v_date
     and (effective_until is null or effective_until >= v_date)
   order by submitted_at limit 1;
  if v_req is null then
    raise exception 'That Student has no approved dietary requirement in force on %', v_date;
  end if;

  if p_kind = 'ALTERNATIVE_ASSIGNED' then
    if p_revision is null then
      raise exception 'Choose the alternative Meal from the Meal Library';
    end if;
    -- The alternative must be a real, non-archived Meal. Creating food that
    -- exists only inside this row would put something on a child's tray that
    -- the Meal Library has never seen.
    if not exists (
      select 1 from meal_revisions mr join meals m on m.id = mr.meal_id
       where mr.id = p_revision and m.active
    ) then
      raise exception 'That alternative Meal does not exist or is archived. '
                      'Add it to the Meal Library first.';
    end if;
  end if;

  select to_jsonb(smr) into v_prev from special_meal_resolutions smr
   where student_id = p_student and meal_service_id = p_service;

  insert into special_meal_resolutions
    (student_id, meal_service_id, requirement_id, resolution, meal_revision_id,
     reference, prep_note, resolved_by)
  values (p_student, p_service, v_req, p_kind,
          case when p_kind = 'ALTERNATIVE_ASSIGNED' then p_revision end,
          'PENDING', nullif(btrim(coalesce(p_prep_note,'')), ''), auth.uid())
  on conflict (student_id, meal_service_id) do update
     set resolution = excluded.resolution,
         meal_revision_id = excluded.meal_revision_id,
         requirement_id = excluded.requirement_id,
         prep_note = excluded.prep_note,
         resolved_by = auth.uid(),
         resolved_at = now()
  returning id into v_id;

  update special_meal_resolutions
     set reference = app_special_meal_reference(v_id) where id = v_id;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value)
  values (auth.uid(),
          case when p_kind = 'ALTERNATIVE_ASSIGNED'
               then 'special_meal.assigned' else 'special_meal.standard_confirmed' end,
          'special_meal_resolutions', v_id, v_prev,
          jsonb_build_object('student_id', p_student, 'meal_service_id', p_service,
                             'resolution', p_kind, 'meal_revision_id', p_revision));
  return v_id;
end $$;

-- =====================================================================
-- KITCHEN'S MINIMUM. Data minimisation is enforced by what this function
-- SELECTS, not by what a screen chooses to render.
--
-- The Kitchen gets: what to make, how to label it, where it goes, and any
-- factual preparation restriction. It does not get guardian contact details,
-- the child's profile, the review narrative, or the requirement's history.
-- First name + last initial is enough to hand the right tray to the right
-- child and is less than a full name.
-- =====================================================================
create or replace function kitchen_special_meals(p_date date)
returns table (
  reference        text,
  institution_name text,
  class_name       text,
  child_label      text,
  meal_name        text,
  period           app_period,
  prep_note        text
)
language sql stable security definer set search_path = public as $$
  select smr.reference, i.name, c.name,
         s.given_name || ' ' || left(s.family_name, 1) || '.',
         mr.name, ms.period, smr.prep_note
    from special_meal_resolutions smr
    join meal_services ms on ms.id = smr.meal_service_id
    join students s on s.id = smr.student_id
    join institutions i on i.id = ms.institution_id
    left join classes c on c.id = s.class_id
    join meal_revisions mr on mr.id = smr.meal_revision_id
    join app_users me on me.user_id = auth.uid()
   where ms.service_date = p_date
     and ms.published
     and smr.resolution = 'ALTERNATIVE_ASSIGNED'
     and me.active
     and (me.role = 'super_admin' or me.role = 'kitchen')
   order by i.name, ms.period, smr.reference;
$$;

-- =====================================================================
-- RLS + GRANTS
-- =====================================================================
alter table student_dietary_requirements enable row level security;
alter table special_meal_resolutions     enable row level security;

grant select on student_dietary_requirements, special_meal_resolutions to authenticated;
revoke all on student_dietary_requirements, special_meal_resolutions from anon;

-- The Institution sees its own child's requirement and its outcome. A Parent
-- does NOT read this record: it carries the internal review narrative, and the
-- Parent-facing truth is the Meal their child is actually served.
drop policy if exists dietary_select on student_dietary_requirements;
create policy dietary_select on student_dietary_requirements for select
  using (
    app_is_super_admin()
    or (app_current_role() = 'school_admin' and app_can_see_student(student_id))
  );

-- The resolution IS Parent-facing truth — it is which Meal their child gets —
-- so it follows the ordinary "who may see this child" rule. The Kitchen reads
-- its minimised projection through kitchen_special_meals() instead.
drop policy if exists special_meal_select on special_meal_resolutions;
create policy special_meal_select on special_meal_resolutions for select
  using (app_can_see_student(student_id));

revoke all on function submit_dietary_requirement(uuid,dietary_requirement_type,text,text,date) from public, anon;
revoke all on function review_dietary_requirement(uuid,dietary_review_status,text)              from public, anon;
revoke all on function end_dietary_requirement(uuid,text)                                       from public, anon;
revoke all on function resolve_special_meal(uuid,uuid,special_meal_resolution_kind,uuid,text)   from public, anon;
revoke all on function unresolved_meal_decisions(uuid)                                          from public, anon;
revoke all on function kitchen_special_meals(date)                                              from public, anon;
revoke all on function app_requires_meal_decision(uuid,uuid)                                    from public, anon;
revoke all on function app_special_meal_reference(uuid)                                         from public, anon;

grant execute on function submit_dietary_requirement(uuid,dietary_requirement_type,text,text,date) to authenticated;
grant execute on function review_dietary_requirement(uuid,dietary_review_status,text)              to authenticated;
grant execute on function end_dietary_requirement(uuid,text)                                       to authenticated;
grant execute on function resolve_special_meal(uuid,uuid,special_meal_resolution_kind,uuid,text)   to authenticated;
grant execute on function unresolved_meal_decisions(uuid)                                          to authenticated;
grant execute on function kitchen_special_meals(date)                                              to authenticated;
grant execute on function app_requires_meal_decision(uuid,uuid)                                    to authenticated;
grant execute on function app_special_meal_reference(uuid)                                         to authenticated;
