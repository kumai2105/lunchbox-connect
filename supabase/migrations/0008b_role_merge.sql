-- 0008b: role model alignment (STEP 2 of 2 — data merge + constraint) ----------
-- Runs AFTER 0008 committed, so 'classroom_staff' is now usable.

-- Merge the two legacy classroom roles into the single approved domain.
update app_users set role = 'classroom_staff' where role in ('teacher', 'nurse');

-- Reconcile the institution-scope constraint to the final role names. Classroom
-- staff are institution-anchored (scoped to assigned classes within their
-- institution — docs/02 §43), so they require institution_id, same as school_admin.
alter table app_users drop constraint if exists app_users_staff_needs_institution;
alter table app_users
  add constraint app_users_staff_needs_institution
  check (role not in ('school_admin', 'classroom_staff') or institution_id is not null);
