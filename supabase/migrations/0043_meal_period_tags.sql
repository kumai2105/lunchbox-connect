-- =====================================================================
-- 0043 — a Meal says which sittings it is for
--
-- THE PROBLEM
-- A Meal had no relationship to a Meal Period. The period existed only on
-- the rotation SLOT (rotation_slots.period), so the Meal Library held a flat
-- list of dishes with nothing saying what any of them was for. Filling the
-- Breakfast row in Menu Builder offered every dish ever created, lunches
-- included. The Founder's words: nothing should float in the software with
-- zero relation.
--
-- THE MODEL
-- A Meal carries one or more suitable periods. Not one — fruit is plausibly
-- Breakfast and Morning snack; soup is Lunch only. A join table rather than
-- an array column or a text field, for two reasons:
--
--   1. It points at the SAME app_period type the slots use, so a tag and a
--      slot can never drift into different vocabularies. A text column would
--      have allowed 'Breakfast', 'breakfast ' and 'brekkie'.
--   2. One Meal stays one Meal. Duplicating a dish to serve it at two
--      sittings would split its revision history, its image and its
--      consumption analytics across two rows that are really one thing.
--
-- WHAT THIS IS NOT
-- It is an authoring aid, not a safety control. The database does not refuse
-- a rotation slot whose meal lacks the matching tag, and this migration adds
-- no such constraint. Menu Builder filters by it and offers an explicit
-- override, because a real kitchen occasionally breaks its own pattern on
-- purpose. Allergens and nutrition remain the only content with clinical
-- weight, and neither is touched here.
-- =====================================================================

create table if not exists meal_periods (
  meal_id uuid not null references meals (id) on delete cascade,
  period app_period not null,
  primary key (meal_id, period)
);

-- Menu Builder's question is always "which meals suit THIS period", so the
-- index leads on period.
create index if not exists meal_periods_period_idx on meal_periods (period, meal_id);

alter table meal_periods enable row level security;

-- Read: anyone who may read the meal may read its tags. Deliberately not
-- `using (true)` — meals_select (0021) narrows Meal visibility for downstream
-- roles to meals that actually reached a published service they can see, and
-- the tags must not be a side channel that leaks the existence of a meal the
-- caller cannot otherwise see.
drop policy if exists meal_periods_select on meal_periods;
create policy meal_periods_select on meal_periods for select using (
  exists (select 1 from meals m where m.id = meal_periods.meal_id)
);

-- Write: Super Admin only, exactly as for meals themselves (0016
-- meals_write). Tagging is menu authorship, which belongs to the Super Admin.
drop policy if exists meal_periods_write on meal_periods;
create policy meal_periods_write on meal_periods for all
  using (app_is_super_admin()) with check (app_is_super_admin());

grant select on meal_periods to authenticated;
grant insert, update, delete on meal_periods to authenticated;
revoke all on meal_periods from anon;

-- ---------------------------------------------------------------------
-- Backfill. Existing meals carry no tags, and an untagged meal would vanish
-- from a filtered picker — the change would look like data loss.
--
-- Two rules, in order:
--
--   1. A meal already used in a rotation slot is tagged with the periods it
--      has actually been used in. That is evidence from the Founder's own
--      menus, not a guess.
--   2. A meal never used anywhere is tagged with all four periods, so it
--      stays visible everywhere until someone narrows it deliberately.
--
-- Both are idempotent, so re-running this migration cannot duplicate a tag.
-- ---------------------------------------------------------------------
insert into meal_periods (meal_id, period)
select distinct s.meal_id, s.period
from rotation_slots s
where s.meal_id is not null
on conflict do nothing;

insert into meal_periods (meal_id, period)
select m.id, p
from meals m
cross join unnest(array['breakfast', 'snack', 'lunch', 'afternoon_snack']::app_period[]) as p
where not exists (select 1 from meal_periods mp where mp.meal_id = m.id)
on conflict do nothing;

comment on table meal_periods is
  'Which Meal Periods a Meal is suitable for. Multi-select: one Meal may suit '
  'several sittings and is never duplicated to achieve that. An authoring aid '
  'for Menu Builder, not a constraint on what may be served.';

-- ---------------------------------------------------------------------
-- save_meal learns the tags.
--
-- Tagging goes through the SAME call that saves the meal, so a save cannot
-- half-succeed: a meal that gained a revision but lost its tags because a
-- second request failed would be a worse state than either outcome alone.
--
-- p_periods is NULL-defaulted and NULL means "leave the tags alone", so any
-- caller written against the old signature keeps working unchanged. An empty
-- array is a real instruction — it clears every tag — and is distinct from
-- NULL on purpose.
--
-- Adding a parameter changes the signature, so the old function is dropped by
-- its exact argument list rather than replaced.
-- ---------------------------------------------------------------------
drop function if exists save_meal(uuid,text,jsonb,jsonb,jsonb,text,text,text);

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

  -- Tags are a SET, not a history: the current answer replaces the previous
  -- one. Revisions stay append-only; this is deliberately different, because
  -- "which sittings does this dish suit" is a present-tense fact about the
  -- meal, not a snapshot of what was served.
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
