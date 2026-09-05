-- =====================================================================
-- 0037 — CLOSURE SWEEP: a meal image that a Meal Revision references is
--        historical truth, and must not be deleted or overwritten.
--
-- WHAT WAS PROVEN BROKEN
-- ---------------------
-- Migration 0024 created
--
--     create policy meal_images_admin_all on storage.objects for all
--       using (bucket_id = 'meal-images' and app_is_super_admin())
--       with check (bucket_id = 'meal-images' and app_is_super_admin());
--
-- `for all` includes DELETE and UPDATE. A Super Admin acting at the raw
-- storage boundary could therefore delete the object that a HISTORICAL
-- `meal_revisions.image_path` still points at, leaving every past published
-- Meal Service — and every Parent looking at what their child was actually
-- served last term — pointing at an image that no longer exists. Reproduced
-- before this migration was written: the DELETE removed 1 row while the
-- revision kept the reference.
--
-- The same policy also allowed an UPDATE, i.e. `upload(path, { upsert: true })`
-- over an existing path: the historical revision keeps its reference but the
-- picture behind it silently becomes a different meal. That is a quieter and
-- worse failure than a missing file, because nothing looks broken.
--
-- Meal Revisions are already immutable by design (a save produces a NEW
-- revision; 0024). This migration extends that same rule to the bytes the
-- revision points at.
--
-- WHAT THIS DOES NOT DO
-- --------------------
-- It does not forbid cleaning up an image that no revision references — an
-- upload abandoned before the meal was saved is not history, and the Super
-- Admin may still remove it. Retention/deletion policy for referenced images
-- remains NOT_YET_DEFINED and is deliberately NOT invented here: the safe
-- default is "history is kept".
--
-- The `student-photos` bucket is deliberately unchanged. A student photo is
-- current identity, not an immutable record of a past event: replacing it
-- falsifies nothing, and `students.photo_path` is a live pointer rather than a
-- historical one. Nothing was proven wrong there, so nothing was changed.
-- =====================================================================

-- The guard has to read `meal_revisions`, but storage policies execute as the
-- CALLER (`authenticated`) and `meal_revisions` is itself RLS-protected. A bare
-- `not exists (select 1 from meal_revisions …)` would therefore be satisfied by
-- rows the caller merely cannot SEE, turning the guard into a no-op. Resolve
-- the reference through a SECURITY DEFINER helper, which sees every revision
-- regardless of who is asking.
create or replace function app_meal_image_is_historical(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from meal_revisions mr where mr.image_path = p_name);
$$;

revoke all on function app_meal_image_is_historical(text) from public;
grant execute on function app_meal_image_is_historical(text) to authenticated, service_role;

comment on function app_meal_image_is_historical(text) is
  'True when a meal-image storage object is referenced by any meal_revisions.image_path, '
  'i.e. it is part of the historical record and may no longer be overwritten or deleted. '
  'SECURITY DEFINER so the storage policy sees every revision, not only the caller''s.';

drop policy if exists meal_images_admin_all on storage.objects;

-- INSERT: unchanged authority — only the Super Admin puts meal images in.
drop policy if exists meal_images_admin_insert on storage.objects;
create policy meal_images_admin_insert on storage.objects for insert
  with check (bucket_id = 'meal-images' and app_is_super_admin());

-- UPDATE: allowed only while the object is NOT referenced by any Meal
-- Revision. Both `using` (the row as it stands) and `with check` (the row
-- afterwards) are guarded, so an update cannot rename an object onto a
-- historical path either.
drop policy if exists meal_images_admin_update on storage.objects;
create policy meal_images_admin_update on storage.objects for update
  using (
    bucket_id = 'meal-images'
    and app_is_super_admin()
    and not app_meal_image_is_historical(storage.objects.name)
  )
  with check (
    bucket_id = 'meal-images'
    and app_is_super_admin()
    and not app_meal_image_is_historical(storage.objects.name)
  );

-- DELETE: same rule. An unreferenced upload is disposable; a referenced one is
-- the record of what a child was served.
drop policy if exists meal_images_admin_delete on storage.objects;
create policy meal_images_admin_delete on storage.objects for delete
  using (
    bucket_id = 'meal-images'
    and app_is_super_admin()
    and not app_meal_image_is_historical(storage.objects.name)
  );
