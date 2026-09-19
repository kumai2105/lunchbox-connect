-- 0001: extensions and enumerated domains -------------------------------------
-- Approved stack decision (A1-A3): PostgreSQL via Supabase, RLS everywhere.
-- The spec pack lists NINE roles but names only five. This enum encodes the
-- five approved roles; the remaining four are named in docs/BUILD_STATUS.md as
-- NOT_YET_DEFINED and can be added later with ALTER TYPE ... ADD VALUE.

create extension if not exists pgcrypto;

create type app_role as enum ('super_admin', 'school_admin', 'nurse', 'teacher', 'parent');
create type app_period as enum ('breakfast', 'lunch', 'snack');
create type meal_outcome as enum ('full', 'partial', 'refused', 'absent');
create type eligibility_status as enum ('free', 'reduced', 'paid', 'n/a');
create type review_status as enum ('pending_review', 'pending_doc', 'approved', 'rejected');
create type enrollment_status as enum ('enrolled', 'pending', 'withdrawn');

comment on type app_role is
  'Nine roles exist in the spec pack; these five are the approved, named set. See docs/BUILD_STATUS.md.';