-- =====================================================================
-- 0031 — Move integrity to the DATABASE boundary (items 1-4, 6). No product
-- redesign; these close bypasses that existed below the RPC/UI.
--
-- (4) One operational calendar date for the UAE MVP (Asia/Dubai, GST = UTC+4,
--     no DST). UTC `current_date` disagrees with the nursery between 00:00 and
--     04:00 local, so every "today" that drives operations uses this instead.
--
-- (1) serving_records: authenticated clients keep SELECT but lose direct
--     INSERT/UPDATE/DELETE. record_serving_batch (now SECURITY DEFINER, with
--     its own authorization) becomes the ONLY write path, so the class /
--     service / date / period / published checks and the server-stamped
--     recorded_by cannot be bypassed by PostgREST or raw SQL under an
--     authenticated role.
--
-- (2) serving_notes: a Classroom Staff member may write an INTERNAL
--     (unpublished) note but can never set published_at or touch a published
--     note. Only the review authority (School/Nursery Admin of the institution,
--     or Super Admin) may publish.
--
-- (3) Students/classes tenant + eligibility: only a Super Admin may change a
--     Student's operational_status, or move a Student or Class to another
--     institution — enforced by triggers that fire on every write path.
--
-- (6) meal-images storage: readable only by Super Admin or by a role entitled
--     to the meal through a published Meal Service it can see.
-- =====================================================================

-- ---- (4) canonical operational date --------------------------------------
create or replace function app_operational_date()
returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Dubai')::date;
$$;
comment on function app_operational_date() is
  'The single MVP operational calendar date (Asia/Dubai, GST/UTC+4, no DST). '
  'Use everywhere "today" drives operations instead of UTC current_date. '
  'Multi-timezone per-institution support is intentionally NOT implemented yet.';

-- ---- (1) serving_records: RPC is the only client write path ---------------
revoke insert, update, delete on serving_records from authenticated, anon;

-- Keep the RLS insert/update policies as defence-in-depth (they no longer run
-- for authenticated, which now lacks the privilege) but align them to the
-- operational date so any future re-grant stays correct.
drop policy if exists serving_records_insert on serving_records;
drop policy if exists serving_records_update on serving_records;
create policy serving_records_insert on serving_records for insert
  with check (
    serving_date = app_operational_date()
    and app_can_record_for_student(student_id)
    and app_can_record_in_class(class_id)
  );
create policy serving_records_update on serving_records for update
  using (serving_date = app_operational_date() and app_can_record_for_student(student_id) and app_can_record_in_class(class_id))
  with check (serving_date = app_operational_date() and app_can_record_for_student(student_id) and app_can_record_in_class(class_id));

create or replace function record_serving_batch(p_class uuid, p_rows jsonb, p_date date default null)
returns table (out_id uuid, out_student_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  new_id uuid;
  v_student uuid;
  v_period app_period;
  v_status meal_served_status;
  v_service uuid;
  v_inst uuid;
  v_ok boolean;
  v_date date := coalesce(p_date, app_operational_date());
begin
  if jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  -- Authorization (SECURITY DEFINER bypasses RLS, so re-check the caller here).
  if not app_can_record_in_class(p_class) then
    raise exception 'Not authorized to record for class %', p_class using errcode = 'check_violation';
  end if;
  -- Records may only be written for the operational day (corrections included).
  if v_date <> app_operational_date() then
    raise exception 'Classroom records can only be written for the operational day (%)', app_operational_date()
      using errcode = 'check_violation';
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_student := (r->>'student_id')::uuid;
    v_period  := (r->>'period')::app_period;
    v_status  := coalesce((r->>'served_status')::meal_served_status, 'served');
    v_service := nullif(r->>'meal_service_id', '')::uuid;

    -- Per-student authorization (eligibility + scope) under the definer context.
    if not app_can_record_for_student(v_student) then
      raise exception 'Not authorized to record for student %', v_student using errcode = 'check_violation';
    end if;

    -- Item 4-of-prev pass: the student must belong to the class being recorded.
    select s.institution_id into v_inst
      from students s
     where s.id = v_student and s.class_id = p_class;
    if v_inst is null then
      raise exception 'Student % is not in class %', v_student, p_class using errcode = 'check_violation';
    end if;

    -- A served meal must resolve to a published Meal Service.
    if v_status = 'served' and v_service is null then
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
        raise exception 'No published Meal for % on % — cannot record a served meal', v_period, v_date
          using errcode = 'check_violation';
      end if;
    end if;

    -- Whatever service id we store must match this student's institution, the
    -- serving date, the period, and be published.
    if v_service is not null then
      select exists (
        select 1 from meal_services ms
         where ms.id = v_service and ms.institution_id = v_inst
           and ms.service_date = v_date and ms.period = v_period and ms.published
      ) into v_ok;
      if not v_ok then
        raise exception 'Meal Service % does not match institution / date % / period % / published',
          v_service, v_date, v_period using errcode = 'check_violation';
      end if;
    end if;

    insert into serving_records (
      class_id, student_id, period, recorded_by, serving_date,
      served_status, consumption_pct, behavior, low_intake_reason, concern_observed,
      menu_item_id, meal_service_id, note
    )
    values (
      p_class, v_student, v_period,
      app_current_user_id(),            -- server-stamped; never client-supplied
      v_date, v_status,
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

-- ---- (2) serving_notes: only the review authority may publish -------------
-- created_by is NOT NULL but had no default/stamp, so an app note insert
-- (which never sends it) would fail; stamp it from the caller — server-side,
-- so authorship cannot be spoofed either.
create or replace function stamp_note_created_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := app_current_user_id();
  return new;
end $$;
drop trigger if exists serving_notes_stamp_creator on serving_notes;
create trigger serving_notes_stamp_creator before insert on serving_notes
  for each row execute function stamp_note_created_by();

drop policy if exists serving_notes_insert on serving_notes;
create policy serving_notes_insert on serving_notes for insert
  with check (
    exists (select 1 from serving_records sr where sr.id = serving_record_id
            and app_can_record_for_student(sr.student_id))
    -- Classroom Staff may only create INTERNAL notes; only an admin may create
    -- one already published.
    and (
      published_at is null
      or exists (select 1 from serving_records sr where sr.id = serving_record_id
                 and app_can_manage_student(sr.student_id))
    )
  );

drop policy if exists serving_notes_update on serving_notes;
-- Review authority (Super Admin, or School/Nursery Admin of the student's
-- institution) may edit and publish.
create policy serving_notes_update_admin on serving_notes for update
  using (exists (select 1 from serving_records sr where sr.id = serving_record_id
                 and app_can_manage_student(sr.student_id)))
  with check (exists (select 1 from serving_records sr where sr.id = serving_record_id
                 and app_can_manage_student(sr.student_id)));
-- Classroom Staff may edit an UNPUBLISHED note and must keep it unpublished;
-- they can never touch an already-published family note.
create policy serving_notes_update_staff on serving_notes for update
  using (
    published_at is null
    and exists (select 1 from serving_records sr where sr.id = serving_record_id
                and app_can_record_for_student(sr.student_id))
  )
  with check (
    published_at is null
    and exists (select 1 from serving_records sr where sr.id = serving_record_id
                and app_can_record_for_student(sr.student_id))
  );

-- ---- (3) tenant identity + eligibility guards ----------------------------
create or replace function guard_student_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.operational_status is distinct from old.operational_status and not app_is_super_admin() then
    raise exception 'operational_status is Super-Admin-only (use the Status screen)'
      using errcode = 'check_violation';
  end if;
  if new.institution_id is distinct from old.institution_id and not app_is_super_admin() then
    raise exception 'a Student cannot be moved to another institution'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists students_guard_write on students;
create trigger students_guard_write before update on students
  for each row execute function guard_student_write();

create or replace function guard_class_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.institution_id is distinct from old.institution_id and not app_is_super_admin() then
    raise exception 'a Class cannot be moved to another institution'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists classes_guard_write on classes;
create trigger classes_guard_write before update on classes
  for each row execute function guard_class_write();

-- ---- (4) dashboard "today" uses the operational date ---------------------
create or replace view v_dashboard_institutions
with (security_invoker = true) as
with periods_today as (
  select ms.institution_id, count(distinct ms.period)::int as periods_today
  from meal_services ms
  where ms.published and ms.service_date = app_operational_date()
  group by ms.institution_id
),
records_today as (
  select s.institution_id, count(distinct sr.id)::int as meals_today
  from serving_records sr
  join students s on s.id = sr.student_id
  where sr.serving_date = app_operational_date()
  group by s.institution_id
)
select
  i.id as institution_id,
  i.name,
  count(distinct c.id)::int as classrooms,
  count(distinct s.id) filter (where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY')::int
    as active_students,
  coalesce(rt.meals_today, 0) as meals_today,
  coalesce(pt.periods_today, 0) as periods_today,
  (count(distinct s.id) filter (where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY')
    * coalesce(pt.periods_today, 0))::int as expected_today
from institutions i
left join classes c on c.institution_id = i.id
left join students s on s.institution_id = i.id
left join periods_today pt on pt.institution_id = i.id
left join records_today rt on rt.institution_id = i.id
group by i.id, i.name, pt.periods_today, rt.meals_today
order by i.name;

-- ---- (6) meal-images storage follows published-meal visibility -----------
drop policy if exists meal_images_read on storage.objects;
create policy meal_images_read on storage.objects for select
  using (
    bucket_id = 'meal-images'
    and (
      app_is_super_admin()
      or exists (
        select 1
          from meal_revisions mr
          join meal_services ms on ms.meal_revision_id = mr.id
         where mr.image_path = storage.objects.name
           and ms.published
           and (app_can_see_institution(ms.institution_id) or app_is_kitchen())
      )
    )
  );
