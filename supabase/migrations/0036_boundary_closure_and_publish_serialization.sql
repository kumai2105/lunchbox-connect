-- =====================================================================
-- 0036 — Boundary closure: planning/notes/kitchen/demand visibility, the
--        guardian unlink authority, linked-Parent identity for a School
--        Admin, publish↔record serialization, and analytics that never
--        treat an exception as preference evidence.
--
-- New migration; applied history is NOT rewritten. Nothing publishes,
-- assigns or infers business data, and no operational history is deleted.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) Raw PLANNING data is Super-Admin-only.
--
-- The approved boundary is that a Nursery/School Admin sees its own PUBLISHED
-- dated schedule — not the Rotation templates, Service Plans or Calendar
-- configuration behind it. These policies still resolved through
-- app_can_manage_institution(), which includes the school_admin of that
-- institution, so the raw planning tables were readable after all. The
-- /schedule page reads published meal_services and is unaffected.
-- ---------------------------------------------------------------------
drop policy if exists service_plans_select on institution_service_plans;
create policy service_plans_select on institution_service_plans for select
  using (app_is_super_admin());

drop policy if exists rotation_assign_select on institution_rotation_assignments;
create policy rotation_assign_select on institution_rotation_assignments for select
  using (app_is_super_admin());

drop policy if exists calendar_exceptions_select on calendar_exceptions;
create policy calendar_exceptions_select on calendar_exceptions for select
  using (app_is_super_admin());

-- ---------------------------------------------------------------------
-- (5) Guardian UNLINK authority is removed.
--
-- The implemented Super Admin LINK action stays. Removal/unlink semantics are
-- NOT_YET_DEFINED — what happens to the Parent's historical visibility, whether
-- it is reversible, whether anything is retained — so no client may perform it.
-- Existing relationships are preserved untouched.
-- ---------------------------------------------------------------------
drop policy if exists student_parents_delete on student_parents;
revoke delete on student_parents from authenticated, anon;
comment on table student_parents is
  'Authorized Student↔Guardian relationships. LINK is a Super Admin action; '
  'UNLINK is NOT_YET_DEFINED and is therefore available to no API client. '
  'Existing rows are preserved.';

-- ---------------------------------------------------------------------
-- (6) A School Admin may see the IDENTITY of a Parent already linked to one
-- of its own Students — and nothing more.
--
-- Parents are deliberately not institution-scoped, so the previous rule
-- (same institution_id) never matched one. The relationship row was visible
-- while the person behind it was not, which is how the Guardians screen and
-- the Student Profile ended up rendering a bare UUID, or looking as though a
-- child had no guardian at all.
--
-- This grants exactly the linked-parent case. It is NOT a Parent directory: an
-- unlinked Parent, or one linked only to another institution's child, stays
-- invisible. No mutation right is restored.
-- ---------------------------------------------------------------------
create or replace function app_can_see_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.user_id = p_user
        or me.role = 'super_admin'
        or (me.role = 'school_admin'
            and me.institution_id = (select institution_id from app_users target where target.user_id = p_user))
        -- the linked-guardian case
        or (me.role = 'school_admin'
            and exists (
              select 1
                from student_parents sp
                join students s on s.id = sp.student_id
                join app_users target on target.user_id = sp.user_id
               where sp.user_id = p_user
                 and target.role = 'parent'
                 and s.institution_id = me.institution_id
            ))
      )
  );
$$;
comment on function app_can_see_user(uuid) is
  'Who may see an account. A School Admin sees its own institution''s staff, '
  'plus the basic identity of a Parent ALREADY LINKED to one of its own '
  'Students — never an unlinked Parent, and never a global Parent directory.';

-- ---------------------------------------------------------------------
-- (7) Kitchen master data is not public to every signed-in account.
--
-- kitchens_select resolved to "any row in app_users", i.e. every authenticated
-- role could read the whole Kitchen table. Kitchen-entity administration is
-- Super-Admin-only, and a Kitchen account needs only its OWN identity.
-- Production Demand does not read this table and is unaffected.
-- ---------------------------------------------------------------------
drop policy if exists kitchens_select on kitchens;
create policy kitchens_select on kitchens for select
  using (
    app_is_super_admin()
    or exists (
      select 1 from app_users me
      where me.user_id = auth.uid() and me.role = 'kitchen' and me.kitchen_id = kitchens.id
    )
  );

-- ---------------------------------------------------------------------
-- (8) Production Demand is not a School Admin capability.
--
-- Institution access to Kitchen Production is NOT_YET_DEFINED in the canonical
-- permissions, and an undefined permission is denied — not granted because it
-- seemed convenient. Approved consumers are the Super Admin and the Kitchen.
-- The School Admin dashboard uses its own authorized read model instead.
-- ---------------------------------------------------------------------
drop function if exists meal_production_demand(date);
create function meal_production_demand(p_date date)
returns table (
  institution_id   uuid,
  institution_name text,
  period           app_period,
  meal_revision_id uuid,
  meal_name        text,
  eligible_students bigint,
  safety_note_flagged bigint
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
      or me.role = 'kitchen'
      -- School Admin production access is NOT_YET_DEFINED — not granted.
    )
  group by ms.institution_id, i.name, ms.period, ms.meal_revision_id, mr.name
  order by ms.period, mr.name, i.name;
$$;
revoke all on function meal_production_demand(date) from public, anon;
grant execute on function meal_production_demand(date) to authenticated;
comment on function meal_production_demand(date) is
  'Per-published-meal Kitchen demand for the Super Admin and the Kitchen only. '
  'Institution (School Admin) access to Kitchen Production is NOT_YET_DEFINED '
  'and is therefore denied. safety_note_flagged counts eligible students '
  'carrying ANY interim medical_notes entry — NOT an authoritative allergy flag.';

-- ---------------------------------------------------------------------
-- (9) Unpublished Classroom free text is not visible to a School Admin.
--
-- serving_notes_select still admitted app_is_staff(), which includes
-- school_admin — so the role whose PUBLISH authority was removed could still
-- read every unpublished internal note raw. The normal reviewer/internal-note
-- visibility is NOT_YET_DEFINED, so it is denied until it is defined.
--
-- Kept exactly as approved:
--   assigned Classroom Staff  → internal notes for the children they record
--   Parent                    → published text for their own child only
--   Super Admin               → system-wide administrative override
-- Structured Classroom meal RESULTS are untouched by this.
-- ---------------------------------------------------------------------
drop policy if exists serving_notes_select on serving_notes;
create policy serving_notes_select on serving_notes for select
  using (
    exists (
      select 1 from serving_records sr
      where sr.id = serving_record_id and app_can_see_student(sr.student_id)
    )
    and (
      published_at is not null
      or app_is_super_admin()
      -- the ASSIGNED classroom staff, not "staff" generally
      or exists (
        select 1
          from serving_records sr
          join students s on s.id = sr.student_id
          join class_staff cs on cs.class_id = s.class_id
         where sr.id = serving_record_id
           and cs.user_id = auth.uid()
           and app_current_role() = 'classroom_staff'
      )
    )
  );

-- ---------------------------------------------------------------------
-- (13) Serialize republishing against Classroom recording.
--
-- The approved rule is unchanged: a FUTURE, UNSERVED published Meal Service may
-- deliberately re-resolve, and a service that carries serving history is
-- immutable. What was missing is the boundary between those two states.
--
-- publish_meal_services() read "does this service have any serving_record?"
-- with NO lock and then mutated or deleted the row. Concurrently, a classroom
-- could be creating that service's first record. The insert's foreign key takes
-- FOR KEY SHARE, which does NOT conflict with the FOR NO KEY UPDATE that
-- changing meal_revision_id needs — so the publisher could swap the revision
-- underneath the observation being filed against it. Worse, the FK is
-- ON DELETE SET NULL, so a racing delete would have ORPHANED that record,
-- leaving a served meal pointing at nothing.
--
-- The publisher now takes FOR UPDATE on the service row BEFORE testing for
-- history, and the recorder takes FOR KEY SHARE on it before inserting. Whoever
-- reaches the boundary first wins cleanly: the publisher either sees no history
-- and may re-resolve, or waits, re-reads and declines.
-- ---------------------------------------------------------------------
create or replace function publish_meal_services(p_inst uuid, p_from date, p_to date)
returns integer language plpgsql security definer set search_path = public as $function$
declare
  d date;
  p app_period;
  r record;
  v_rev uuid;
  v_existing uuid;
  v_locked boolean;
  n int := 0;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may publish a schedule';
  end if;

  d := p_from;
  while d <= p_to loop
    foreach p in array array['breakfast','snack','lunch','afternoon_snack']::app_period[] loop
      -- LOCK FIRST, then ask whether it is historical. Between those two steps
      -- nothing may create the first serving record.
      select ms.id into v_existing
        from meal_services ms
       where ms.institution_id = p_inst and ms.service_date = d and ms.period = p
       for update;

      if v_existing is not null then
        select exists (select 1 from serving_records sr where sr.meal_service_id = v_existing)
          into v_locked;
      else
        v_locked := false;
      end if;

      if v_existing is not null and coalesce(v_locked, false) then
        -- Served/recorded already: historical truth, never rewritten or removed.
        null;
      else
        select * into r from resolve_meal(p_inst, d, p);
        if r.meal_id is not null then
          select m.current_revision_id into v_rev from meals m where m.id = r.meal_id;
          if v_rev is not null then
            insert into meal_services (
              institution_id, service_date, period, meal_revision_id,
              source, rotation_id, published, published_at
            )
            values (p_inst, d, p, v_rev, r.source, r.rotation_id, true, now())
            on conflict (institution_id, service_date, period) do update
              set meal_revision_id = excluded.meal_revision_id,
                  source           = excluded.source,
                  rotation_id      = excluded.rotation_id,
                  published        = true,
                  published_at     = coalesce(meal_services.published_at, now());
            n := n + 1;
          end if;
        else
          -- A Closure, or nothing planned: remove the UNLOCKED service so the
          -- closure actually suppresses it. (A locked one never reaches here.)
          if v_existing is not null then
            delete from meal_services where id = v_existing;
            n := n + 1;
          end if;
        end if;
      end if;
    end loop;
    d := d + 1;
  end loop;
  return n;
end $function$;
revoke all on function publish_meal_services(uuid, date, date) from public, anon;
grant execute on function publish_meal_services(uuid, date, date) to authenticated;
comment on function publish_meal_services(uuid, date, date) is
  'Materializes published Meal Services for a window. Takes FOR UPDATE on each '
  'existing service BEFORE testing for serving history, so a concurrent first '
  'Classroom record cannot be orphaned or have its revision swapped. A future, '
  'unserved service may re-resolve; one carrying serving history is immutable.';


-- ---------------------------------------------------------------------
-- (13) The recorder's half of the same boundary.
-- ---------------------------------------------------------------------
create or replace function record_serving_batch(p_class uuid, p_rows jsonb, p_date date default null)
returns table(out_id uuid, out_student_id uuid)
language plpgsql security definer set search_path = public as $function$
declare
  r jsonb;
  new_id uuid;
  v_student uuid;
  v_period app_period;
  v_status meal_served_status;
  v_service uuid;
  v_inst uuid;
  v_ok boolean;
  v_pct smallint;
  v_behavior eating_behavior;
  v_reason low_intake_reason;
  v_is_exception boolean;
  v_date date := coalesce(p_date, app_operational_date());
begin
  if jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  if not app_can_record_in_class(p_class) then
    raise exception 'Not authorized to record for class %', p_class using errcode = 'check_violation';
  end if;
  if v_date <> app_operational_date() then
    raise exception 'Classroom records can only be written for the operational day (%)', app_operational_date()
      using errcode = 'check_violation';
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_student  := (r->>'student_id')::uuid;
    v_period   := (r->>'period')::app_period;
    v_status   := coalesce((r->>'served_status')::meal_served_status, 'served');
    v_service  := nullif(r->>'meal_service_id', '')::uuid;
    v_pct      := nullif(r->>'consumption_pct', '')::smallint;
    v_behavior := nullif(r->>'behavior', '')::eating_behavior;
    v_reason   := nullif(r->>'low_intake_reason', '')::low_intake_reason;
    v_is_exception := coalesce(v_reason::text, '') in ('absent', 'unwell', 'sleeping');

    if not app_can_record_for_student(v_student) then
      raise exception 'Not authorized to record for student %', v_student using errcode = 'check_violation';
    end if;

    -- ---- the approved states, checked in full -------------------------------
    if v_status = 'not_served' then
      if v_pct is not null or v_behavior is not null or v_reason is not null then
        raise exception 'A not-served meal carries no consumption, behaviour or reason — it is not 0%%'
          using errcode = 'check_violation';
      end if;

    elsif v_is_exception then
      -- Absent / Unwell / Asleep: the meal was available, the child did not eat
      -- it for a non-preference reason. No eating behaviour, no intake reading.
      if v_pct is not null or v_behavior is not null then
        raise exception 'Absent/Unwell/Asleep is recorded without a consumption reading or an eating behaviour'
          using errcode = 'check_violation';
      end if;

    else
      -- A normal SERVED result must say something.
      if v_pct is null and v_behavior is null then
        raise exception 'A served meal needs an outcome: consumption, behaviour, or an Absent/Unwell/Asleep exception'
          using errcode = 'check_violation';
      end if;
      -- A preference reason explains a LOW intake; it contradicts a high one.
      if v_reason is not null and (v_pct is null or v_pct not in (0, 25)) then
        raise exception 'A low-intake reason (%) only applies to a 0%% or 25%% result', v_reason
          using errcode = 'check_violation';
      end if;
    end if;

    select s.institution_id into v_inst
      from students s
     where s.id = v_student and s.class_id = p_class;
    if v_inst is null then
      raise exception 'Student % is not in class %', v_student, p_class using errcode = 'check_violation';
    end if;

    -- EVERY new record anchors to the published Meal Service for its period.
    if v_service is null then
      select sr.meal_service_id into v_service
        from serving_records sr
       where sr.student_id = v_student and sr.serving_date = v_date and sr.period = v_period;
      if v_service is null then
        select ms.id into v_service
          from meal_services ms
         where ms.institution_id = v_inst and ms.service_date = v_date
           and ms.period = v_period and ms.published;
      end if;
      if v_service is null then
        raise exception 'No published Meal for % on % — that period is not applicable and cannot be recorded', v_period, v_date
          using errcode = 'check_violation';
      end if;
    end if;

    select exists (
      select 1 from meal_services ms
       where ms.id = v_service and ms.institution_id = v_inst
         and ms.service_date = v_date and ms.period = v_period and ms.published
    ) into v_ok;
    if not v_ok then
      raise exception 'Meal Service % does not match institution / date % / period % / published',
        v_service, v_date, v_period using errcode = 'check_violation';
    end if;

    -- (13) Coordinate with the publisher on the SERVICE row before creating the
    -- observation. FOR KEY SHARE is compatible with other recorders (a class is
    -- recorded child by child) but conflicts with the publisher's FOR UPDATE, so
    -- a republish cannot swap the revision or delete the service underneath the
    -- record being filed against it. The foreign key would take this lock
    -- implicitly; taking it explicitly is what makes the coordination
    -- intentional rather than a side effect of referential integrity.
    perform 1 from meal_services where id = v_service for key share;

    insert into serving_records (
      class_id, student_id, period, recorded_by, serving_date,
      served_status, consumption_pct, behavior, low_intake_reason, concern_observed,
      menu_item_id, meal_service_id
      -- The legacy free-text `note` column is deliberately NOT written (0034).
    )
    values (
      p_class, v_student, v_period,
      app_current_user_id(),
      v_date, v_status, v_pct, v_behavior, v_reason,
      coalesce((r->>'concern_observed')::boolean, false),
      nullif(r->>'menu_item_id', '')::uuid,
      v_service
    )
    on conflict (student_id, serving_date, period)
    do update set
      served_status = excluded.served_status,
      consumption_pct = excluded.consumption_pct,
      behavior = excluded.behavior,
      low_intake_reason = excluded.low_intake_reason,
      concern_observed = excluded.concern_observed,
      menu_item_id = excluded.menu_item_id,
      meal_service_id = coalesce(excluded.meal_service_id, serving_records.meal_service_id),
      recorded_by = excluded.recorded_by,
      class_id = excluded.class_id,
      updated_at = now()
    returning id into new_id;

    out_id := new_id;
    out_student_id := v_student;
    return next;
  end loop;
end;
$function$;
revoke all on function record_serving_batch(uuid, jsonb, date) from public, anon;
grant execute on function record_serving_batch(uuid, jsonb, date) to authenticated;

-- ---------------------------------------------------------------------
-- (15) An exception is never preference evidence — including in a
--      grandfathered row that predates the state constraints.
--
-- The state constraints added in 0035 are deliberately NOT VALID, so historical
-- rows may still violate today's invariants. A legacy row carrying BOTH
-- `absent` AND `refused` is exactly such a row, and the behaviour counters
-- filtered only on `behavior = 'refused'` — so an absence inflated the refusal
-- statistics for a Meal nobody had rejected.
--
-- Every behavioural and preference-reason counter is now confined to the VALID
-- preference population. Exception counts are reported separately, as before.
-- ---------------------------------------------------------------------
drop view if exists v_meal_performance;
drop function if exists v_meal_performance_impl();

create function v_meal_performance_impl()
returns table (
  menu_item_id uuid, dish_name text, period app_period,
  total_observations bigint, valid_observations bigint, scored_observations bigint,
  avg_consumption_pct numeric,
  refusal_count bigint, encouragement_count bigint, did_not_like_count bigint,
  ate_all_count bigint, ate_most_count bigint, ate_half_count bigint,
  ate_some_count bigint, ate_none_count bigint,
  ate_all_share numeric, ate_most_share numeric, ate_half_share numeric,
  ate_some_share numeric, ate_none_share numeric,
  refusal_share numeric, encouragement_share numeric, did_not_like_share numeric,
  reason_not_hungry bigint, reason_did_not_like_it bigint, reason_distracted bigint,
  reason_other bigint, exception_absent bigint, exception_unwell bigint,
  exception_sleeping bigint,
  recent_avg_consumption_pct numeric, prior_avg_consumption_pct numeric,
  trend_delta_pct numeric, trend_window_days int
)
language sql stable security definer set search_path = public as $function$
  with base as (
    select
      mm.id as meal_id, mm.name as meal_name, ms.period,
      sr.consumption_pct, sr.behavior, sr.low_intake_reason, sr.serving_date,
      (sr.served_status = 'served'
        and coalesce(sr.low_intake_reason::text, '') not in ('absent','unwell','sleeping')) as is_valid
    from serving_records sr
    join meal_services ms on ms.id = sr.meal_service_id
    join meal_revisions mr on mr.id = ms.meal_revision_id
    join meals mm on mm.id = mr.meal_id
    where exists (select 1 from app_users me where me.user_id = auth.uid() and me.role = 'super_admin')
  ), agg as (
    select
      meal_id, meal_name, period,
      count(*) as total_observations,
      count(*) filter (where is_valid) as valid_observations,
      count(*) filter (where is_valid and consumption_pct is not null) as scored_observations,
      round(avg(consumption_pct) filter (where is_valid), 1) as avg_consumption_pct,
      -- is_valid on EVERY behavioural counter: a grandfathered ABSENT+REFUSED
      -- row must not register as a refusal.
      count(*) filter (where is_valid and behavior = 'refused') as refusal_count,
      count(*) filter (where is_valid and behavior = 'needed_encouragement') as encouragement_count,
      count(*) filter (where is_valid and low_intake_reason = 'did_not_like_it') as did_not_like_count,
      count(*) filter (where is_valid and consumption_pct = 100) as ate_all_count,
      count(*) filter (where is_valid and consumption_pct = 75) as ate_most_count,
      count(*) filter (where is_valid and consumption_pct = 50) as ate_half_count,
      count(*) filter (where is_valid and consumption_pct = 25) as ate_some_count,
      count(*) filter (where is_valid and consumption_pct = 0) as ate_none_count,
      -- preference reasons: valid population only
      count(*) filter (where is_valid and low_intake_reason = 'not_hungry')      as reason_not_hungry,
      count(*) filter (where is_valid and low_intake_reason = 'did_not_like_it') as reason_did_not_like_it,
      count(*) filter (where is_valid and low_intake_reason = 'distracted')      as reason_distracted,
      count(*) filter (where is_valid and low_intake_reason = 'other')           as reason_other,
      -- exceptions: counted as exceptions, wherever they appear
      count(*) filter (where low_intake_reason = 'absent')   as exception_absent,
      count(*) filter (where low_intake_reason = 'unwell')   as exception_unwell,
      count(*) filter (where low_intake_reason = 'sleeping') as exception_sleeping,
      round(avg(consumption_pct) filter (
        where is_valid and serving_date > app_operational_date() - 30), 1) as recent_avg,
      round(avg(consumption_pct) filter (
        where is_valid and serving_date <= app_operational_date() - 30
          and serving_date > app_operational_date() - 60), 1) as prior_avg
    from base
    group by meal_id, meal_name, period
  )
  select
    meal_id, meal_name, period,
    total_observations, valid_observations, scored_observations, avg_consumption_pct,
    refusal_count, encouragement_count, did_not_like_count,
    ate_all_count, ate_most_count, ate_half_count, ate_some_count, ate_none_count,
    case when scored_observations > 0 then round(100.0 * ate_all_count  / scored_observations, 1) end,
    case when scored_observations > 0 then round(100.0 * ate_most_count / scored_observations, 1) end,
    case when scored_observations > 0 then round(100.0 * ate_half_count / scored_observations, 1) end,
    case when scored_observations > 0 then round(100.0 * ate_some_count / scored_observations, 1) end,
    case when scored_observations > 0 then round(100.0 * ate_none_count / scored_observations, 1) end,
    case when valid_observations > 0 then round(100.0 * refusal_count       / valid_observations, 1) end,
    case when valid_observations > 0 then round(100.0 * encouragement_count / valid_observations, 1) end,
    case when valid_observations > 0 then round(100.0 * did_not_like_count  / valid_observations, 1) end,
    reason_not_hungry, reason_did_not_like_it, reason_distracted, reason_other,
    exception_absent, exception_unwell, exception_sleeping,
    recent_avg, prior_avg,
    case when recent_avg is not null and prior_avg is not null
         then round(recent_avg - prior_avg, 1) end,
    30
  from agg
$function$;

create view v_meal_performance as select * from v_meal_performance_impl();
revoke all on v_meal_performance from anon;
grant select on v_meal_performance to authenticated;

-- The revision-level view carried the same defect.
drop view if exists v_meal_revision_performance;
drop function if exists v_meal_revision_performance_impl();

create function v_meal_revision_performance_impl()
returns table (
  meal_id uuid, meal_name text, meal_revision_id uuid, revision_no integer,
  revision_name text, period app_period,
  total_observations bigint, valid_observations bigint, scored_observations bigint,
  avg_consumption_pct numeric,
  refusal_count bigint, encouragement_count bigint, did_not_like_count bigint
)
language sql stable security definer set search_path = public as $function$
  with base as (
    select
      mm.id as meal_id, mm.name as meal_name,
      mr.id as revision_id, mr.revision_no, mr.name as revision_name, ms.period,
      sr.consumption_pct, sr.behavior, sr.low_intake_reason,
      (sr.served_status = 'served'
        and coalesce(sr.low_intake_reason::text, '') not in ('absent','unwell','sleeping')) as is_valid
    from serving_records sr
    join meal_services ms on ms.id = sr.meal_service_id
    join meal_revisions mr on mr.id = ms.meal_revision_id
    join meals mm on mm.id = mr.meal_id
    where exists (select 1 from app_users me where me.user_id = auth.uid() and me.role = 'super_admin')
  )
  select
    meal_id, meal_name, revision_id, revision_no, revision_name, period,
    count(*),
    count(*) filter (where is_valid),
    count(*) filter (where is_valid and consumption_pct is not null),
    round(avg(consumption_pct) filter (where is_valid), 1),
    count(*) filter (where is_valid and behavior = 'refused'),
    count(*) filter (where is_valid and behavior = 'needed_encouragement'),
    count(*) filter (where is_valid and low_intake_reason = 'did_not_like_it')
  from base
  group by meal_id, meal_name, revision_id, revision_no, revision_name, period
$function$;

create view v_meal_revision_performance as select * from v_meal_revision_performance_impl();
revoke all on v_meal_revision_performance from anon;
grant select on v_meal_revision_performance to authenticated;
comment on view v_meal_revision_performance is
  'Revision-level factual measures. Behavioural and preference-reason counters '
  'are confined to the VALID preference population, so a grandfathered row '
  'carrying both an exception and a behaviour cannot register as a refusal.';
