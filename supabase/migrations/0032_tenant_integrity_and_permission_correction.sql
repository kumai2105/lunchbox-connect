-- =====================================================================
-- 0032 — Tenant-integrity triggers + correction of invented permissions.
-- No product redesign. New migration (applied history is not rewritten).
--
-- (1)  A Student's Class must belong to the SAME institution as the Student
--      (or be NULL). Enforced on INSERT and UPDATE, every path.
-- (2)  student_parents.user_id must reference a role='parent' account; the
--      guardian branches of the visibility helpers also require the caller to
--      be a parent (defense in depth).
-- (3)  Nursery/School Admin classroom RECORDING is NOT_YET_DEFINED — remove the
--      invented grant from the record helpers (Classroom Staff + Super Admin only).
-- (4)  Note PUBLICATION authority is NOT_YET_DEFINED — remove the invented
--      School Admin publish; only the Super Admin system-wide override remains.
--      The normal reviewer workflow is BLOCKED_BY_SPEC.
-- (12) class_staff.user_id must be a classroom_staff account in the SAME
--      institution as the Class.
-- =====================================================================

-- ---- (1) student ⇄ class tenant integrity --------------------------------
create or replace function guard_student_class_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_class_inst uuid;
begin
  if new.class_id is not null then
    select institution_id into v_class_inst from classes where id = new.class_id;
    if v_class_inst is distinct from new.institution_id then
      raise exception 'Student % cannot be assigned to a Class in another institution', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists students_guard_class_tenant on students;
create trigger students_guard_class_tenant before insert or update on students
  for each row execute function guard_student_class_tenant();

-- ---- (2) guardianship is parent-only -------------------------------------
create or replace function guard_student_parent_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select role from app_users where user_id = new.user_id) is distinct from 'parent' then
    raise exception 'student_parents.user_id must be a parent account'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists student_parents_guard_role on student_parents;
create trigger student_parents_guard_role before insert or update on student_parents
  for each row execute function guard_student_parent_role();

-- Defense in depth: the guardian branch of each visibility helper also
-- requires the caller to actually be a parent, so a stray relationship row
-- (should one ever exist) cannot expand a non-parent's scope.
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
              where s.id = p_student and cs.user_id = me.user_id))
        or (me.role = 'parent' and exists (
              select 1 from student_parents sp
              where sp.student_id = p_student and sp.user_id = me.user_id))
      )
  );
$$;

create or replace function app_can_see_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c
    where c.id = p_class
      and (
        app_is_super_admin()
        or (app_current_role() = 'school_admin' and app_can_manage_institution(c.institution_id))
        or (app_current_role() = 'classroom_staff'
            and exists (select 1 from class_staff cs where cs.class_id = c.id and cs.user_id = auth.uid()))
        or (app_current_role() = 'parent' and exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.class_id = c.id and sp.user_id = auth.uid()
        ))
      )
  );
$$;

create or replace function app_can_see_institution(p_inst uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
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
$$;

-- ---- (3) remove invented Nursery/School Admin RECORDING ------------------
create or replace function app_can_record_in_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c
    join app_users me on me.user_id = auth.uid()
    where c.id = p_class
      and (
        (me.role = 'classroom_staff'
         and exists (select 1 from class_staff cs where cs.class_id = c.id and cs.user_id = me.user_id))
        -- Super Admin keeps the explicitly approved administrative override.
        -- Nursery/School Admin recording is NOT_YET_DEFINED — not granted here.
        or me.role = 'super_admin'
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

-- ---- (4) note publication: Super Admin override only; reviewer BLOCKED_BY_SPEC
-- Classroom Staff still write internal (unpublished) notes (staff policy below).
-- The normal review/publish workflow (who, process, conditions) is
-- NOT_YET_DEFINED, so School/Nursery Admin do NOT publish free text.
drop policy if exists serving_notes_insert on serving_notes;
create policy serving_notes_insert on serving_notes for insert
  with check (
    exists (select 1 from serving_records sr where sr.id = serving_record_id
            and app_can_record_for_student(sr.student_id))
    and (published_at is null or app_is_super_admin())
  );

drop policy if exists serving_notes_update_admin on serving_notes;
drop policy if exists serving_notes_update_staff on serving_notes;
-- Super Admin: system-wide administrative override (may publish/edit).
create policy serving_notes_update_super on serving_notes for update
  using (app_is_super_admin()) with check (app_is_super_admin());
-- Classroom Staff: edit an UNPUBLISHED note, must keep it unpublished; never
-- touch a published family note.
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

-- ---- (12) class_staff membership is classroom_staff, same institution -----
create or replace function guard_class_staff_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role app_role; v_user_inst uuid; v_class_inst uuid;
begin
  select role, institution_id into v_role, v_user_inst from app_users where user_id = new.user_id;
  select institution_id into v_class_inst from classes where id = new.class_id;
  if v_role is distinct from 'classroom_staff' then
    raise exception 'class_staff.user_id must be a classroom_staff account'
      using errcode = 'check_violation';
  end if;
  if v_user_inst is distinct from v_class_inst then
    raise exception 'classroom staff and class must be in the same institution'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists class_staff_guard_membership on class_staff;
create trigger class_staff_guard_membership before insert or update on class_staff
  for each row execute function guard_class_staff_membership();

-- ---- (6) Kitchen: honest interim safety-note count, not "allergy-flagged" ---
-- medical_notes is interim free-text safety notes (0029); the structured
-- Allergy/Dietary model is BLOCKED_BY_SPEC (§42). Renaming the output column
-- from allergy_flagged makes the Kitchen metric honest: a count of eligible
-- students who have ANY interim safety note, not an authoritative allergy flag.
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
      or (me.role = 'school_admin' and me.institution_id = ms.institution_id)
    )
  group by ms.institution_id, i.name, ms.period, ms.meal_revision_id, mr.name
  order by ms.period, mr.name, i.name;
$$;
revoke all on function meal_production_demand(date) from public, anon;
grant execute on function meal_production_demand(date) to authenticated;
comment on function meal_production_demand(date) is
  'Per-published-meal Kitchen demand. safety_note_flagged counts eligible '
  'students carrying ANY interim medical_notes entry — NOT an authoritative '
  'allergy flag (the structured Allergy/Dietary model is BLOCKED_BY_SPEC, §42).';
