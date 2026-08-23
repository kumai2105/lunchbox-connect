-- =====================================================================
-- 0044 — the lifecycles the product could not previously express
--
-- Three things had no OFF switch, and the canonical documentation said so
-- explicitly: account deactivation, Institution archival and Class archival
-- were all NOT_YET_DEFINED. That is why no test could ever have caught them —
-- there was no rule to test against. The Founder has now approved the minimum
-- conservative rules, and this migration is those rules at the database
-- boundary, where a UI cannot talk its way around them.
--
-- Nothing here hard-deletes anything. A person, an Institution and a Class all
-- carry operational history that other records point at; destroying the row
-- would falsify the history rather than end the relationship.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) An account is ACTIVE or DEACTIVATED, and says who did it and why.
-- ---------------------------------------------------------------------
alter table app_users
  add column if not exists active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references app_users (user_id) on delete set null,
  add column if not exists deactivated_reason text;

create index if not exists app_users_active_idx on app_users (active, role);

comment on column app_users.active is
  'False means the person may not use the platform. The row is kept because '
  'serving records, notes and audit entries reference it; deleting it would '
  'rewrite history rather than end an employment.';

-- ---------------------------------------------------------------------
-- (2) DEACTIVATION MUST REMOVE AUTHORITY, NOT JUST HIDE A ROW.
--
-- A JWT already in a browser stays valid until it expires, so "the UI signs
-- them out" is not a security boundary. Every authorization helper resolves
-- the caller through their app_users row; each one now requires that row to be
-- active, so a deactivated person holding a live token is refused by the
-- database itself.
--
-- The three identity helpers below are gated at source. The predicate helpers
-- after them are the CURRENT live definitions read back out of the database
-- with pg_get_functiondef and reissued with `and me.active` added to the
-- caller's own row — deliberately not retyped from the original migrations,
-- because a transcription slip in an authorization helper is exactly the class
-- of mistake that does not announce itself.
--
-- app_can_see_class is not listed: it is written entirely in terms of
-- app_is_super_admin() and app_current_role(), so gating those covers it.
-- ---------------------------------------------------------------------
create or replace function app_current_role()
returns app_role
language sql stable security definer set search_path = public as $$
  select role from app_users where user_id = auth.uid() and active;
$$;

create or replace function app_current_institution_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from app_users
   where user_id = auth.uid() and active
     and role in ('school_admin', 'classroom_staff');
$$;

create or replace function app_current_kitchen_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select kitchen_id from app_users
  where user_id = auth.uid() and active and role = 'kitchen';
$$;

CREATE OR REPLACE FUNCTION public.app_can_manage_institution(p_inst uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid() and me.active
      and (me.role = 'super_admin' or (me.role = 'school_admin' and me.institution_id = p_inst))
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_can_manage_student(p_student uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from app_users me
    join students s on s.id = p_student
    where me.user_id = auth.uid() and me.active
      and (me.role = 'super_admin' or (me.role = 'school_admin' and me.institution_id = s.institution_id))
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_can_record_for_student(p_student uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from app_users me
    join students s on s.id = p_student
    join class_staff cs on cs.class_id = s.class_id
    where me.user_id = auth.uid() and me.active
      and me.role = 'classroom_staff'
      and cs.user_id = me.user_id
      and me.institution_id = s.institution_id     -- current tenant consistency
      and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
  )
  or exists (
    -- Super Admin override only. School Admin recording is NOT_YET_DEFINED.
    select 1 from app_users me
    join students s on s.id = p_student
    where me.user_id = auth.uid() and me.active
      and me.role = 'super_admin'
      and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_can_record_in_class(p_class uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from classes c
    join app_users me on me.user_id = auth.uid() and me.active
    where c.id = p_class
      and (
        (me.role = 'classroom_staff'
         and me.institution_id = c.institution_id      -- current tenant consistency
         and exists (select 1 from class_staff cs where cs.class_id = c.id and cs.user_id = me.user_id))
        or me.role = 'super_admin'
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_can_see_institution(p_inst uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid() and me.active
      and (
        me.role = 'super_admin'
        or (me.role in ('school_admin', 'classroom_staff') and me.institution_id = p_inst)
        or (me.role = 'parent' and exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.institution_id = p_inst and sp.user_id = me.user_id
        ))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_can_see_student(p_student uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid() and me.active
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
$function$;

CREATE OR REPLACE FUNCTION public.app_can_see_user(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid() and me.active
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
$function$;

-- ---------------------------------------------------------------------
-- (3) A deactivated person disappears from ASSIGNMENT, not from history.
--
-- class_staff is a CURRENT operational membership, so a deactivated member
-- must not remain assigned. app_users_select still returns the row to an
-- authorized Admin, which is what makes a Deactivated view possible.
-- ---------------------------------------------------------------------
create or replace function app_is_last_active_super_admin(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_users where user_id = p_user and role = 'super_admin' and active)
     and (select count(*) from app_users where role = 'super_admin' and active) <= 1;
$$;

-- Who may change whose account state.
--   Super Admin       — anyone.
--   Institution Admin — Classroom Staff of their OWN institution, and nobody
--                       else. Not another Institution's staff, not a Parent,
--                       not a Kitchen user, not another Institution Admin,
--                       and never a Super Admin.
create or replace function app_may_manage_account(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when app_is_super_admin() then true
    when app_current_role() = 'school_admin' then exists (
      select 1 from app_users target
      where target.user_id = p_user
        and target.role = 'classroom_staff'
        and target.institution_id = app_current_institution_id()
        and target.institution_id is not null
    )
    else false
  end;
$$;

create or replace function set_user_active(
  p_user uuid, p_active boolean, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_prev jsonb; v_removed int := 0;
begin
  if not app_may_manage_account(p_user) then
    raise exception 'You may not change this account';
  end if;
  if p_user = auth.uid() and not p_active then
    raise exception 'You cannot deactivate your own account';
  end if;
  -- The platform must never be left with nobody who can administer it.
  if not p_active and app_is_last_active_super_admin(p_user) then
    raise exception 'This is the last active Super Admin and cannot be deactivated';
  end if;

  select to_jsonb(a) - 'deactivated_reason' into v_prev from app_users a where a.user_id = p_user;
  if v_prev is null then raise exception 'User % not found', p_user; end if;

  update app_users set
    active = p_active,
    deactivated_at = case when p_active then null else now() end,
    deactivated_by = case when p_active then null else auth.uid() end,
    deactivated_reason = case when p_active then null else p_reason end
  where user_id = p_user;

  -- Current assignments end with the deactivation. Reactivation deliberately
  -- does NOT restore them: an Admin decides which classes the person returns
  -- to, because the classes they left may no longer exist or may be staffed.
  if not p_active then
    delete from class_staff where user_id = p_user;
    get diagnostics v_removed = row_count;
  end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(),
          case when p_active then 'user.reactivate' else 'user.deactivate' end,
          'app_users', p_user,
          jsonb_build_object('active', v_prev->'active'),
          jsonb_build_object('active', p_active, 'class_assignments_removed', v_removed),
          p_reason);
end $$;

revoke all on function set_user_active(uuid, boolean, text) from public, anon;
grant execute on function set_user_active(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- (4) Narrow profile correction.
--
-- Deliberately NOT a generic "edit any column" path: role, institution_id and
-- kitchen_id decide authority and tenancy, and email is an authentication
-- identity that would have to be changed in Supabase Auth and here together or
-- the two would disagree. Those stay out until each has its own workflow.
-- ---------------------------------------------------------------------
create or replace function update_user_profile(
  p_user uuid, p_full_name text, p_phone text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_prev jsonb;
begin
  if not app_may_manage_account(p_user) then
    raise exception 'You may not change this account';
  end if;
  if coalesce(btrim(p_full_name), '') = '' then
    raise exception 'Full name is required';
  end if;

  select jsonb_build_object('full_name', a.full_name, 'phone', a.phone)
    into v_prev from app_users a where a.user_id = p_user;
  if v_prev is null then raise exception 'User % not found', p_user; end if;

  update app_users set full_name = btrim(p_full_name), phone = nullif(btrim(p_phone), '')
   where user_id = p_user;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value)
  values (auth.uid(), 'user.profile_update', 'app_users', p_user, v_prev,
          jsonb_build_object('full_name', btrim(p_full_name), 'phone', nullif(btrim(p_phone), '')));
end $$;

revoke all on function update_user_profile(uuid, text, text) from public, anon;
grant execute on function update_user_profile(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- (5) INSTITUTION LIFECYCLE — closing a stated contradiction.
--
-- 0041 and the operating guide both say Institutions are "archived, never
-- destroyed, because students, classes, meal services and serving records all
-- reference them". The institutions table had four columns — id, name, kind,
-- created_at — and no state to archive INTO. The rule was written down and
-- then not implemented, which is worse than either alone.
-- ---------------------------------------------------------------------
alter table institutions
  add column if not exists active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references app_users (user_id) on delete set null,
  add column if not exists archived_reason text;

comment on column institutions.active is
  'False means the customer relationship is not operating: no new configuration, '
  'publication or classroom activity. Everything already recorded is preserved '
  'and stays readable.';

create or replace function app_institution_is_active(p_inst uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select i.active from institutions i where i.id = p_inst), false);
$$;

create or replace function set_institution_active(
  p_inst uuid, p_active boolean, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_prev boolean; v_future int;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may archive or reactivate an institution';
  end if;

  select i.active into v_prev from institutions i where i.id = p_inst;
  if v_prev is null then raise exception 'Institution % not found', p_inst; end if;

  -- Refuse rather than silently absorb. A published Meal Service in the future
  -- is a commitment to feed children on a named day; archiving the institution
  -- under it would either cancel that quietly or leave a service belonging to
  -- an institution that is not operating. Neither is the software's decision.
  if not p_active then
    select count(*) into v_future
      from meal_services ms
     where ms.institution_id = p_inst
       and ms.published
       and ms.service_date >= app_operational_date();
    if v_future > 0 then
      raise exception
        'This institution has % published meal service(s) dated today or later. Resolve them deliberately before archiving.', v_future;
    end if;
  end if;

  update institutions set
    active = p_active,
    archived_at = case when p_active then null else now() end,
    archived_by = case when p_active then null else auth.uid() end,
    archived_reason = case when p_active then null else p_reason end
  where id = p_inst;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(),
          case when p_active then 'institution.reactivate' else 'institution.archive' end,
          'institutions', p_inst,
          jsonb_build_object('active', v_prev),
          jsonb_build_object('active', p_active),
          p_reason);
end $$;

revoke all on function set_institution_active(uuid, boolean, text) from public, anon;
grant execute on function set_institution_active(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- (6) CLASS LIFECYCLE — classes.active has existed since 0002 and never
--     meant anything. It does now.
--
-- Archiving is refused while any Student is still assigned or any staff
-- membership remains, rather than cascading. "What happens to the children in
-- an archived class" is a real operational question and the software does not
-- get to answer it silently: the Admin moves them first, deliberately.
-- ---------------------------------------------------------------------
alter table classes
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references app_users (user_id) on delete set null,
  add column if not exists archived_reason text;

create or replace function app_class_is_active(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select c.active from classes c where c.id = p_class), false);
$$;

create or replace function set_class_active(
  p_class uuid, p_active boolean, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_prev boolean; v_inst uuid; v_students int; v_staff int;
begin
  select c.active, c.institution_id into v_prev, v_inst from classes c where c.id = p_class;
  if v_prev is null then raise exception 'Class % not found', p_class; end if;

  if not app_can_manage_institution(v_inst) then
    raise exception 'You may not change this class';
  end if;

  if not p_active then
    select count(*) into v_students from students s where s.class_id = p_class;
    select count(*) into v_staff from class_staff cs where cs.class_id = p_class;
    if v_students > 0 or v_staff > 0 then
      raise exception
        'This class still has % student(s) and % staff assignment(s). Move them before archiving it.',
        v_students, v_staff;
    end if;
  else
    -- A class cannot come back to life inside an institution that is not
    -- operating; the institution is reactivated first.
    if not app_institution_is_active(v_inst) then
      raise exception 'Reactivate the institution before restoring its classes';
    end if;
  end if;

  update classes set
    active = p_active,
    archived_at = case when p_active then null else now() end,
    archived_by = case when p_active then null else auth.uid() end,
    archived_reason = case when p_active then null else p_reason end
  where id = p_class;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(),
          case when p_active then 'class.restore' else 'class.archive' end,
          'classes', p_class,
          jsonb_build_object('active', v_prev),
          jsonb_build_object('active', p_active),
          p_reason);
end $$;

revoke all on function set_class_active(uuid, boolean, text) from public, anon;
grant execute on function set_class_active(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- (7) THE INVARIANTS THAT MAKE ARCHIVING MEAN SOMETHING.
--
-- Hiding an archived record in the UI is not archiving it. These triggers are
-- what stop an archived Institution or Class from continuing to operate, and
-- they hold for any caller — the app, a script, or a direct API call.
-- ---------------------------------------------------------------------
create or replace function app_guard_active_institution()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_inst uuid;
begin
  v_inst := case tg_table_name
    when 'classes' then new.institution_id
    when 'students' then new.institution_id
    when 'meal_services' then new.institution_id
    when 'institution_service_plans' then new.institution_id
    when 'institution_rotation_assignments' then new.institution_id
    when 'calendar_exceptions' then new.institution_id
  end;
  if v_inst is not null and not app_institution_is_active(v_inst) then
    raise exception 'This institution is archived. Reactivate it before making changes.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['classes','students','meal_services',
                           'institution_service_plans','institution_rotation_assignments',
                           'calendar_exceptions'] loop
    execute format('drop trigger if exists trg_%s_institution_active on %I', t, t);
    execute format(
      'create trigger trg_%s_institution_active before insert or update on %I
         for each row execute function app_guard_active_institution()', t, t);
  end loop;
end $$;

-- A Student cannot be moved INTO an archived class, and staff cannot be
-- assigned to one. Existing rows are untouched — history stays as it was.
create or replace function app_guard_active_class()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_class uuid;
begin
  v_class := case tg_table_name
    when 'students' then new.class_id
    when 'class_staff' then new.class_id
    when 'serving_records' then new.class_id
  end;
  if v_class is not null and not app_class_is_active(v_class) then
    raise exception 'That class is archived and cannot take new assignments or records.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['students','class_staff','serving_records'] loop
    execute format('drop trigger if exists trg_%s_class_active on %I', t, t);
    execute format(
      'create trigger trg_%s_class_active before insert or update on %I
         for each row execute function app_guard_active_class()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- (8) GUARDIAN ACCESS REVOCATION — one narrow, deliberate action.
--
-- 0036 revoked DELETE on student_parents from every client role because the
-- general semantics of "unlinking a guardian" were undefined, and they still
-- are. But an incorrect or no-longer-authorized link had no correction path at
-- all, which means a parent could keep seeing a child they should not.
--
-- This is deliberately not "delete parent": the account, the child and every
-- historical record survive. Only the ACCESS relationship ends. A reason is
-- required, because revoking someone's sight of a child is not a tidy-up.
-- ---------------------------------------------------------------------
create or replace function revoke_guardian_access(
  p_student uuid, p_user uuid, p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_exists boolean;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may revoke guardian access';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to revoke guardian access';
  end if;

  select exists (
    select 1 from student_parents sp
    where sp.student_id = p_student and sp.user_id = p_user
  ) into v_exists;
  if not v_exists then
    raise exception 'That guardian link does not exist';
  end if;

  delete from student_parents where student_id = p_student and user_id = p_user;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(), 'guardian.revoke', 'student_parents', p_student,
          jsonb_build_object('student_id', p_student, 'user_id', p_user, 'linked', true),
          jsonb_build_object('student_id', p_student, 'user_id', p_user, 'linked', false),
          btrim(p_reason));
end $$;

revoke all on function revoke_guardian_access(uuid, uuid, text) from public, anon;
grant execute on function revoke_guardian_access(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- (9) Audit reads its own new rows.
--
-- audit_log already carries actor, action, entity, previous, new, timestamp
-- and reason, so the new lifecycle events need no new table — only the
-- discipline of writing them, which each function above does inside the same
-- transaction as the change it describes. A password VALUE is never among
-- them: the reset function records that a reset happened, never what to.
-- ---------------------------------------------------------------------
