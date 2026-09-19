-- 0010: periods, menu detail, and scope enforcement ---------------------------
-- (a) Fourth meal period confirmed by docs/02 §26 / docs/09 AT-082:
--     breakfast, snack, lunch, afternoon snack.
-- (b) Menu detail for the confirmed concepts Meal / Ingredient / Allergen /
--     Nutrition / Portion (docs/04 §16-21). Exact field specs are
--     NOT_YET_DEFINED; this shape is the minimal undebatable mapping and is
--     flagged in docs/BUILD_STATUS.md.
-- (c) Classroom staff scoped to assigned classes; eligibility gate enforced
--     on serving; helper functions for the new/renamed roles.

-- (a) periods -----------------------------------------------------------------
alter type app_period add value if not exists 'afternoon_snack';

-- (b) menu detail ------------------------------------------------------------
alter table menus
  add column ingredients jsonb not null default '[]',
  add column nutrition jsonb not null default '{}',   -- {kcal, protein_g, ...}
  add column portion text,
  add column source_status text not null default 'NOT_APPROVED';

comment on column menus.source_status is
  'menu-data.json is REFERENCE_ONLY (Nurse Review Draft) and must never be '
  'marked as approved production data. Approved status values NOT_YET_DEFINED.';

-- (c) role helpers ------------------------------------------------------------
create or replace function app_is_classroom()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_current_role() = 'classroom_staff', false);
$$;

create or replace function app_is_kitchen()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_current_role() = 'kitchen', false);
$$;

create or replace function app_is_driver()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_current_role() = 'driver', false);
$$;

-- CLASSROOM SCOPE: assigned classes only (docs/02 §25-27, AT-032/AT-081)
create or replace function app_assigned_class_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from classes c
  where c.teacher_id = auth.uid();
$$;

create or replace function app_can_see_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.role = 'super_admin'
        or (
          me.role = 'school_admin'
          and exists (
            select 1 from students s
            where s.id = p_student and s.institution_id = me.institution_id
          )
        )
        or (
          me.role = 'classroom_staff'
          and exists (
            select 1 from students s
            join classes c on c.id = s.class_id
            where s.id = p_student and c.teacher_id = me.user_id
          )
        )
        or exists (
          select 1 from student_parents sp
          where sp.student_id = p_student and sp.user_id = me.user_id
        )
      )
  );
$$;

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

-- ELIGIBILITY GATE: only ACTIVE_BILLABLE_TO_NURSERY students may be served.
create or replace function app_is_operationally_eligible(p_student uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    where s.id = p_student and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
  );
$$;

create or replace function app_can_record_for_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    join students s on s.id = p_student
    join classes c on c.id = s.class_id
    where me.user_id = auth.uid()
      and me.role = 'classroom_staff'
      and c.teacher_id = me.user_id
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

-- classrooms list for the teacher dashboard uses only assigned classes
create or replace function app_can_record_in_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c
    join app_users me on me.user_id = auth.uid()
    where c.id = p_class
      and (
        me.role = 'classroom_staff' and c.teacher_id = me.user_id
        or me.role = 'school_admin' and c.institution_id = me.institution_id
        or me.role = 'super_admin'
      )
  );
$$;

-- serving write policy now gates on class ASSIGNMENT + eligible status
drop policy if exists serving_records_insert on serving_records;
drop policy if exists serving_records_update on serving_records;

create policy serving_records_insert on serving_records for insert
  with check (
    serving_date = current_date
    and app_can_record_for_student(student_id)
    and app_can_record_in_class(class_id)
  );

create policy serving_records_update on serving_records for update
  using (serving_date = current_date and app_can_record_for_student(student_id) and app_can_record_in_class(class_id))
  with check (serving_date = current_date and app_can_record_for_student(student_id) and app_can_record_in_class(class_id));

-- (c) menu detail RLS on notes unchanged; menus select remains any authenticated user.