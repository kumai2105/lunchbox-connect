-- =====================================================================
-- 0033 — Client-boundary lockdown.
--
-- New migration; applied history is not rewritten. Corrections to the
-- existing approved architecture — no new product behaviour is invented.
--
--  (1) app_users: no self role/scope escalation.
--  (2) students: operational_status is Super-Admin-only on INSERT too.
--  (3) student_parents: School Admin cannot link/unlink (BLOCKED_BY_SPEC).
--  (4) tenant invariants survive changes to the REFERENCED row, not just
--      the relationship row.
--  (5) no generic hard delete of core historical entities.
--  (6) raw planning tables are not readable by downstream roles.
--  (7) legacy client surfaces (eligibility / menus / messages) retired —
--      rows preserved, client access removed.
--  (8) every NEW classroom record anchors to a published Meal Service.
--  (9) one service-plan / rotation-assignment per institution+effective
--      date; anchor_week bounded by the Menu's week_count.
-- (11) meal_services mutates only through the publishing RPC.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Trusted-path discriminator.
--
-- Several rules below are TRIGGERS, which (unlike RLS) also fire for the
-- table owner and for `service_role`. The rules must constrain ordinary API
-- clients without breaking the paths that are, by design, trusted: migrations
-- and owner-run maintenance, and the service-role server paths (the
-- `admin-create-user` Edge Function, disposable E2E seeding).
--
-- PostgREST executes every request as `SET LOCAL ROLE authenticated|anon`, so
-- the `role` GUC names the caller even inside a SECURITY DEFINER function
-- (where current_user is the definer). The owner path leaves it unset/'none'
-- and service_role names itself. This is a *defense-in-depth* discriminator
-- only: the authorization decisions themselves are RLS + the role checks
-- below, never this function alone.
-- ---------------------------------------------------------------------
create or replace function app_is_api_client()
returns boolean language sql stable as $$
  select coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon');
$$;
comment on function app_is_api_client() is
  'True when executing inside an ordinary PostgREST client request '
  '(role authenticated/anon). False for owner/migration and service_role paths.';

-- =====================================================================
-- (1) app_users — a client may not edit security identity or scope.
--
-- The Supabase baseline grants `authenticated` table privileges and relies on
-- RLS, so the previous `user_id = auth.uid()` UPDATE policy let ANY account
-- rewrite its own role/institution_id/kitchen_id — including to super_admin.
-- There is no approved self-profile mutation workflow; `admin-create-user`
-- remains the approved provisioning path. Account editing / deactivation
-- workflows stay NOT_YET_DEFINED and are not invented here.
-- =====================================================================
drop policy if exists app_users_update on app_users;
create policy app_users_update on app_users for update
  using (app_is_super_admin()) with check (app_is_super_admin());

create or replace function guard_app_user_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- No API client mutates security identity or scope — not even a Super
  -- Admin. There is no approved self-profile OR account-editing workflow
  -- (both NOT_YET_DEFINED), and `admin-create-user` (service_role) is the
  -- approved provisioning path. Ordinary profile fields (full_name, phone,
  -- email) remain editable under the policy above.
  if app_is_api_client()
     and (new.role is distinct from old.role
          or new.institution_id is distinct from old.institution_id
          or new.kitchen_id is distinct from old.kitchen_id) then
    raise exception 'role / institution_id / kitchen_id are not client-editable — account provisioning is a server-side action (BLOCKED_BY_SPEC)'
      using errcode = 'check_violation';
  end if;

  -- (4) An account's role/scope must not be changed out from under existing
  -- relationships, leaving them invalid. These are integrity invariants, so
  -- they hold on EVERY path, not only for API clients.
  if new.role is distinct from old.role
     or new.institution_id is distinct from old.institution_id then
    if exists (
      select 1 from class_staff cs
      join classes c on c.id = cs.class_id
      where cs.user_id = new.user_id
        and (new.role is distinct from 'classroom_staff'
             or new.institution_id is distinct from c.institution_id)
    ) then
      raise exception 'account still has class_staff assignments that this role/institution change would invalidate — remove them first'
        using errcode = 'check_violation';
    end if;
  end if;

  if old.role = 'parent' and new.role is distinct from 'parent'
     and exists (select 1 from student_parents sp where sp.user_id = new.user_id) then
    raise exception 'account still has guardian relationships — changing it away from parent would invalidate them'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;
drop trigger if exists app_users_guard_identity on app_users;
create trigger app_users_guard_identity before update on app_users
  for each row execute function guard_app_user_identity();

-- =====================================================================
-- (2) students — eligibility is Super-Admin-only on INSERT as well.
--
-- The previous protection covered UPDATE only, so a School Admin could create
-- a Student already ACTIVE_BILLABLE_TO_NURSERY. They may create their Student
-- with operational_status NULL; making it eligible stays a Super Admin action.
-- =====================================================================
create or replace function guard_student_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if app_is_api_client() and new.operational_status is not null
     and not app_is_super_admin() then
    raise exception 'operational_status is Super-Admin-only — create the Student without it'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists students_guard_insert on students;
create trigger students_guard_insert before insert on students
  for each row execute function guard_student_insert();

-- =====================================================================
-- (4) Student / Class institution moves are not an ordinary client edit.
--
-- A cross-institution transfer workflow is NOT_YET_DEFINED (BLOCKED_BY_SPEC),
-- so it is not exposed as a generic authenticated UPDATE for any role. The
-- owner/migration path retains it for a reviewed, deliberate correction.
-- =====================================================================
create or replace function guard_student_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.operational_status is distinct from old.operational_status and not app_is_super_admin() then
    raise exception 'operational_status is Super-Admin-only (use the Status screen)'
      using errcode = 'check_violation';
  end if;
  if new.institution_id is distinct from old.institution_id and app_is_api_client() then
    raise exception 'moving a Student between Institutions is not an approved client workflow (BLOCKED_BY_SPEC)'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function guard_class_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.institution_id is distinct from old.institution_id then
    if app_is_api_client() then
      raise exception 'moving a Class between Institutions is not an approved client workflow (BLOCKED_BY_SPEC)'
        using errcode = 'check_violation';
    end if;
    -- Integrity on EVERY path: moving a Class must not silently orphan the
    -- Students or classroom staff attached to it (the invariant that
    -- 0032 enforced only when the relationship row itself changed).
    if exists (
      select 1 from students s
      where s.class_id = new.id and s.institution_id is distinct from new.institution_id
    ) then
      raise exception 'cannot move a Class that still has Students assigned — their institution would no longer match'
        using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from class_staff cs
      join app_users au on au.user_id = cs.user_id
      where cs.class_id = new.id and au.institution_id is distinct from new.institution_id
    ) then
      raise exception 'cannot move a Class that still has classroom staff assigned — their institution would no longer match'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

-- (4) Defense in depth in the authorization helpers themselves: a classroom
-- staff member's scope also requires CURRENT institution consistency, so a
-- stale/rogue class_staff row alone cannot grant cross-tenant reach.
create or replace function app_can_see_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role = 'school_admin' and exists (
              select 1 from students s where s.id = p_student and s.institution_id = me.institution_id))
        or (me.role = 'classroom_staff' and exists (
              select 1 from students s
              join class_staff cs on cs.class_id = s.class_id
              where s.id = p_student and cs.user_id = me.user_id
                and s.institution_id = me.institution_id))
        or (me.role = 'parent' and exists (
              select 1 from student_parents sp
              where sp.student_id = p_student and sp.user_id = me.user_id))
      )
  );
$$;

create or replace function app_can_record_for_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    join students s on s.id = p_student
    join class_staff cs on cs.class_id = s.class_id
    where me.user_id = auth.uid()
      and me.role = 'classroom_staff'
      and cs.user_id = me.user_id
      and me.institution_id = s.institution_id     -- current tenant consistency
      and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
  )
  or exists (
    -- Super Admin override only. School Admin recording is NOT_YET_DEFINED.
    select 1 from app_users me
    join students s on s.id = p_student
    where me.user_id = auth.uid()
      and me.role = 'super_admin'
      and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
  );
$$;

create or replace function app_can_record_in_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c
    join app_users me on me.user_id = auth.uid()
    where c.id = p_class
      and (
        (me.role = 'classroom_staff'
         and me.institution_id = c.institution_id      -- current tenant consistency
         and exists (select 1 from class_staff cs where cs.class_id = c.id and cs.user_id = me.user_id))
        or me.role = 'super_admin'
      )
  );
$$;

-- =====================================================================
-- (3) student_parents — School Admin is read-only until the Parent
-- association workflow is approved. The frontend already says so; the
-- database must agree. No invitation / self-claim / unlink semantics are
-- invented here — only the currently implemented Super Admin link remains.
-- =====================================================================
drop policy if exists student_parents_insert on student_parents;
drop policy if exists student_parents_delete on student_parents;
create policy student_parents_insert on student_parents for insert
  with check (app_is_super_admin());
create policy student_parents_delete on student_parents for delete
  using (app_is_super_admin());

-- =====================================================================
-- (5) No generic hard delete of core historical entities.
--
-- Retention / archive / deletion semantics are NOT_YET_DEFINED. A Student
-- delete cascades into operational relationships and history; a Class delete
-- nulls historical class references; an Institution delete cascades a whole
-- tenant. Until an approved archive/deactivation workflow exists, no client
-- role gets generic hard-delete authority over these. Genuine, implemented
-- configuration actions (class_staff removal, rotation-slot clearing,
-- calendar exceptions) are deliberately left alone.
-- =====================================================================
drop policy if exists students_delete on students;
drop policy if exists classes_delete on classes;
drop policy if exists app_users_delete on app_users;
drop policy if exists serving_records_delete on serving_records;   -- operational history
drop policy if exists serving_notes_delete on serving_notes;       -- operational history

-- institutions_write was FOR ALL (delete included) — split it so that
-- insert/update stay with the Super Admin and delete has no policy at all.
drop policy if exists institutions_write on institutions;
create policy institutions_insert on institutions for insert
  with check (app_is_super_admin());
create policy institutions_update on institutions for update
  using (app_is_super_admin()) with check (app_is_super_admin());

revoke delete on institutions, app_users, students, classes,
                 serving_records, serving_notes
  from authenticated, anon;

-- =====================================================================
-- (6) Raw planning tables are Admin-side, not downstream-readable.
--
-- Draft is not operational: a Parent or an assigned Classroom Staff member
-- could read internal Service Plans, Rotation Assignments and not-yet-
-- materialised Calendar Exceptions for their institution. Downstream roles
-- consume the PUBLISHED meal_services truth instead. Planning WRITE stays
-- Super-Admin-only exactly as before — no new Nursery Admin privilege.
-- =====================================================================
drop policy if exists service_plans_select on institution_service_plans;
create policy service_plans_select on institution_service_plans for select
  using (app_can_manage_institution(institution_id));

drop policy if exists rotation_assign_select on institution_rotation_assignments;
create policy rotation_assign_select on institution_rotation_assignments for select
  using (app_can_manage_institution(institution_id));

drop policy if exists calendar_exceptions_select on calendar_exceptions;
create policy calendar_exceptions_select on calendar_exceptions for select
  using (app_can_manage_institution(institution_id));

-- =====================================================================
-- (7) Retire the remaining legacy client surfaces. Historical rows are
-- PRESERVED — only client access is withdrawn.
--
-- Note on scope: `eligibility` and `messages` were already DROPPED by
-- migration 0009 (the 0004 policies quoted in review are dead text on this
-- schema — there is no table left to expose). They are handled defensively
-- below so that any database still carrying them is closed too, rather than
-- assuming every deployment is at the same ledger position.
-- =====================================================================
-- menus: 0026 already called this LEGACY, historical/read-only. Make that
-- true at the boundary — no client writes, and no blanket read for every
-- authenticated user.
drop policy if exists menus_write on menus;
drop policy if exists menus_select on menus;
create policy menus_select on menus for select
  using (app_is_super_admin());
revoke insert, update, delete on menus from authenticated, anon;

do $$
begin
  -- eligibility: superseded by students.operational_status. Leaving it
  -- client-writable would keep a parallel, unused eligibility workflow open.
  if to_regclass('public.eligibility') is not null then
    execute 'drop policy if exists eligibility_write on eligibility';
    execute 'drop policy if exists eligibility_select on eligibility';
    execute 'create policy eligibility_select on eligibility for select using (app_is_super_admin())';
    execute 'revoke insert, update, delete on eligibility from authenticated, anon';
  end if;

  -- messages: the confirmed MVP has NO live chat. The dormant channel is
  -- closed rather than left open with Parent INSERT / Staff UPDATE policies.
  if to_regclass('public.messages') is not null then
    execute 'drop policy if exists messages_insert on messages';
    execute 'drop policy if exists messages_update on messages';
    execute 'drop policy if exists messages_delete on messages';
    execute 'drop policy if exists messages_select on messages';
    execute 'create policy messages_select on messages for select using (app_is_super_admin())';
    execute 'revoke insert, update, delete on messages from authenticated, anon';
  end if;
end $$;

-- =====================================================================
-- (11) meal_services is a CONTROLLED write path.
--
-- publish_meal_services() is the authoritative materialisation path and
-- carries the publish semantics and integrity rules. A generic Super Admin
-- table write could create malformed dated service rows that bypass them.
-- Downstream roles stay read-only and published-only (meal_services_select is
-- unchanged). The SECURITY DEFINER RPC and the owner/migration path retain
-- the privileged write.
-- =====================================================================
drop policy if exists meal_services_write on meal_services;
revoke insert, update, delete on meal_services from authenticated, anon;

-- =====================================================================
-- (9) Deterministic effective-dated planning configuration.
--
-- Both tables are effective-dated history and the resolver orders by
-- effective_from, so two rows for the SAME institution+date make "which
-- configuration wins" ambiguous. History is preserved; only same-date
-- duplicates are prevented. Existing ambiguity is REPORTED, never guessed
-- away: if duplicates already exist this migration stops with the list.
-- =====================================================================
do $$
declare d text;
begin
  select string_agg(institution_id::text || ' @ ' || effective_from::text, ', ')
    into d
    from (select institution_id, effective_from
            from institution_service_plans
           group by 1, 2 having count(*) > 1) x;
  if d is not null then
    raise exception 'Ambiguous institution_service_plans rows (institution @ effective_from): % — resolve these manually before applying 0033; this migration will not guess which row wins', d;
  end if;

  select string_agg(institution_id::text || ' @ ' || effective_from::text, ', ')
    into d
    from (select institution_id, effective_from
            from institution_rotation_assignments
           group by 1, 2 having count(*) > 1) x;
  if d is not null then
    raise exception 'Ambiguous institution_rotation_assignments rows (institution @ effective_from): % — resolve these manually before applying 0033; this migration will not guess which row wins', d;
  end if;
end $$;

create unique index if not exists service_plans_one_per_effective_date
  on institution_service_plans (institution_id, effective_from);
create unique index if not exists rotation_assign_one_per_effective_date
  on institution_rotation_assignments (institution_id, effective_from);

-- anchor_week must address a week the selected Menu actually has.
create or replace function guard_rotation_anchor_week()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_weeks int;
begin
  select week_count into v_weeks from rotations where id = new.rotation_id;
  if v_weeks is null then
    raise exception 'rotation % does not exist', new.rotation_id using errcode = 'check_violation';
  end if;
  if new.anchor_week < 1 or new.anchor_week > v_weeks then
    raise exception 'anchor_week % is outside the Menu''s % week(s)', new.anchor_week, v_weeks
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists rotation_assign_guard_anchor on institution_rotation_assignments;
create trigger rotation_assign_guard_anchor
  before insert or update on institution_rotation_assignments
  for each row execute function guard_rotation_anchor_week();

-- The same invariant from the referenced side: shrinking a Menu must not
-- strand an assignment whose anchor_week no longer exists.
create or replace function guard_rotation_week_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.week_count < old.week_count and exists (
    select 1 from institution_rotation_assignments ira
    where ira.rotation_id = new.id and ira.anchor_week > new.week_count
  ) then
    raise exception 'cannot shrink this Menu to % week(s) — an institution assignment still anchors beyond it', new.week_count
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists rotations_guard_week_count on rotations;
create trigger rotations_guard_week_count before update on rotations
  for each row execute function guard_rotation_week_count();

-- =====================================================================
-- (8) Every NEW classroom record anchors to a published Meal Service.
--
-- Previously only served_status='served' required/resolved a service, so an
-- authorized RPC call could create NOT_SERVED rows (absent / unwell / asleep)
-- against a period that was never published for that institution —
-- disconnected observations that distort completion and reporting.
--
-- Now: an applicable Meal period must have a published Meal Service for that
-- institution/date/period, whatever the served_status. If nothing is
-- published, recording that period fails. Historical pre-cutover rows with a
-- NULL link are untouched and stay grandfathered.
-- =====================================================================
create or replace function record_serving_batch(p_class uuid, p_rows jsonb, p_date date default null)
returns table(out_id uuid, out_student_id uuid)
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

    -- The student must belong to the class being recorded.
    select s.institution_id into v_inst
      from students s
     where s.id = v_student and s.class_id = p_class;
    if v_inst is null then
      raise exception 'Student % is not in class %', v_student, p_class using errcode = 'check_violation';
    end if;

    -- EVERY new record — served or not served — must anchor to the applicable
    -- published Meal Service. Resolve it when the caller did not supply one.
    if v_service is null then
      select sr.meal_service_id into v_service
        from serving_records sr
       where sr.student_id = v_student and sr.serving_date = v_date and sr.period = v_period;
    end if;
    if v_service is null then
      select ms.id into v_service
        from meal_services ms
       where ms.institution_id = v_inst and ms.service_date = v_date
         and ms.period = v_period and ms.published;
    end if;
    if v_service is null then
      raise exception 'No published Meal for % on % — that period is not an applicable service for this institution, so it cannot be recorded', v_period, v_date
        using errcode = 'check_violation';
    end if;

    -- Whatever service id we store must match this student's institution, the
    -- serving date, the period, and be published.
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
end $$;
revoke all on function record_serving_batch(uuid, jsonb, date) from public, anon;
grant execute on function record_serving_batch(uuid, jsonb, date) to authenticated;

-- =====================================================================
-- (8b) Dashboard completion counts only APPLICABLE records.
--
-- meals_today previously counted every serving_record for the date, so a
-- disconnected or non-applicable observation (or one for a non-eligible
-- student) inflated the ratio — potentially above 100%. It now counts only
-- records that are for an ELIGIBLE student AND anchored to a Meal Service
-- published for that institution/date, which is exactly the denominator
-- expected_today is built from.
-- =====================================================================
create or replace view v_dashboard_institutions as
with periods_today as (
  select ms.institution_id, count(distinct ms.period)::int as periods_today
    from meal_services ms
   where ms.published and ms.service_date = app_operational_date()
   group by ms.institution_id
), records_today as (
  select s.institution_id, count(distinct sr.id)::int as meals_today
    from serving_records sr
    join students s on s.id = sr.student_id
    join meal_services ms on ms.id = sr.meal_service_id
   where sr.serving_date = app_operational_date()
     and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
     and ms.published
     and ms.service_date = sr.serving_date
     and ms.period = sr.period
     and ms.institution_id = s.institution_id
   group by s.institution_id
)
select
  i.id as institution_id,
  i.name,
  count(distinct c.id)::int as classrooms,
  count(distinct s.id) filter (where s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY')::int as active_students,
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

comment on view v_dashboard_institutions is
  'Dashboard read model. meals_today counts only APPLICABLE completions: an '
  'eligible student''s record anchored to a Meal Service published for that '
  'institution/date/period, so the ratio against expected_today cannot exceed 100%.';

-- =====================================================================
-- (12) Honest terminology, finished.
--
-- 0032 renamed meal_production_demand.allergy_flagged -> safety_note_flagged.
-- v_production_demand (the Institution overview counter) still exposed the old
-- name for the SAME interim medical_notes count, so the stale term survived on
-- an active surface. medical_notes is interim free-text safety notes (0029);
-- the structured Allergy/Dietary model is BLOCKED_BY_SPEC (§42).
-- =====================================================================
drop view if exists v_production_demand;
drop function if exists v_production_demand_impl();
create function v_production_demand_impl()
returns table (
  institution_id uuid,
  institution_name text,
  kitchen_id uuid,
  kitchen_name text,
  eligible_students bigint,
  safety_note_flagged bigint
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
    ) as safety_note_flagged
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
create view v_production_demand as select * from v_production_demand_impl();
revoke all on function v_production_demand_impl() from public, anon;
grant execute on function v_production_demand_impl() to authenticated;
grant select on v_production_demand to authenticated;
comment on view v_production_demand is
  'Per-institution eligible headcount. safety_note_flagged counts eligible '
  'students carrying ANY interim medical_notes entry — NOT an authoritative '
  'allergy flag (the structured Allergy/Dietary model is BLOCKED_BY_SPEC, §42).';
