-- 0040: creating a Class or a Student was impossible through the software ------
--
-- REPRODUCED FAILURE
-- ------------------
-- A Super Admin creating a Class in the UI got a 403 from PostgREST:
--
--   {"code":"42501","message":"new row violates row-level security policy
--     for table \"classes\""}
--
-- and no row was written. Reproduced on a clean rebuild of all 39 migrations:
--
--   INSERT INTO classes (institution_id, name) VALUES (...);            -> ok
--   INSERT INTO classes (institution_id, name) VALUES (...) RETURNING *; -> 42501
--
-- The difference is RETURNING. For INSERT ... RETURNING, PostgreSQL applies the
-- table's SELECT policy to the new row as well as the INSERT WITH CHECK, and
--
--   classes_select  USING (app_can_see_class(id))
--
-- is written as
--
--   select exists (select 1 from classes c where c.id = p_class and (...))
--
-- which RE-READS classes by the id it was handed. During the INSERT that row is
-- not yet visible to the function's snapshot, so `exists` is false, the SELECT
-- check fails, and the whole statement is rolled back.
--
-- This is the SAME self-referencing-policy defect 0015 fixed for the INSERT
-- side ("during an INSERT the new row isn't visible to that self-referencing
-- subquery yet, so the check can never pass"). 0015 fixed the WITH CHECK and
-- left the USING side alone, because nothing had ever issued
-- INSERT ... RETURNING against these tables. The client does exactly that:
--
--   src/lib/api.ts createClass()   -> .insert(input).select().single()
--   src/lib/api.ts createStudent() -> .insert(input).select().single()
--
-- USER IMPACT, verified by direct reproduction against the rebuilt schema:
--   * NO role can create a Class through the software — Super Admin included.
--   * A Nursery Admin (school_admin) cannot create a Student. A Super Admin
--     can, only because app_can_see_student() short-circuits on the
--     super_admin branch before it reaches the students subquery.
--
-- THE CORRECTION
-- --------------
-- Express the SAME rule against the row under test instead of re-fetching it.
-- A policy expression already has the candidate row; asking the database to go
-- and find it again is what breaks, and it is unnecessary in every case.
--
-- The two policies below are byte-for-byte the same predicate as the functions
-- they replace, with `... from classes c where c.id = p_class and (X)` reduced
-- to `X` over the row's own columns. NO ONE gains or loses visibility of any
-- existing row: verify_rls_cross_portal and verify_authorization_matrix assert
-- the whole cross-portal matrix and are unchanged.
--
-- app_can_see_class() and app_can_see_student() are deliberately NOT modified.
-- They are correct for their other callers — serving_records_select,
-- student_parents_select and serving_notes_select pass a DIFFERENT row's id,
-- which is always already visible — and rewriting them would change code that
-- has no reproduced fault.
--
-- app_users_select carries the same self-referencing shape via
-- app_can_see_user(). It is left alone: nothing in the client inserts into
-- app_users (accounts are provisioned by the admin-create-user Edge Function
-- under the service role, which bypasses RLS), so there is no reproduced
-- failure to fix. Recorded in docs/OPEN_FINDINGS.md.

-- WHY THE PREDICATE STAYS INSIDE A SECURITY DEFINER FUNCTION
-- ----------------------------------------------------------
-- The first attempt inlined the whole rule into the policy body. That
-- deadlocked the schema:
--
--   ERROR:  infinite recursion detected in policy for relation "class_staff"
--
-- classes_select needs class_staff to answer the classroom-staff branch, and
-- class_staff_select needs classes to answer its own. Reading either table
-- straight from a policy expression re-enters the other's policy and the pair
-- never terminates. The original design avoided this precisely BECAUSE the
-- lookup sat in a SECURITY DEFINER function: such a function runs as the
-- table owner, which is not subject to RLS, so the cycle is cut.
--
-- So the correction keeps the definer indirection and removes only the part
-- that was actually broken — the outer `select 1 from <self> where id = $1`.
-- The row's own columns are passed IN as arguments instead of being fetched,
-- which is the one thing a not-yet-visible row can still supply.

-- classes ---------------------------------------------------------------------
-- Identical to app_can_see_class() with the outer self-read removed: the id and
-- the institution arrive as arguments rather than being looked up.
create or replace function app_can_see_class_row(p_class_id uuid, p_institution_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    app_is_super_admin()
    or (app_current_role() = 'school_admin' and app_can_manage_institution(p_institution_id))
    or (app_current_role() = 'classroom_staff'
        and exists (select 1 from class_staff cs
                     where cs.class_id = p_class_id and cs.user_id = auth.uid()))
    or (app_current_role() = 'parent' and exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.class_id = p_class_id and sp.user_id = auth.uid()
        ));
$$;

drop policy if exists classes_select on classes;
create policy classes_select on classes for select
  using (app_can_see_class_row(classes.id, classes.institution_id));

-- students --------------------------------------------------------------------
-- Identical to app_can_see_student() with the outer self-read removed: the
-- student's institution and class arrive as arguments.
create or replace function app_can_see_student_row(
  p_student_id uuid, p_institution_id uuid, p_class_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_users me
    where me.user_id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role = 'school_admin' and p_institution_id = me.institution_id)
        or (me.role = 'classroom_staff'
            and p_institution_id = me.institution_id
            and exists (select 1 from class_staff cs
                         where cs.class_id = p_class_id and cs.user_id = me.user_id))
        or (me.role = 'parent'
            and exists (select 1 from student_parents sp
                         where sp.student_id = p_student_id and sp.user_id = me.user_id))
      )
  );
$$;

drop policy if exists students_select on students;
create policy students_select on students for select
  using (app_can_see_student_row(students.id, students.institution_id, students.class_id));

revoke all on function app_can_see_class_row(uuid, uuid) from anon;
revoke all on function app_can_see_student_row(uuid, uuid, uuid) from anon;

comment on table classes is
  'Class roster unit. classes_select tests the row it was handed rather than '
  're-reading it by id, so INSERT ... RETURNING — the statement the client '
  'issues to create a Class — can pass the SELECT check. See 0040.';
