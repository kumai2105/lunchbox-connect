-- =====================================================================
-- 0024 — Meal Library management RPCs + image bucket (correction order §4).
--
-- Lets Super Admin create/edit meals THROUGH THE SOFTWARE. Editing a meal
-- appends a new immutable revision (revisions stay append-only) and moves the
-- meal's current pointer; it never rewrites history, so a meal a child ate six
-- months ago keeps the exact revision it was served (§13). Archiving flips
-- meals.active and never deletes — historical references survive (§49).
-- =====================================================================

-- Atomic create/edit. Returns the meal id. p_meal_id null = create.
create or replace function save_meal(
  p_meal_id      uuid,
  p_name         text,
  p_ingredients  jsonb,
  p_allergens    jsonb,
  p_nutrition    jsonb,
  p_portion      text,
  p_image_path   text,
  p_nutrition_status text default 'NOT_APPROVED'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_meal uuid; v_next int;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may manage the Meal Library';
  end if;
  if coalesce(btrim(p_name),'') = '' then
    raise exception 'Meal name is required';
  end if;

  if p_meal_id is null then
    insert into meals (name, active, created_by) values (p_name, true, auth.uid())
      returning id into v_meal;
    v_next := 1;
  else
    v_meal := p_meal_id;
    update meals set name = p_name, updated_at = now() where id = v_meal;
    if not found then raise exception 'Meal % not found', p_meal_id; end if;
    select coalesce(max(revision_no),0) + 1 into v_next from meal_revisions where meal_id = v_meal;
  end if;

  insert into meal_revisions (meal_id, revision_no, name, ingredients, allergens,
                              nutrition, portion, image_path, nutrition_status, created_by)
  values (v_meal, v_next, p_name,
          coalesce(p_ingredients,'[]'::jsonb), coalesce(p_allergens,'[]'::jsonb),
          coalesce(p_nutrition,'{}'::jsonb), p_portion, p_image_path,
          coalesce(p_nutrition_status,'NOT_APPROVED'), auth.uid());

  update meals m set current_revision_id =
    (select id from meal_revisions where meal_id = v_meal and revision_no = v_next)
   where m.id = v_meal;

  return v_meal;
end $$;

create or replace function set_meal_active(p_meal_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may archive or activate a meal';
  end if;
  update meals set active = p_active, updated_at = now() where id = p_meal_id;
  if not found then raise exception 'Meal % not found', p_meal_id; end if;
end $$;

revoke all on function save_meal(uuid,text,jsonb,jsonb,jsonb,text,text,text) from public, anon;
grant execute on function save_meal(uuid,text,jsonb,jsonb,jsonb,text,text,text) to authenticated;
revoke all on function set_meal_active(uuid,boolean) from public, anon;
grant execute on function set_meal_active(uuid,boolean) to authenticated;

-- Private bucket for meal images. Only Super Admin writes; the image is shown
-- to downstream roles via short-lived signed URLs generated server/client-side
-- (the row-level meal visibility already governs who may request one).
insert into storage.buckets (id, name, public)
values ('meal-images','meal-images', false)
on conflict (id) do nothing;

drop policy if exists meal_images_admin_all on storage.objects;
create policy meal_images_admin_all on storage.objects for all
  using (bucket_id = 'meal-images' and app_is_super_admin())
  with check (bucket_id = 'meal-images' and app_is_super_admin());

-- Authenticated users may READ meal images (needed for Kitchen/Classroom/Parent
-- meal detail); the meal itself is already RLS-scoped, and the bucket is private
-- so only signed URLs work.
drop policy if exists meal_images_read on storage.objects;
create policy meal_images_read on storage.objects for select
  using (bucket_id = 'meal-images' and auth.uid() is not null);
