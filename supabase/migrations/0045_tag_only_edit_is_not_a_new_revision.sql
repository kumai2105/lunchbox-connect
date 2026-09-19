-- =====================================================================
-- 0045 — changing which sittings a Meal suits is not a new Meal revision
--
-- THE CONTRADICTION
-- 0043 says, in its own header, that meal_periods is present-tense metadata
-- about a Meal and NOT historical revision content. But save_meal appends a
-- revision on every call, so ticking "Afternoon snack" on an existing dish
-- created a new immutable content revision identical to the one before it.
--
-- Revisions exist so that what a child was served in January stays January's
-- truth after the recipe improves in March (Decision 033). A revision whose
-- content is byte-identical to its predecessor records nothing, inflates the
-- revision history a Super Admin reads, and — because analytics can be read
-- per revision — splits one dish's figures across revisions that never
-- differed.
--
-- THE RULE
-- A save that changes revision-bearing content appends a revision, exactly as
-- before. A save that changes ONLY the period tags updates the tags and stops.
-- Both still happen in one transaction, so a partial save remains impossible.
--
-- 0043 is applied and is not edited. This supersedes save_meal in place.
-- =====================================================================

create or replace function save_meal(
  p_meal_id      uuid,
  p_name         text,
  p_ingredients  jsonb,
  p_allergens    jsonb,
  p_nutrition    jsonb,
  p_portion      text,
  p_image_path   text,
  p_nutrition_status text default 'NOT_APPROVED',
  p_periods      app_period[] default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_meal uuid;
  v_next int;
  v_cur  meal_revisions%rowtype;
  v_content_changed boolean := true;
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

    -- Archived authoring records are not editable until deliberately restored
    -- (approved Meal/Menu archive semantics): archive retires a dish from NEW
    -- authoring, and editing one in place would be authoring.
    if not exists (select 1 from meals m where m.id = v_meal) then
      raise exception 'Meal % not found', p_meal_id;
    end if;
    if not (select m.active from meals m where m.id = v_meal) then
      raise exception 'This meal is archived. Restore it before editing.';
    end if;

    update meals set name = p_name, updated_at = now() where id = v_meal;
    select coalesce(max(revision_no),0) + 1 into v_next from meal_revisions where meal_id = v_meal;

    -- Compare against the revision currently in force. Everything a revision
    -- carries is compared; the name lives on both the meal and the revision,
    -- so it counts as content.
    select r.* into v_cur from meal_revisions r
      join meals m on m.current_revision_id = r.id
     where m.id = v_meal;

    if v_cur.id is not null then
      v_content_changed :=
           v_cur.name             is distinct from p_name
        or v_cur.ingredients      is distinct from coalesce(p_ingredients,'[]'::jsonb)
        or v_cur.allergens        is distinct from coalesce(p_allergens,'[]'::jsonb)
        or v_cur.nutrition        is distinct from coalesce(p_nutrition,'{}'::jsonb)
        or v_cur.portion          is distinct from p_portion
        or v_cur.image_path       is distinct from p_image_path
        or v_cur.nutrition_status is distinct from coalesce(p_nutrition_status,'NOT_APPROVED');
    end if;
  end if;

  if v_content_changed then
    insert into meal_revisions (meal_id, revision_no, name, ingredients, allergens,
                                nutrition, portion, image_path, nutrition_status, created_by)
    values (v_meal, v_next, p_name,
            coalesce(p_ingredients,'[]'::jsonb), coalesce(p_allergens,'[]'::jsonb),
            coalesce(p_nutrition,'{}'::jsonb), p_portion, p_image_path,
            coalesce(p_nutrition_status,'NOT_APPROVED'), auth.uid());

    update meals m set current_revision_id =
      (select id from meal_revisions where meal_id = v_meal and revision_no = v_next)
     where m.id = v_meal;
  end if;

  -- Tags are a set and are replaced, whether or not content moved.
  if p_periods is not null then
    delete from meal_periods where meal_id = v_meal and period <> all (p_periods);
    insert into meal_periods (meal_id, period)
      select v_meal, p from unnest(p_periods) as p
      on conflict do nothing;
  end if;

  return v_meal;
end $$;

revoke all on function save_meal(uuid,text,jsonb,jsonb,jsonb,text,text,text,app_period[])
  from public, anon;
grant execute on function save_meal(uuid,text,jsonb,jsonb,jsonb,text,text,text,app_period[])
  to authenticated;

-- ---------------------------------------------------------------------
-- Archived authoring records stay put until restored, for Menus too.
-- Archive means "retire from NEW assignment", never "cancel what is already
-- scheduled": existing rotation slots and institution assignments keep
-- referencing an archived record until someone deliberately replaces them, and
-- the resolver is not given `active` as a cancellation switch.
-- ---------------------------------------------------------------------
create or replace function app_guard_archived_authoring()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'rotation_slots' then
    if new.meal_id is not null
       and not coalesce((select m.active from meals m where m.id = new.meal_id), false) then
      raise exception 'That meal is archived and cannot be placed on a menu. Restore it first.'
        using errcode = 'check_violation';
    end if;
    if not coalesce((select r.active from rotations r where r.id = new.rotation_id), false) then
      raise exception 'That menu is archived. Restore it before editing its slots.'
        using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'institution_rotation_assignments' then
    if not coalesce((select r.active from rotations r where r.id = new.rotation_id), false) then
      raise exception 'That menu is archived and cannot be assigned to an institution. Restore it first.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_rotation_slots_archived on rotation_slots;
create trigger trg_rotation_slots_archived before insert or update on rotation_slots
  for each row execute function app_guard_archived_authoring();

drop trigger if exists trg_rotation_assign_archived on institution_rotation_assignments;
create trigger trg_rotation_assign_archived before insert or update on institution_rotation_assignments
  for each row execute function app_guard_archived_authoring();
