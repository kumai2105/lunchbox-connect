-- 0004: Row Level Security -----------------------------------------------------
-- Every boundary is enforced in the database, not the app. Policies reuse the
-- SECURITY DEFINER helpers from 0003. E2E acceptance tests AT-030 / AT-031
-- (tests/e2e + tests/sql/notes_safety.sql) prove these boundaries live.

alter table institutions enable row level security;
alter table app_users enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table student_parents enable row level security;
alter table eligibility enable row level security;
alter table menus enable row level security;
alter table serving_records enable row level security;
alter table serving_notes enable row level security;
alter table messages enable row level security;

-- institutions ---------------------------------------------------------------
create policy institutions_select on institutions for select
  using (app_can_see_institution(id));
create policy institutions_write on institutions for all
  using (app_is_super_admin()) with check (app_is_super_admin());

-- app_users ------------------------------------------------------------------
create policy app_users_select on app_users for select
  using (app_can_see_user(user_id));
create policy app_users_insert on app_users for insert
  with check (app_is_super_admin());
create policy app_users_update on app_users for update
  using (user_id = auth.uid() or app_is_super_admin());
create policy app_users_delete on app_users for delete
  using (app_is_super_admin());

-- classes --------------------------------------------------------------------
create policy classes_select on classes for select
  using (app_can_see_class(id));
create policy classes_write on classes for all
  using (app_can_manage_class(id)) with check (app_can_manage_class(id));

-- students -------------------------------------------------------------------
create policy students_select on students for select
  using (app_can_see_student(id));
create policy students_insert on students for insert
  with check (app_can_manage_institution(institution_id));
create policy students_update on students for update
  using (app_can_manage_student(id)) with check (app_can_manage_student(id));
create policy students_delete on students for delete
  using (app_can_manage_student(id));

-- student_parents ------------------------------------------------------------
create policy student_parents_select on student_parents for select
  using (user_id = auth.uid() or app_can_see_student(student_id));
create policy student_parents_insert on student_parents for insert
  with check (app_can_manage_student(student_id));
create policy student_parents_delete on student_parents for delete
  using (app_can_manage_student(student_id));

-- eligibility ----------------------------------------------------------------
create policy eligibility_select on eligibility for select
  using (app_can_see_student(student_id));
create policy eligibility_write on eligibility for all
  using (app_can_manage_student(student_id)) with check (app_can_manage_student(student_id));

-- menus (central 4-week menu: super admin edits, everyone authenticated reads)
create policy menus_select on menus for select
  using (exists (select 1 from app_users au where au.user_id = auth.uid()));
create policy menus_write on menus for all
  using (app_is_super_admin()) with check (app_is_super_admin());

-- serving_records ------------------------------------------------------------
create policy serving_records_select on serving_records for select
  using (app_can_see_student(student_id));
create policy serving_records_insert on serving_records for insert
  with check (app_can_record_for_student(student_id) and serving_date = current_date);
create policy serving_records_update on serving_records for update
  using (app_can_record_for_student(student_id) and serving_date = current_date)
  with check (app_can_record_for_student(student_id) and serving_date = current_date);
create policy serving_records_delete on serving_records for delete
  using (app_is_super_admin());

-- serving_notes: families see only PUBLISHED notes; staff see and write all
create policy serving_notes_select on serving_notes for select
  using (
    exists (
      select 1 from serving_records sr
      where sr.id = serving_record_id and app_can_see_student(sr.student_id)
    )
    and (published_at is not null or app_is_staff() or app_is_super_admin())
  );
create policy serving_notes_insert on serving_notes for insert
  with check (
    exists (
      select 1 from serving_records sr
      where sr.id = serving_record_id and app_can_record_for_student(sr.student_id)
    )
  );
create policy serving_notes_update on serving_notes for update
  using (
    exists (
      select 1 from serving_records sr
      where sr.id = serving_record_id and app_can_record_for_student(sr.student_id)
    )
  );
create policy serving_notes_delete on serving_notes for delete
  using (app_is_super_admin());

-- messages: parent -> institution staff inbox
create policy messages_select on messages for select
  using (
    from_user = auth.uid()
    or app_is_super_admin()
    or (app_is_staff() and app_can_see_institution(to_institution_id))
  );
create policy messages_insert on messages for insert
  with check (
    app_is_parent()
    and from_user = auth.uid()
    and exists (
      select 1 from students s
      join student_parents sp on sp.student_id = s.id
      where s.id = student_id
        and s.institution_id = to_institution_id
        and sp.user_id = auth.uid()
    )
  );
create policy messages_update on messages for update
  using (app_is_staff() and app_can_see_institution(to_institution_id))
  with check (app_is_staff() and app_can_see_institution(to_institution_id));
create policy messages_delete on messages for delete
  using (app_is_super_admin());

-- revoke anything granted by default on these tables from anon
revoke all on institutions, app_users, classes, students, student_parents,
        eligibility, menus, serving_records, serving_notes, messages
  from anon;