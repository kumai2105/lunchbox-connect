-- =====================================================================
-- 0029 — Correction order: classroom integrity, canonical models, and
-- de-staling the role helpers.
--
-- (A) Role de-stale. 0008b merged the legacy 'nurse'/'teacher' roles into
--     'classroom_staff', but several SECURITY DEFINER helpers still named the
--     pre-merge roles. Post-merge no user carries those names, so those
--     clauses silently EXCLUDED classroom_staff from institution-scoped
--     visibility — e.g. reading their own institution's published Meal
--     Services. The faithful translation of ('school_admin','nurse','teacher')
--     is ('school_admin','classroom_staff'): institution staff. This restores
--     the intended behavior and is what lets the Classroom screen derive its
--     applicable periods from the published schedule (correction item 2).
--
-- (B) Item 6 — Institution type is NURSERY or SCHOOL only. Forbid new 'other'
--     without destroying historical dev/test rows.
--
-- (C) Item 7 — Student canonical minimum: student_no is optional (names +
--     institution are the minimum). Normalize legacy '' to null. Document that
--     medical_notes is an interim free-text field, NOT the §42 allergy model.
--
-- (D) Item 1 — A SERVED classroom observation must reference a published Meal
--     Service. Historical pre-cutover rows (served + null) are grandfathered;
--     every new served row must carry the link, enforced both by a constraint
--     and by the write RPC, which also resolves the service automatically and
--     refuses to record consumption when nothing is published for the slot.
-- =====================================================================

-- ---- (A) role de-stale ---------------------------------------------------
create or replace function app_is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_current_role() in ('school_admin', 'classroom_staff'), false);
$$;

create or replace function app_current_institution_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from app_users
   where user_id = auth.uid() and role in ('school_admin', 'classroom_staff');
$$;

create or replace function app_can_see_institution(p_inst uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role in ('school_admin', 'classroom_staff') and me.institution_id = p_inst)
        or exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.institution_id = p_inst and sp.user_id = me.user_id
        )
      )
  );
$$;

-- User-account visibility stays with the admin tier only: a classroom_staff
-- member has no reason to browse other people's accounts. (Drops the retired
-- role names without granting classroom_staff a new capability.)
create or replace function app_can_see_user(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.user_id = p_user
        or me.role = 'super_admin'
        or (me.role = 'school_admin'
            and me.institution_id = (select institution_id from app_users target where target.user_id = p_user))
      )
  );
$$;

-- ---- (B) item 6: institution kind — nursery|school only ------------------
-- Replace the permissive check with a NOT VALID one: existing 'other' rows are
-- grandfathered (no destructive guessing), but no new 'other' can be written.
alter table institutions drop constraint if exists institutions_kind_check;
alter table institutions
  add constraint institutions_kind_check check (kind in ('school', 'nursery')) not valid;

comment on column institutions.kind is
  'Canonical active values: school | nursery only (correction item 6). A NOT '
  'VALID check grandfathers any historical dev/test ''other'' row while '
  'forbidding new ones; those rows must be reclassified from an authoritative '
  'source, never guessed.';

-- ---- (C) item 7: student canonical minimum -------------------------------
-- student_no is optional. Normalize the legacy empty string to a real absence
-- so the unique index treats "no number" as NULL (many nulls allowed) rather
-- than a single colliding ''.
update students set student_no = null where student_no = '';
alter table students alter column student_no drop not null;

comment on column students.medical_notes is
  'INTERIM free-text safety notes only. The structured Allergy / Dietary model '
  '(StudentAllergy / StudentDietaryRestriction, §42) is BLOCKED_BY_SPEC and NOT '
  'YET DEFINED — this column is not the authoritative clinical record and must '
  'not be treated as the final allergy architecture.';

-- ---- (D) item 1: served observations require a published Meal Service ------
-- Backstop constraint. NOT VALID grandfathers historical served+null rows.
alter table serving_records drop constraint if exists serving_records_served_needs_service;
alter table serving_records
  add constraint serving_records_served_needs_service
  check (served_status <> 'served' or meal_service_id is not null) not valid;

-- The write path resolves the published service for a served row and refuses to
-- record consumption when nothing is published for that institution/date/period.
-- A correction that carries no service id keeps whatever link already exists
-- (the 0020 rule), so an existing served row is never orphaned by an edit.
create or replace function record_serving_batch(p_class uuid, p_rows jsonb, p_date date default current_date)
returns table (out_id uuid, out_student_id uuid)
language plpgsql
as $$
declare
  r jsonb;
  new_id uuid;
  v_student uuid;
  v_period app_period;
  v_status meal_served_status;
  v_service uuid;
begin
  if jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_student := (r->>'student_id')::uuid;
    v_period  := (r->>'period')::app_period;
    v_status  := coalesce((r->>'served_status')::meal_served_status, 'served');
    v_service := nullif(r->>'meal_service_id', '')::uuid;

    -- Item 1: a served meal must be tied to a published Meal Service.
    if v_status = 'served' and v_service is null then
      -- Preserve an existing link on a correction (never blank it).
      select sr.meal_service_id into v_service
        from serving_records sr
       where sr.student_id = v_student and sr.serving_date = p_date and sr.period = v_period;
      if v_service is null then
        -- Resolve the published service for this student's institution + slot.
        select ms.id into v_service
          from meal_services ms
          join students s on s.id = v_student
         where ms.institution_id = s.institution_id
           and ms.service_date = p_date
           and ms.period = v_period
           and ms.published;
      end if;
      if v_service is null then
        raise exception
          'No published Meal for % on % — a served meal cannot be recorded without a published Meal Service',
          v_period, p_date
          using errcode = 'check_violation';
      end if;
    end if;

    insert into serving_records (
      class_id, student_id, period, recorded_by, serving_date,
      served_status, consumption_pct, behavior, low_intake_reason, concern_observed,
      menu_item_id, meal_service_id, note
    )
    values (
      p_class,
      v_student,
      v_period,
      app_current_user_id(),
      p_date,
      v_status,
      nullif(r->>'consumption_pct', '')::smallint,
      nullif(r->>'behavior', '')::eating_behavior,
      nullif(r->>'low_intake_reason', '')::low_intake_reason,
      coalesce((r->>'concern_observed')::boolean, false),
      nullif(r->>'menu_item_id', '')::uuid,
      v_service,
      r->>'note'
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
      note = excluded.note,
      recorded_by = excluded.recorded_by,
      class_id = excluded.class_id,
      updated_at = now()
    returning id into new_id;

    out_id := new_id;
    out_student_id := v_student;
    return next;
  end loop;
end;
$$;

grant execute on function record_serving_batch(uuid, jsonb, date) to authenticated;
