-- =====================================================================
-- 0050 — EXACT DEMAND, AND FREEZING IT
--
-- THE RULE (§16). One Meal is required for one child when ALL hold:
--
--   1. a Published Meal Service exists
--   2. the Institution is active
--   3. the Institution's service configuration includes that Meal Period
--   4. the Student is operationally active for LunchBox service
--   5. the Student holds an effective Meal Plan on that date
--   6. that Plan contains the Meal Period
--   7. any approved dietary requirement has an operational resolution
--
-- Conditions 5 and 6 apply ONLY on and after that Institution's
-- student_plan_enforced_from. Before it, this function must return exactly what
-- it returned before 0048 existed, because real service is running on those
-- numbers and a silent change would be a change to what children are fed.
-- app_student_counts_for() from 0048 is the single place that boundary lives.
--
-- ONE FOR ONE (§27). A special Meal REPLACES the standard Meal. 80 entitled
-- children with 3 alternatives is 77 standard + 3 special = 80. Never 83. The
-- standard count here is computed as "entitled MINUS those with an assigned
-- alternative", so the total cannot inflate arithmetically — it is not a
-- convention that a later query could forget.
--
-- ATTENDANCE IS NOT ENTITLEMENT (§18). Absent / Unwell / Asleep are Classroom
-- outcomes recorded after the fact. They never retro-reduce demand: the Meal
-- was made because the child was entitled to it, and that stays true.
-- =====================================================================

-- ---------------------------------------------------------------------
-- LIVE DEMAND. Replaces meal_production_demand(date) IN PLACE — same name,
-- same consumers, extended shape. A second demand engine beside the first is
-- exactly the parallel system this must not become.
--
-- Columns kept from the previous signature so existing callers keep working:
--   institution_id, institution_name, period, meal_revision_id, meal_name,
--   eligible_students, safety_note_flagged
-- Added:
--   standard_required, special_required, total_required,
--   unresolved_decisions, plan_enforced, meal_service_id
-- ---------------------------------------------------------------------
drop function if exists meal_production_demand(date);
create function meal_production_demand(p_date date)
returns table (
  institution_id      uuid,
  institution_name    text,
  meal_service_id     uuid,
  period              app_period,
  meal_revision_id    uuid,
  meal_name           text,
  eligible_students   bigint,
  safety_note_flagged bigint,
  standard_required   bigint,
  special_required    bigint,
  total_required      bigint,
  unresolved_decisions bigint,
  plan_enforced       boolean
)
language sql stable security definer set search_path = public as $$
  with visible as (
    select ms.id, ms.institution_id, ms.service_date, ms.period, ms.meal_revision_id
      from meal_services ms
      join app_users me on me.user_id = auth.uid()
     where ms.published
       and ms.service_date = p_date
       and me.active
       and (me.role = 'super_admin' or me.role = 'kitchen')
  ),
  entitled as (
    select v.id as service_id, s.id as student_id,
           jsonb_array_length(s.medical_notes) > 0 as has_legacy_note,
           exists (
             select 1 from special_meal_resolutions smr
              where smr.meal_service_id = v.id and smr.student_id = s.id
                and smr.resolution = 'ALTERNATIVE_ASSIGNED') as gets_alternative,
           app_requires_meal_decision(s.id, v.id)
             and not exists (
               select 1 from special_meal_resolutions smr
                where smr.meal_service_id = v.id and smr.student_id = s.id) as unresolved
      from visible v
      join students s on s.institution_id = v.institution_id
     where app_student_counts_for(s.id, v.institution_id, v.service_date, v.period)
  )
  select v.institution_id, i.name, v.id, v.period, v.meal_revision_id, mr.name,
         count(e.student_id),
         count(e.student_id) filter (where e.has_legacy_note),
         count(e.student_id) filter (where not e.gets_alternative),
         count(e.student_id) filter (where e.gets_alternative),
         count(e.student_id),
         count(e.student_id) filter (where e.unresolved),
         app_plan_enforced(v.institution_id, v.service_date)
    from visible v
    join institutions i on i.id = v.institution_id
    left join meal_revisions mr on mr.id = v.meal_revision_id
    left join entitled e on e.service_id = v.id
   group by v.institution_id, i.name, v.id, v.period, v.meal_revision_id, mr.name,
            v.service_date
   order by v.period, mr.name, i.name;
$$;

revoke all on function meal_production_demand(date) from public, anon;
grant execute on function meal_production_demand(date) to authenticated;
comment on function meal_production_demand(date) is
  'Live Kitchen demand for the Super Admin and the Kitchen only. total_required '
  '= standard_required + special_required ALWAYS: a special Meal replaces the '
  'standard one. Before an Institution''s student_plan_enforced_from, '
  'eligible_students keeps its pre-0048 meaning (every operationally active '
  'child); on and after it, Student Meal Plan entitlement governs. '
  'safety_note_flagged counts legacy free-text notes and is NOT an '
  'authoritative allergy flag.';

-- ---------------------------------------------------------------------
-- FINAL DEMAND — the snapshot Production is allowed to work from.
--
-- Why a snapshot rather than re-reading the live query: once the Kitchen starts
-- cooking, the numbers they cooked to are a fact about the day. A later Plan
-- change or Menu edit must not silently rewrite what was already produced,
-- packed and delivered. §31 turns such a change into a visible decision instead.
-- ---------------------------------------------------------------------
create table if not exists final_demand (
  id                uuid primary key default gen_random_uuid(),
  institution_id    uuid not null references institutions (id) on delete cascade,
  service_date      date not null,
  period            app_period not null,
  meal_service_id   uuid not null references meal_services (id) on delete restrict,
  meal_revision_id  uuid references meal_revisions (id) on delete restrict,
  entitled_students integer not null,
  standard_quantity integer not null,
  special_quantity  integer not null,
  total_quantity    integer not null,
  plan_enforced     boolean not null,
  finalized_by      uuid references app_users (user_id) on delete set null,
  finalized_at      timestamptz not null default now(),
  superseded_at     timestamptz,
  superseded_by     uuid references app_users (user_id) on delete set null,
  adjustment_reason text,
  constraint final_demand_one_for_one
    check (total_quantity = standard_quantity + special_quantity),
  constraint final_demand_non_negative
    check (standard_quantity >= 0 and special_quantity >= 0)
);

-- One LIVE snapshot per service. Superseded rows stay for history, which is why
-- the uniqueness is partial rather than a plain unique constraint.
create unique index if not exists final_demand_live_idx
  on final_demand (meal_service_id) where superseded_at is null;
create index if not exists final_demand_day_idx
  on final_demand (institution_id, service_date, period);

comment on table final_demand is
  'Frozen production quantities for one published Meal Service. '
  'total = standard + special, enforced by CHECK. Superseded rather than '
  'updated when an adjustment is applied, so what the Kitchen actually cooked '
  'to stays readable.';

-- The individual special Meals inside a snapshot, so the Kitchen can account
-- for each one and a label can be printed per child.
create table if not exists final_demand_special_lines (
  id               uuid primary key default gen_random_uuid(),
  final_demand_id  uuid not null references final_demand (id) on delete cascade,
  student_id       uuid not null references students (id) on delete restrict,
  meal_revision_id uuid not null references meal_revisions (id) on delete restrict,
  reference        text not null,
  prep_note        text,
  produced_at      timestamptz,
  produced_by      uuid references app_users (user_id) on delete set null,
  packed_at        timestamptz,
  packed_by        uuid references app_users (user_id) on delete set null,
  unique (final_demand_id, student_id)
);

comment on table final_demand_special_lines is
  'One row per special Meal in a Final Demand snapshot. Individually confirmed '
  'through Production and Packing, because "we made 3 specials" is not the same '
  'assurance as "this child''s Meal was made".';

-- ---------------------------------------------------------------------
create or replace function finalize_demand(p_service uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_row record; v_id uuid; v_unresolved int; v_inst uuid; v_date date;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may finalise demand';
  end if;

  select institution_id, service_date into v_inst, v_date
    from meal_services where id = p_service and published;
  if v_inst is null then
    raise exception 'That Meal Service does not exist or is not published';
  end if;

  -- THE BLOCKING RULE (§25/§26): a child with an approved requirement and no
  -- recorded decision stops the freeze. Not a warning — production must not
  -- begin while it is unknown what that child is served.
  select count(*) into v_unresolved from unresolved_meal_decisions(p_service);
  if v_unresolved > 0 then
    raise exception
      '% Student(s) with an approved dietary requirement have no meal decision '
      'for this service. Confirm the standard Meal or assign an alternative first.',
      v_unresolved;
  end if;

  if exists (select 1 from final_demand where meal_service_id = p_service
              and superseded_at is null) then
    raise exception 'Demand for this service is already finalised';
  end if;

  select * into v_row from meal_production_demand(v_date)
   where meal_service_id = p_service;
  if v_row is null then
    raise exception 'No demand could be calculated for this service';
  end if;

  insert into final_demand
    (institution_id, service_date, period, meal_service_id, meal_revision_id,
     entitled_students, standard_quantity, special_quantity, total_quantity,
     plan_enforced, finalized_by)
  values (v_row.institution_id, v_date, v_row.period, p_service, v_row.meal_revision_id,
          v_row.total_required, v_row.standard_required, v_row.special_required,
          v_row.total_required, v_row.plan_enforced, auth.uid())
  returning id into v_id;

  insert into final_demand_special_lines
    (final_demand_id, student_id, meal_revision_id, reference, prep_note)
  select v_id, smr.student_id, smr.meal_revision_id, smr.reference, smr.prep_note
    from special_meal_resolutions smr
   where smr.meal_service_id = p_service
     and smr.resolution = 'ALTERNATIVE_ASSIGNED';

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'demand.finalized', 'final_demand', v_id,
          jsonb_build_object('meal_service_id', p_service,
                             'standard', v_row.standard_required,
                             'special', v_row.special_required,
                             'total', v_row.total_required,
                             'plan_enforced', v_row.plan_enforced));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- LATE CHANGE (§31). Compare the frozen snapshot against what the same rules
-- would produce now. Silence means nothing drifted.
-- ---------------------------------------------------------------------
create or replace function demand_drift(p_date date)
returns table (
  final_demand_id   uuid,
  institution_name  text,
  period            app_period,
  meal_name         text,
  finalized_total   integer,
  recalculated_total bigint,
  finalized_standard integer,
  recalculated_standard bigint,
  finalized_special integer,
  recalculated_special bigint
)
language sql stable security definer set search_path = public as $$
  select fd.id, i.name, fd.period, mr.name,
         fd.total_quantity, d.total_required,
         fd.standard_quantity, d.standard_required,
         fd.special_quantity, d.special_required
    from final_demand fd
    join institutions i on i.id = fd.institution_id
    left join meal_revisions mr on mr.id = fd.meal_revision_id
    join meal_production_demand(p_date) d on d.meal_service_id = fd.meal_service_id
   where fd.service_date = p_date
     and fd.superseded_at is null
     and app_is_super_admin()
     and (fd.total_quantity is distinct from d.total_required
          or fd.standard_quantity is distinct from d.standard_required
          or fd.special_quantity is distinct from d.special_required)
   order by i.name, fd.period;
$$;

create or replace function adjust_final_demand(p_final uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_service uuid; v_date date; v_row record; v_new uuid; v_old jsonb;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may adjust finalised demand';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to change finalised demand';
  end if;

  select meal_service_id, service_date, to_jsonb(fd) into v_service, v_date, v_old
    from final_demand fd where fd.id = p_final and fd.superseded_at is null;
  if v_service is null then
    raise exception 'That finalised demand does not exist or was already superseded';
  end if;

  select * into v_row from meal_production_demand(v_date)
   where meal_service_id = v_service;
  if v_row is null then raise exception 'No demand could be recalculated'; end if;

  -- Supersede, never overwrite: the row the Kitchen cooked to survives.
  update final_demand
     set superseded_at = now(), superseded_by = auth.uid(), adjustment_reason = btrim(p_reason)
   where id = p_final;

  insert into final_demand
    (institution_id, service_date, period, meal_service_id, meal_revision_id,
     entitled_students, standard_quantity, special_quantity, total_quantity,
     plan_enforced, finalized_by, adjustment_reason)
  values (v_row.institution_id, v_date, v_row.period, v_service, v_row.meal_revision_id,
          v_row.total_required, v_row.standard_required, v_row.special_required,
          v_row.total_required, v_row.plan_enforced, auth.uid(), btrim(p_reason))
  returning id into v_new;

  insert into final_demand_special_lines
    (final_demand_id, student_id, meal_revision_id, reference, prep_note)
  select v_new, smr.student_id, smr.meal_revision_id, smr.reference, smr.prep_note
    from special_meal_resolutions smr
   where smr.meal_service_id = v_service and smr.resolution = 'ALTERNATIVE_ASSIGNED';

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(), 'demand.adjusted', 'final_demand', v_new, v_old,
          jsonb_build_object('standard', v_row.standard_required,
                             'special', v_row.special_required,
                             'total', v_row.total_required,
                             'superseded', p_final),
          btrim(p_reason));
  return v_new;
end $$;

-- Keeping the frozen figures deliberately is also a decision, and is recorded.
create or replace function keep_final_demand(p_final uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may act on finalised demand';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  if not exists (select 1 from final_demand where id = p_final and superseded_at is null) then
    raise exception 'That finalised demand does not exist or was already superseded';
  end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value, reason)
  values (auth.uid(), 'demand.kept_despite_change', 'final_demand', p_final,
          jsonb_build_object('decision', 'keep_finalized'), btrim(p_reason));
end $$;

-- =====================================================================
-- ENTITLEMENT FOR THE CLASSROOM AND THE PARENT (§19/§20)
--
-- One function, so the roster the Classroom records against and the periods the
-- Parent sees cannot disagree about who receives what.
-- =====================================================================
create or replace function service_roster(p_service uuid)
returns table (
  student_id     uuid,
  student_no     text,
  given_name     text,
  family_name    text,
  class_id       uuid,
  entitled       boolean,
  special_reference text,
  actual_meal_revision_id uuid,
  actual_meal_name text,
  decision_pending boolean
)
language sql stable security definer set search_path = public as $$
  select s.id, s.student_no, s.given_name, s.family_name, s.class_id,
         app_student_counts_for(s.id, ms.institution_id, ms.service_date, ms.period),
         smr.reference,
         coalesce(smr.meal_revision_id, ms.meal_revision_id),
         coalesce(alt.name, std.name),
         app_requires_meal_decision(s.id, ms.id) and smr.id is null
    from meal_services ms
    join students s on s.institution_id = ms.institution_id
    left join special_meal_resolutions smr
      on smr.meal_service_id = ms.id and smr.student_id = s.id
     and smr.resolution = 'ALTERNATIVE_ASSIGNED'
    left join meal_revisions alt on alt.id = smr.meal_revision_id
    left join meal_revisions std on std.id = ms.meal_revision_id
   where ms.id = p_service
     and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
     and app_can_see_student(s.id)
   order by s.family_name, s.given_name;
$$;

comment on function service_roster(uuid) is
  'Who is on this service and what each child actually receives. `entitled` is '
  'false for a child whose Meal Plan does not include this sitting — the '
  'Classroom must not record them, and they are not a missed meal. Visibility '
  'follows the existing app_can_see_student() rule, so a Parent sees only their '
  'own child.';

-- =====================================================================
-- RLS + GRANTS
-- =====================================================================
alter table final_demand               enable row level security;
alter table final_demand_special_lines enable row level security;

grant select on final_demand, final_demand_special_lines to authenticated;
revoke all on final_demand, final_demand_special_lines from anon;

-- Production planning is LunchBox-internal: the Super Admin and the Kitchen.
-- Institution access to Kitchen Production remains NOT_YET_DEFINED and is
-- therefore denied, exactly as 0036 decided for the demand function.
drop policy if exists final_demand_select on final_demand;
create policy final_demand_select on final_demand for select
  using (app_is_super_admin() or app_current_role() = 'kitchen');

drop policy if exists final_demand_special_lines_select on final_demand_special_lines;
create policy final_demand_special_lines_select on final_demand_special_lines for select
  using (app_is_super_admin() or app_current_role() = 'kitchen');

revoke all on function finalize_demand(uuid)            from public, anon;
revoke all on function adjust_final_demand(uuid,text)    from public, anon;
revoke all on function keep_final_demand(uuid,text)      from public, anon;
revoke all on function demand_drift(date)                from public, anon;
revoke all on function service_roster(uuid)              from public, anon;

grant execute on function finalize_demand(uuid)         to authenticated;
grant execute on function adjust_final_demand(uuid,text) to authenticated;
grant execute on function keep_final_demand(uuid,text)   to authenticated;
grant execute on function demand_drift(date)             to authenticated;
grant execute on function service_roster(uuid)           to authenticated;
