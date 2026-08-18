-- seed.sql — run manually in the Supabase SQL editor, AFTER migrations.
-- Creates demo reference data matching the mockup. It does NOT create auth
-- users (Supabase cannot create them from the SQL editor); you create accounts
-- in-app once a super admin exists. See docs/BUILD_STATUS.md -> "Bootstrap".
--
-- Step 1: create your first auth user in Dashboard -> Authentication -> Users,
--          note their user UUID, then run the FIRST ADMIN block below.
-- Step 2: create parent accounts in-app, capture their user_ids, set
--          :parent_a and :parent_b below, then run the PARENTS block.

begin;

-- ---- FIRST ADMIN (run once, replace the uuid) -------------------------------
-- insert into app_users (user_id, role, full_name, email)
-- values ('00000000-0000-0000-0000-000000000000', 'super_admin', 'Kal Dash', 'admin@example.com');
-- After this, create all other accounts in-app via the Users screen.

-- ---- Institutions -----------------------------------------------------------
insert into institutions (name, kind) values
  ('Maple Grove Primary', 'school'),
  ('Riverside Nursery',   'nursery'),
  ('St. Mary School',     'school'),
  ('Willow Creek',        'school'),
  ('Harbor Montessori',   'other');

-- ---- Classes (Maple Grove) --------------------------------------------------
with mg as (select id from institutions where name = 'Maple Grove Primary')
insert into classes (institution_id, name, grade)
select id, '1-A', '1' from mg
union all select id, '5-A', '5' from mg;

-- ---- Students ----------------------------------------------------------------
with mg as (select id from institutions where name = 'Maple Grove Primary'),
     c1 as (select c.id from classes c where c.name = '1-A')
insert into students (student_no, institution_id, given_name, family_name, class_id, grade, enrollment_status)
select 'LBS-1001', (select id from mg), 'Emma',   'Clarke', c1.id, '1', 'enrolled' from c1;

-- ---- A full week of menu (Week 26 = the grid) --------------------------------
-- INSERT each period; example Monday breakfast/lunch:
insert into menus (week_number, weekday, period, dish_name) values
  (26, 0, 'breakfast', 'Oatmeal & berries'),
  (26, 0, 'lunch',     'Chicken wrap · slaw · apple');

-- ---- Parent links (replace :parent_uuid once the account exists) ------------
-- insert into student_parents (student_id, user_id)
-- select s.id, :parent_uuid::uuid
-- from students s where s.student_no = 'LBS-100008';