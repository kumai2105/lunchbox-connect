-- =====================================================================
-- 0034 — Legacy note privacy, classroom-record state validity, atomic
--        rotation resizing, completed factual analytics, archive-only
--        lifecycle for entities that already have deactivation semantics.
--
-- New migration; applied history is NOT rewritten. Nothing here publishes,
-- assigns, or infers business data, and no operational history is deleted.
--
--  (1)  serving_records.note (LEGACY free text) is removed from every client
--       read path. Historical values are ARCHIVED, not deleted.
--  (2)  A SERVED classroom record must carry a real outcome; the approved
--       ABSENT/UNWELL/SLEEPING exception form is preserved.
--  (3)  concern_observed gets its own narrow, authorized write path.
--  (4)  Rotation resizing is one atomic, authorized operation, and
--       rotation_slots.week_number <= rotations.week_count is an invariant.
--  (8)  Meal analytics expose the approved FACTUAL measures in full.
-- (14)  Entities that already have archive/deactivation semantics lose
--       generic client hard-DELETE authority.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) LEGACY serving_records.note — archive, then close the read path.
--
-- serving_records_select is granted to a Parent (app_can_see_student), so any
-- historical internal free text in this legacy column was retrievable through
-- raw PostgREST. serving_notes — with its publication boundary — is the ONLY
-- Parent-visible free-text channel.
--
-- Retention/deletion is NOT_YET_DEFINED, so the text is COPIED into an archive
-- that no API role can read, and only then cleared from the client-visible
-- table. Nothing is destroyed: the archive is the record of what was written.
-- ---------------------------------------------------------------------
create table if not exists serving_record_note_archive (
  id                 uuid primary key default gen_random_uuid(),
  serving_record_id  uuid not null references serving_records(id) on delete cascade,
  note               text not null,
  archived_at        timestamptz not null default now()
);
comment on table serving_record_note_archive is
  'Archive of the retired legacy serving_records.note free text. Preserved '
  'because retention/deletion is NOT_YET_DEFINED. No API role may read this '
  'table; the Parent-visible free-text channel is serving_notes only.';

-- Idempotent archive-then-clear.
insert into serving_record_note_archive (serving_record_id, note)
select sr.id, sr.note
from serving_records sr
where sr.note is not null
  and not exists (
    select 1 from serving_record_note_archive a where a.serving_record_id = sr.id
  );

update serving_records set note = null where note is not null;

-- No client role reads the archive.
revoke all on serving_record_note_archive from anon, authenticated;

-- ...and none may read the legacy column again.
--
-- A column-level REVOKE does NOT override a table-level GRANT: while
-- `GRANT SELECT ON serving_records` stands, every column stays readable. The
-- table-level privilege therefore has to go, replaced by an explicit
-- column list that simply omits `note`. RLS still applies on top of this —
-- the grant decides WHICH COLUMNS, the policy decides WHICH ROWS.
revoke select on serving_records from authenticated, anon;
grant select (
  id, serving_date, class_id, student_id, period, served_status,
  consumption_pct, behavior, low_intake_reason, concern_observed,
  menu_item_id, meal_service_id, recorded_by, created_at, updated_at
) on serving_records to authenticated;

comment on column serving_records.note is
  'RETIRED legacy free text. Always NULL going forward; historical values live '
  'in serving_record_note_archive. Not readable by any API client — classroom '
  'free text belongs in serving_notes, which has the publication boundary.';

-- ---------------------------------------------------------------------
-- (2) Valid classroom meal-record states, at the boundary.
--
--   normal served   : served, consumption and/or behaviour recorded
--   exception       : served, behaviour-free, reason ABSENT/UNWELL/SLEEPING
--   not served      : not_served, no consumption, no behaviour (NOT 0%)
--
-- An empty SERVED row (no consumption, no behaviour, no exception reason) is
-- the state a "save a note first" flow used to fabricate purely to obtain a
-- serving_record id. It is now unrepresentable.
--
-- NOT VALID: pre-existing history is grandfathered, never rewritten; every new
-- or updated row is checked.
-- ---------------------------------------------------------------------
alter table serving_records drop constraint if exists serving_records_served_has_outcome;
-- NOTE the coalesce: `low_intake_reason in (...)` evaluates to NULL when the
-- column is NULL, and a CHECK constraint PASSES on NULL. Without it the exact
-- row this constraint exists to forbid — served, nothing recorded at all —
-- would slip through the raw path.
alter table serving_records add constraint serving_records_served_has_outcome check (
  served_status <> 'served'
  or consumption_pct is not null
  or behavior is not null
  or coalesce(low_intake_reason::text, '') in ('absent', 'unwell', 'sleeping')
) not valid;

comment on constraint serving_records_served_has_outcome on serving_records is
  'A SERVED record carries a real outcome: consumption, behaviour, or the '
  'approved behaviour-free ABSENT/UNWELL/SLEEPING exception. NOT_SERVED stays '
  'distinct from 0%.';

-- ---------------------------------------------------------------------
-- (1)+(2) record_serving_batch: stop writing legacy free text, and refuse an
-- outcome-free SERVED row with a clear message rather than a constraint code.
-- Everything else about the function is unchanged.
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

    if not app_can_record_for_student(v_student) then
      raise exception 'Not authorized to record for student %', v_student using errcode = 'check_violation';
    end if;

    -- A SERVED record must be a real outcome. Refuse the outcome-free row that
    -- a "note first" flow would otherwise create to obtain a record id.
    if v_status = 'served'
       and v_pct is null and v_behavior is null
       and (v_reason is null or v_reason not in ('absent', 'unwell', 'sleeping')) then
      raise exception 'A served meal needs an outcome: consumption, behaviour, or an Absent/Unwell/Asleep exception'
        using errcode = 'check_violation';
    end if;
    -- NOT_SERVED is not 0%: it carries no consumption and no behaviour.
    if v_status = 'not_served' and (v_pct is not null or v_behavior is not null) then
      raise exception 'A not-served meal cannot carry consumption or an eating behaviour'
        using errcode = 'check_violation';
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
      -- NOTE: the legacy free-text `note` column is deliberately NOT written.
      -- Classroom free text goes to serving_notes, which has the publication
      -- boundary a family-visible message requires.
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
-- (3) concern_observed: a narrow, authorized write path.
--
-- Flagging a concern while saving a note previously required re-sending the
-- whole meal result, so the flag was silently dropped. This updates ONLY that
-- column, and touches no other meal-result field.
-- ---------------------------------------------------------------------
create or replace function set_concern_observed(p_record uuid, p_concern boolean)
returns serving_records
language plpgsql security definer set search_path = public as $$
declare v_row serving_records;
begin
  select * into v_row from serving_records where id = p_record;
  if not found then
    raise exception 'No such classroom record' using errcode = 'check_violation';
  end if;
  if not app_can_record_for_student(v_row.student_id) then
    raise exception 'Not authorized to record for this student' using errcode = 'check_violation';
  end if;
  if not app_can_record_in_class(v_row.class_id) then
    raise exception 'Not authorized to record in this class' using errcode = 'check_violation';
  end if;
  if v_row.serving_date <> app_operational_date() then
    raise exception 'Classroom records can only be changed on the operational day (%)', app_operational_date()
      using errcode = 'check_violation';
  end if;

  update serving_records
     set concern_observed = coalesce(p_concern, false),
         updated_at = now()
   where id = p_record
  returning * into v_row;
  return v_row;
end $$;
revoke all on function set_concern_observed(uuid, boolean) from public, anon;
grant execute on function set_concern_observed(uuid, boolean) to authenticated;
comment on function set_concern_observed(uuid, boolean) is
  'Sets ONLY concern_observed on an existing classroom record, under the same '
  'authorization and operational-day rules as recording. No other meal-result '
  'field is touched.';

-- ---------------------------------------------------------------------
-- (4) Rotation resizing is ONE atomic, authorized operation.
--
-- The client used to DELETE out-of-range slots and THEN update week_count. If
-- the shrink was rejected (an institution's anchor_week would fall outside the
-- rotation), the meal slots were already gone — data loss on a failed edit.
--
-- The invariant is also enforced structurally, so no raw mutation can leave
-- rotation_slots.week_number > rotations.week_count behind.
-- ---------------------------------------------------------------------
create or replace function guard_rotation_slot_week()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_weeks int;
begin
  select week_count into v_weeks from rotations where id = new.rotation_id;
  if v_weeks is null then
    raise exception 'Unknown rotation %', new.rotation_id using errcode = 'check_violation';
  end if;
  if new.week_number < 1 or new.week_number > v_weeks then
    raise exception 'Menu slot week % is outside this Menu (1..%)', new.week_number, v_weeks
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists rotation_slots_guard_week on rotation_slots;
create trigger rotation_slots_guard_week before insert or update on rotation_slots
  for each row execute function guard_rotation_slot_week();

-- The other side of the invariant: a rotation may not shrink out from under
-- slots that already exist. set_rotation_week_count() is the supported way to
-- shrink, because it removes those slots inside the SAME transaction.
create or replace function guard_rotation_week_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_orphans int;
begin
  if new.week_count < old.week_count then
    select count(*) into v_orphans
      from rotation_slots where rotation_id = new.id and week_number > new.week_count;
    if v_orphans > 0 then
      raise exception 'Cannot shrink this Menu to % week(s): % meal slot(s) fall outside it. Use set_rotation_week_count().',
        new.week_count, v_orphans using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists rotations_guard_week_count on rotations;
create trigger rotations_guard_week_count before update on rotations
  for each row execute function guard_rotation_week_count();

create or replace function set_rotation_week_count(p_rotation uuid, p_week_count int)
returns rotations
language plpgsql security definer set search_path = public as $$
declare v_row rotations; v_bad text; v_removed int := 0;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may change a Menu' using errcode = 'check_violation';
  end if;
  if p_week_count is null or p_week_count < 1 then
    raise exception 'A Menu needs at least one week' using errcode = 'check_violation';
  end if;

  select * into v_row from rotations where id = p_rotation for update;
  if not found then
    raise exception 'No such Menu' using errcode = 'check_violation';
  end if;

  -- VALIDATE FIRST: an assigned institution's anchor_week must stay inside the
  -- rotation. If any would not, nothing is removed and nothing is changed.
  select string_agg(i.name, ', ' order by i.name) into v_bad
    from institution_rotation_assignments ira
    join institutions i on i.id = ira.institution_id
   where ira.rotation_id = p_rotation and ira.anchor_week > p_week_count;
  if v_bad is not null then
    raise exception 'Cannot resize to % week(s): these institutions are anchored beyond it (%)',
      p_week_count, v_bad using errcode = 'check_violation';
  end if;

  -- Then remove the now-out-of-range slots and resize, in one transaction.
  delete from rotation_slots
   where rotation_id = p_rotation and week_number > p_week_count;
  get diagnostics v_removed = row_count;

  update rotations set week_count = p_week_count where id = p_rotation
  returning * into v_row;

  if v_removed > 0 then
    raise notice 'Removed % meal slot(s) beyond week %', v_removed, p_week_count;
  end if;
  return v_row;
end $$;
revoke all on function set_rotation_week_count(uuid, int) from public, anon;
grant execute on function set_rotation_week_count(uuid, int) to authenticated;
comment on function set_rotation_week_count(uuid, int) is
  'Atomically resizes a Menu: validate anchored institutions, remove slots that '
  'fall outside the new range, then set week_count — all or nothing. A rejected '
  'shrink leaves every meal slot untouched.';

-- ---------------------------------------------------------------------
-- (14) Archive, not hard delete.
--
-- Meals, Menus/Rotations and Kitchens already carry `active` deactivation
-- semantics, and exact deletion/retention remains NOT_YET_DEFINED. Remove the
-- generic client hard-DELETE authority (a Super Admin included) rather than
-- invent a permanent-deletion workflow. Grants are checked before RLS, so this
-- closes the raw path too.
--
-- Genuinely implemented configuration deletes are deliberately UNTOUCHED:
-- rotation_slots (clearing a menu slot), class_staff (unassigning a teacher),
-- calendar_exceptions and the effective-dated planning rows.
-- ---------------------------------------------------------------------
revoke delete on meals, meal_revisions, rotations, kitchens from authenticated, anon;

comment on column meals.active is
  'Archive/deactivation flag — the approved lifecycle for a Meal. Hard DELETE is '
  'not available to any API client while retention is NOT_YET_DEFINED.';
comment on column rotations.active is
  'Archive/deactivation flag — the approved lifecycle for a Menu. Hard DELETE is '
  'not available to any API client while retention is NOT_YET_DEFINED.';
comment on column kitchens.active is
  'Archive/deactivation flag — the approved lifecycle for a Kitchen. Hard DELETE '
  'is not available to any API client while retention is NOT_YET_DEFINED.';

-- ---------------------------------------------------------------------
-- (8) Management Meal analytics — the approved FACTUAL measure set, complete.
--
-- Added: the 100/75/50/25/0 distribution as counts AND percentages of the valid
-- population, the full low-intake-reason breakdown, and a factual trend (recent
-- window average vs the preceding window of the same length, plus the delta).
--
-- Deliberately NOT added: any classification, score, ranking judgement or
-- decision threshold. Those thresholds are NOT_YET_DEFINED and are not invented
-- here — the view reports what happened, nothing more.
--
-- Exceptions (ABSENT/UNWELL/SLEEPING) stay excluded from the valid population,
-- exactly as before, and Meal identity remains the stable meal id.
-- ---------------------------------------------------------------------
drop view if exists v_meal_performance;
drop function if exists v_meal_performance_impl();

create function v_meal_performance_impl()
returns table (
  menu_item_id uuid, dish_name text, period app_period,
  total_observations bigint, valid_observations bigint,
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
      -- Factual trend: the last 30 operational days against the 30 before them.
      -- A reporting window, not a judgement — no threshold is applied to it.
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
    total_observations, valid_observations, avg_consumption_pct,
    refusal_count, encouragement_count, did_not_like_count,
    ate_all_count, ate_most_count, ate_half_count, ate_some_count, ate_none_count,
    case when valid_observations > 0 then round(100.0 * ate_all_count  / valid_observations, 1) end,
    case when valid_observations > 0 then round(100.0 * ate_most_count / valid_observations, 1) end,
    case when valid_observations > 0 then round(100.0 * ate_half_count / valid_observations, 1) end,
    case when valid_observations > 0 then round(100.0 * ate_some_count / valid_observations, 1) end,
    case when valid_observations > 0 then round(100.0 * ate_none_count / valid_observations, 1) end,
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
  'Approved FACTUAL Meal measures for Management analytics: valid/served counts, '
  'average consumption, the 100/75/50/25/0 distribution as counts and shares, '
  'refusal / encouragement / explicit DID_NOT_LIKE_IT, the low-intake-reason '
  'breakdown, and a 30-day trend against the preceding 30 days. Exceptions '
  '(ABSENT/UNWELL/SLEEPING) are excluded from the valid population. NO '
  'classification or decision threshold is applied — those are NOT_YET_DEFINED.';
