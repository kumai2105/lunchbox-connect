-- 0008: role model alignment (STEP 1 of 2 — add enum values only) --------------
-- Correction to match docs/02_ROLES_AND_PERMISSIONS.md + docs/11 (§7):
-- NINE approved role domains. Teacher and Nurse are ONE domain
-- (classroom_staff); the four previously-missing domains are added here.
--
-- IMPORTANT (Postgres rule): a newly added enum value cannot be USED in the same
-- transaction that adds it. This migration therefore ONLY adds the values. The
-- data merge that USES 'classroom_staff' lives in 0038 (a separate migration =
-- separate transaction), which is the supported pattern.
--
-- Also note: Postgres has NO "ALTER TYPE ... DROP VALUE". The old 'teacher' and
-- 'nurse' values cannot be removed; they simply stop being used after 0038.

alter type app_role add value if not exists 'operations_manager';
alter type app_role add value if not exists 'finance_owner';
alter type app_role add value if not exists 'viewer';
alter type app_role add value if not exists 'kitchen';
alter type app_role add value if not exists 'driver';
alter type app_role add value if not exists 'classroom_staff';

comment on type app_role is
  'Nine approved role domains (docs/02, docs/11 §7). Legacy values teacher/nurse '
  'remain in the enum (Postgres cannot drop enum values) but are unused after '
  '0038, which merges them into classroom_staff. Operations Manager scope, '
  'Viewer scope and several field-level permissions remain NOT_YET_DEFINED.';
