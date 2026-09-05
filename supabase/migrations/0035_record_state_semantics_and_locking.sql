-- =====================================================================
-- 0035 — Complete classroom record-state semantics, slot/resize locking,
--        and a correct consumption-distribution denominator.
--
-- New migration; applied history is NOT rewritten. Nothing here publishes,
-- assigns or infers business data, and no operational history is deleted.
--
--  (3)  The APPROVED record states, enforced whole — 0034 only stopped the
--       entirely outcome-free SERVED row and NOT_SERVED carrying a result.
--       Contradictory combinations were still reachable through the RPC.
--  (4)  A Rotation Slot write now takes the parent Rotation's row lock, so it
--       cannot validate against a week_count another transaction is changing.
--  (5)  The 100/75/50/25/0 shares are computed over the SCORED population.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (3) The approved states, in full.
--
--   NOT_SERVED            consumption NULL, behaviour NULL, reason NULL
--   exception (SERVED)    ABSENT / UNWELL / SLEEPING; consumption NULL,
--                         behaviour NULL
--   normal (SERVED)       a preference reason (NOT_HUNGRY / DID_NOT_LIKE_IT /
--                         DISTRACTED / OTHER) is only meaningful at 0% or 25%;
--                         at 50/75/100% there is no low-intake reason at all
--
-- Deliberately NOT invented: no rule makes a reason mandatory at 0%/25% (the
-- approved spec leaves it optional), and no new mandatory-behaviour rule is
-- introduced. Only genuinely contradictory rows are refused.
--
-- NOT VALID: pre-existing history is grandfathered, never rewritten; every new
-- or updated row is checked.
-- ---------------------------------------------------------------------
alter table serving_records drop constraint if exists serving_records_state_semantics;
alter table serving_records add constraint serving_records_state_semantics check (
  case
    -- NOT_SERVED carries no result of any kind.
    when served_status = 'not_served' then
      consumption_pct is null and behavior is null and low_intake_reason is null

    -- The behaviour-free exception form.
    when coalesce(low_intake_reason::text, '') in ('absent', 'unwell', 'sleeping') then
      consumption_pct is null and behavior is null

    -- A preference reason only makes sense alongside a low intake.
    when low_intake_reason is not null then
      consumption_pct in (0, 25)

    -- Anything else (no reason at all) is unconstrained here; 0034's
    -- "a SERVED record carries an outcome" rule still applies.
    else true
  end
) not valid;

comment on constraint serving_records_state_semantics on serving_records is
  'The approved classroom record states: NOT_SERVED carries nothing; '
  'ABSENT/UNWELL/SLEEPING are behaviour-free with no consumption; a preference '
  'reason (NOT_HUNGRY/DID_NOT_LIKE_IT/DISTRACTED/OTHER) is only valid at 0% or '
  '25%. A reason is NOT mandatory at 0%/25%, and no behaviour is mandatory — '
  'neither rule is approved, so neither is invented.';

-- ---------------------------------------------------------------------
-- (3) The same semantics inside record_serving_batch, with messages a
-- classroom user can act on rather than a bare constraint code.
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
-- (4) Serialize slot writes against a concurrent Menu resize.
--
-- guard_rotation_slot_week() read rotations.week_count WITHOUT a lock, while
-- set_rotation_week_count() takes `for update` on the same row. Two concurrent
-- transactions could therefore interleave so that a slot validates against a
-- week_count that is being lowered, and the invariant
--   rotation_slots.week_number <= rotations.week_count
-- ends up violated with neither statement having failed.
--
-- Taking the same parent-row lock in the trigger makes the slot write wait for
-- an in-flight resize (and vice versa), so the check is always made against the
-- committed value.
-- ---------------------------------------------------------------------
create or replace function guard_rotation_slot_week()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_weeks int;
begin
  -- `for update` on the PARENT: this is the whole point of the change.
  select week_count into v_weeks
    from rotations where id = new.rotation_id
    for update;
  if v_weeks is null then
    raise exception 'Unknown rotation %', new.rotation_id using errcode = 'check_violation';
  end if;
  if new.week_number < 1 or new.week_number > v_weeks then
    raise exception 'Menu slot week % is outside this Menu (1..%)', new.week_number, v_weeks
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
comment on function guard_rotation_slot_week() is
  'Holds rotation_slots.week_number <= rotations.week_count. Takes the parent '
  'Rotation row lock so a slot write cannot validate against a week_count a '
  'concurrent set_rotation_week_count() is changing.';

-- ---------------------------------------------------------------------
-- (5) The consumption distribution needs the SCORED denominator.
--
-- `valid_observations` counts every served, non-exception record — including
-- one that carries a behaviour but no consumption reading. Such a row belongs
-- to the behavioural metrics but to NONE of the 100/75/50/25/0 buckets, so
-- dividing the buckets by it made the five shares sum to less than 100% and
-- quietly understated every band.
--
-- The buckets are now divided by `scored_observations` (valid AND carrying a
-- percentage). `valid_observations` is kept and still reported — it is the
-- factual population for refusal / encouragement / reason metrics, which is
-- where a behaviour-only row does belong. The average already ignored NULLs.
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
      sr.consumption_pct, sr.behavior, sr.low_intake_reason,
      sr.serving_date,
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
      -- the population the five consumption bands actually describe
      count(*) filter (where is_valid and consumption_pct is not null) as scored_observations,
      round(avg(consumption_pct) filter (where is_valid), 1) as avg_consumption_pct,
      count(*) filter (where behavior = 'refused') as refusal_count,
      count(*) filter (where behavior = 'needed_encouragement') as encouragement_count,
      count(*) filter (where low_intake_reason = 'did_not_like_it') as did_not_like_count,
      count(*) filter (where is_valid and consumption_pct = 100) as ate_all_count,
      count(*) filter (where is_valid and consumption_pct = 75) as ate_most_count,
      count(*) filter (where is_valid and consumption_pct = 50) as ate_half_count,
      count(*) filter (where is_valid and consumption_pct = 25) as ate_some_count,
      count(*) filter (where is_valid and consumption_pct = 0) as ate_none_count,
      count(*) filter (where low_intake_reason = 'not_hungry')  as reason_not_hungry,
      count(*) filter (where low_intake_reason = 'did_not_like_it') as reason_did_not_like_it,
      count(*) filter (where low_intake_reason = 'distracted')  as reason_distracted,
      count(*) filter (where low_intake_reason = 'other')       as reason_other,
      count(*) filter (where low_intake_reason = 'absent')      as exception_absent,
      count(*) filter (where low_intake_reason = 'unwell')      as exception_unwell,
      count(*) filter (where low_intake_reason = 'sleeping')    as exception_sleeping,
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
    -- SCORED denominator: these five sum to 100% of the scored population.
    case when scored_observations > 0 then round(100.0 * ate_all_count  / scored_observations, 1) end,
    case when scored_observations > 0 then round(100.0 * ate_most_count / scored_observations, 1) end,
    case when scored_observations > 0 then round(100.0 * ate_half_count / scored_observations, 1) end,
    case when scored_observations > 0 then round(100.0 * ate_some_count / scored_observations, 1) end,
    case when scored_observations > 0 then round(100.0 * ate_none_count / scored_observations, 1) end,
    -- VALID denominator: behaviour and reason metrics legitimately include a
    -- behaviour-only row, so their population is the valid one.
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
comment on view v_meal_performance is
  'Approved FACTUAL Meal measures. The 100/75/50/25/0 shares are computed over '
  'scored_observations (valid AND carrying a percentage) so they sum to 100%% of '
  'the population they describe; refusal / encouragement / DID_NOT_LIKE_IT '
  'shares use valid_observations, which is where a behaviour-only row belongs. '
  'NO classification or decision threshold is applied — those are NOT_YET_DEFINED.';
