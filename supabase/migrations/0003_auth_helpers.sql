-- 0003: authorization helper functions -----------------------------------------
-- All helpers are SECURITY DEFINER so policies can call them without recursion.
-- They re-check the caller's identity explicitly; they never trust arguments alone.

create or replace function app_current_user_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select auth.uid();
$$;

create or replace function app_current_role()
returns app_role
language sql stable security definer set search_path = public as $$
  select role from app_users where user_id = auth.uid();
$$;

create or replace function app_is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_current_role() = 'super_admin', false);
$$;

create or replace function app_is_school_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_current_role() = 'school_admin', false);
$$;

create or replace function app_is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_current_role() in ('school_admin', 'nurse', 'teacher'), false);
$$;

create or replace function app_is_parent()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_current_role() = 'parent', false);
$$;

-- institution of the caller when they are staff; null otherwise
create or replace function app_current_institution_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from app_users where user_id = auth.uid() and role in ('school_admin', 'nurse', 'teacher');
$$;

-- visibility: a staff member sees their own institution; a parent sees their own children
create or replace function app_can_see_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.role = 'super_admin'
        or (
          me.role in ('school_admin', 'nurse', 'teacher')
          and exists (
            select 1 from students s
            where s.id = p_student and s.institution_id = me.institution_id
          )
        )
        or exists (
          select 1 from student_parents sp
          where sp.student_id = p_student and sp.user_id = me.user_id
        )
      )
  );
$$;

-- management rights: super admin, or the school admin of the student's institution
create or replace function app_can_manage_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    join students s on s.id = p_student
    where me.user_id = auth.uid()
      and (me.role = 'super_admin' or (me.role = 'school_admin' and me.institution_id = s.institution_id))
  );
$$;

-- recording rights on a serving row: any staff of the student's institution
create or replace function app_can_record_for_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    join students s on s.id = p_student
    where me.user_id = auth.uid()
      and me.role in ('school_admin', 'nurse', 'teacher')
      and me.institution_id = s.institution_id
  );
$$;

create or replace function app_can_see_institution(p_inst uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role in ('school_admin', 'nurse', 'teacher') and me.institution_id = p_inst)
        or exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.institution_id = p_inst and sp.user_id = me.user_id
        )
      )
  );
$$;

create or replace function app_can_manage_institution(p_inst uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (me.role = 'super_admin' or (me.role = 'school_admin' and me.institution_id = p_inst))
  );
$$;

create or replace function app_can_see_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c
    where c.id = p_class
      and (
        app_can_see_institution(c.institution_id)
        or exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.class_id = c.id and sp.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function app_can_manage_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c
    where c.id = p_class and app_can_manage_institution(c.institution_id)
  );
$$;

create or replace function app_can_see_user(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.user_id = p_user
        or me.role = 'super_admin'
        or (me.role in ('school_admin', 'nurse', 'teacher') and me.institution_id = (select institution_id from app_users target where target.user_id = p_user))
      )
  );
$$;