-- =====================================================================
-- 0046 — an archived Institution gains no people either
--
-- 0044 said an archived Institution "takes nothing new" and enforced it with
-- triggers on classes, students, meal_services, institution_service_plans,
-- institution_rotation_assignments and calendar_exceptions.
--
-- app_users was not among them, and it is the one write that does not go
-- through RLS at all: accounts are created by the admin-create-user Edge
-- Function under the SERVICE ROLE, which bypasses every policy in the project.
-- So a Super Admin could pick an archived Institution on the Staff screen and
-- successfully provision a Nursery Admin or Classroom Staff account into it —
-- a live sign-in, scoped to a customer relationship that is not operating.
--
-- Nothing else in the schema would have caught it. RLS could not, because the
-- writer bypasses RLS; the UI could have hidden the option, but hiding an
-- archived record in the interface is not archiving it, which is the whole
-- argument of 0044.
--
-- A TRIGGER holds for every caller, service role included. That is why this is
-- a trigger and not a policy.
--
-- WHAT IT DELIBERATELY DOES NOT BLOCK
--
--   * Anything about an account that ALREADY belongs to the institution.
--     Deactivating them, reactivating them, correcting their name — all still
--     work, and must: an archived Institution's staff are exactly the people
--     an administrator is most likely to need to tidy up afterwards.
--   * Removing somebody FROM the archived institution (institution_id -> NULL,
--     or -> an active institution). Moving out is not moving in.
--
-- It blocks one thing: pointing an account AT an institution that is not
-- operating.
-- =====================================================================

create or replace function app_guard_active_institution_for_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only when the account is being pointed at an institution it was not
  -- pointed at before. An UPDATE that leaves institution_id alone is none of
  -- this trigger's business.
  if new.institution_id is not null
     and (tg_op = 'INSERT' or new.institution_id is distinct from old.institution_id)
     and not app_institution_is_active(new.institution_id) then
    raise exception
      'That institution is archived and cannot take on staff. Reactivate it first.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_app_users_archived_institution on app_users;
create trigger trg_app_users_archived_institution
  before insert or update on app_users
  for each row execute function app_guard_active_institution_for_account();

comment on function app_guard_active_institution_for_account() is
  'An archived Institution takes on no new people. Enforced as a TRIGGER rather '
  'than a policy because accounts are written by the admin-create-user Edge '
  'Function under the service role, which bypasses RLS entirely.';
