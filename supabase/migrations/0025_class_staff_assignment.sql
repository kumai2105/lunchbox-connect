-- =====================================================================
-- 0025 — Multi-staff-per-class assignment (correction order §16/§17).
--
-- classes.teacher_id modelled "one teacher per class" as the whole
-- relationship. Real classrooms have several permitted staff, and one staff
-- member covers several classes. This adds a proper many-to-many join,
-- migrates the existing teacher_id assignments into it, and rewrites every
-- authorization helper to use class membership. teacher_id is kept as a
-- nullable legacy column (a "primary contact" hint) but no longer drives
-- authorization — nothing reads it for scope after this migration.
-- =====================================================================

create table if not exists class_staff (
  class_id uuid not null references classes (id) on delete cascade,
  user_id  uuid not null references app_users (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists idx_class_staff_user on class_staff (user_id);

-- Migrate existing single-teacher assignments (no history lost).
insert into class_staff (class_id, user_id)
select c.id, c.teacher_id from classes c
where c.teacher_id is not null
on conflict do nothing;

alter table class_staff enable row level security;

-- Reads: super admin; the school admin of the class's institution; and the
-- staff member seeing their own membership rows.
drop policy if exists class_staff_select on class_staff;
create policy class_staff_select on class_staff for select using (
  app_is_super_admin()
  or user_id = auth.uid()
  or exists (
    select 1 from classes c
    where c.id = class_staff.class_id and app_can_manage_institution(c.institution_id)
  )
);

-- Writes: super admin, or the school admin who manages the class's institution
-- (a Nursery Admin provisioning staff for their own classes, §17). A school
-- admin may only attach a user who belongs to that same institution.
drop policy if exists class_staff_write on class_staff;
create policy class_staff_write on class_staff for all using (
  app_is_super_admin()
  or exists (
    select 1 from classes c
    where c.id = class_staff.class_id and app_can_manage_institution(c.institution_id)
  )
) with check (
  app_is_super_admin()
  or (
    exists (select 1 from classes c
            where c.id = class_staff.class_id and app_can_manage_institution(c.institution_id))
    and exists (select 1 from classes c join app_users u on u.user_id = class_staff.user_id
                where c.id = class_staff.class_id and u.institution_id = c.institution_id)
  )
);

grant select, insert, delete on class_staff to authenticated;

-- ---- rewrite the 5 authorization helpers to use class_staff --------------
create or replace function app_assigned_class_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select cs.class_id from class_staff cs where cs.user_id = auth.uid();
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
        or exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.class_id = c.id and sp.user_id = auth.uid()
        )
      )
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
         and exists (select 1 from class_staff cs where cs.class_id = c.id and cs.user_id = me.user_id))
        or (me.role = 'school_admin' and c.institution_id = me.institution_id)
        or me.role = 'super_admin'
      )
  );
$$;

create or replace function app_can_see_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role = 'school_admin' and exists (
              select 1 from students s
              where s.id = p_student and s.institution_id = me.institution_id))
        or (me.role = 'classroom_staff' and exists (
              select 1 from students s
              join class_staff cs on cs.class_id = s.class_id
              where s.id = p_student and cs.user_id = me.user_id))
        or exists (
          select 1 from student_parents sp
          where sp.student_id = p_student and sp.user_id = me.user_id)
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
    select 1 from app_users me
    join students s on s.id = p_student
    where me.user_id = auth.uid()
      and me.role in ('super_admin', 'school_admin')
      and (me.role = 'super_admin' or me.institution_id = s.institution_id)
      and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
  );
$$;

comment on table class_staff is
  'Many-to-many Classroom Staff ⇄ Class assignment (§16). Authoritative for '
  'classroom_staff scope; classes.teacher_id is a legacy primary-contact hint '
  'only and no longer drives authorization.';
