-- =====================================================================
-- 0017 — Backfill the legacy `menus` table onto the Decision 033 chain,
--        and fix the rotation-advance defect it was built on.
--
-- WHY
--   `menus` is keyed by (week_number, weekday, period) with a single
--   global week number, and the client derived that number with a
--   function that divided by 7 twice. The week number therefore advanced
--   once every SEVEN calendar weeks, so each planned menu week stayed
--   live for seven real weeks and the "4-week menu" actually spanned 28.
--   Serving records were also linked to whatever dish sat at that wrong
--   number, so meal analytics attributed observations to the wrong meal.
--
--   Fixing the client function alone would have moved the current week
--   from 6 to 34, where no menu rows exist, blanking the Kitchen and
--   Parent screens. The defect is in the ADDRESSING SCHEME, not the
--   arithmetic: a single global calendar-week number cannot express a
--   per-institution rotation. Decision 033 already replaced it with
--   rotation position, which resolve_rotation_week() computes from whole
--   weeks elapsed since an anchor and which is covered by live tests.
--
--   So this migration moves the data rather than patching the number.
--   Nothing is deleted: `menus` is left intact and read-only for
--   reference until the next release removes it.
--
-- IDEMPOTENT: safe to re-run. Guarded on the fixed rotation UUID.
-- =====================================================================

create or replace function backfill_legacy_menus()
returns table (meals_created int, slots_created int, institutions_mapped int)
language plpgsql security definer set search_path = public as $fn$
declare
  v_weeks int;
begin
  -- Defence in depth. EXECUTE is revoked from anon and authenticated below,
  -- but this function is SECURITY DEFINER and rewrites rotations, service
  -- plans and institution assignments for EVERY institution. If a future
  -- migration re-grants EXECUTE (Supabase's default privileges on this schema
  -- grant it automatically at creation time, which is exactly how it was
  -- exposed in the first place), a Parent or Driver must still be refused
  -- here rather than silently handed the ability to rewrite every schedule.
  -- auth.uid() is null in the migration and service contexts that legitimately
  -- run this.
  if auth.uid() is not null and not app_is_super_admin() then
    raise exception 'backfill_legacy_menus() is a migration routine, not a callable API';
  end if;
  -- The legacy menu becomes ONE shared rotation. Every institution was
  -- already reading the same global menu, so a single shared rotation
  -- preserves exactly the behaviour that existed - only advancing weekly
  -- instead of every seventh week.
  --
  -- Its length is taken from the data, never assumed to be 4. An earlier
  -- draft hard-coded 4 and mapped legacy week numbers with `% 4`, which
  -- silently DROPPED menu weeks: with 7 distinct week numbers, positions
  -- 1-3 collided and `on conflict do nothing` kept whichever row arrived
  -- first. Losing a planned week of meals is data loss, not a rounding
  -- detail, and §30 requires rotation length to be data-driven anyway.
  select greatest(count(distinct week_number), 1)::int into v_weeks from menus;

  insert into rotations (id, name, week_count)
  values ('00000000-0000-4000-8000-000000000171'::uuid, 'Legacy menu', v_weeks)
  on conflict (id) do update set week_count = excluded.week_count;

  -- One Meal per distinct dish. Dishes are matched by name because that is
  -- the only identity the legacy table ever had.
  insert into meals (name)
  select distinct m.dish_name
  from menus m
  where not exists (select 1 from meals x where x.name = m.dish_name);

  -- Revision 1 carries whatever the legacy row recorded. nutrition_status
  -- stays NOT_APPROVED unless the legacy row said otherwise: approval is a
  -- governance act and must not be invented by a data migration.
  insert into meal_revisions (meal_id, revision_no, name, ingredients, allergens,
                              nutrition, portion, nutrition_status)
  select distinct on (mm.id)
         mm.id, 1, mm.name,
         coalesce(src.ingredients, '[]'::jsonb),
         coalesce(src.allergens, '[]'::jsonb),
         coalesce(src.nutrition, '{}'::jsonb),
         src.portion,
         coalesce(src.source_status, 'NOT_APPROVED')
  from meals mm
  join menus src on src.dish_name = mm.name
  where not exists (select 1 from meal_revisions r where r.meal_id = mm.id)
  order by mm.id, src.updated_at desc;

  update meals m
     set current_revision_id = r.id
    from meal_revisions r
   where r.meal_id = m.id
     and r.revision_no = 1
     and m.current_revision_id is null;

  -- Legacy week numbers are dense-ranked into rotation positions in
  -- ascending order, so the admin's planning order is preserved. No
  -- modulo: the rotation was sized above to hold every distinct week, so
  -- every position is unique and nothing collides.
  with ranked as (
    select week_number,
           (dense_rank() over (order by week_number))::int as rot_week
    from (select distinct week_number from menus) w
  )
  insert into rotation_slots (rotation_id, week_number, weekday, period, meal_id)
  select '00000000-0000-4000-8000-000000000171'::uuid, r.rot_week, mn.weekday, mn.period, mm.id
  from menus mn
  join ranked r on r.week_number = mn.week_number
  join meals mm on mm.name = mn.dish_name
  on conflict (rotation_id, week_number, weekday, period) do nothing;

  -- Anchor every institution to the same Monday at rotation week 1, so the
  -- shared rotation stays in step across institutions exactly as the single
  -- global menu did. 2026-01-05 is a Monday.
  insert into institution_rotation_assignments (institution_id, rotation_id, effective_from, anchor_week)
  select i.id, '00000000-0000-4000-8000-000000000171'::uuid, date '2026-01-05', 1
  from institutions i
  where not exists (
    select 1 from institution_rotation_assignments a where a.institution_id = i.id
  );

  -- Service plans are derived from the periods each institution's rotation
  -- actually carries, NOT assumed to be all four. An institution that never
  -- had an afternoon snack must not acquire one from a migration.
  insert into institution_service_plans (institution_id, periods, effective_from)
  select i.id,
         coalesce(
           (select array_agg(distinct mn.period order by mn.period) from menus mn),
           array['breakfast','snack','lunch']::app_period[]
         ),
         date '2026-01-05'
  from institutions i
  where not exists (
    select 1 from institution_service_plans p where p.institution_id = i.id
  );

  meals_created := (select count(*)::int from meals);
  slots_created := (select count(*)::int from rotation_slots
                     where rotation_id = '00000000-0000-4000-8000-000000000171'::uuid);
  institutions_mapped := (select count(*)::int from institution_rotation_assignments);
  return next;
end $fn$;

-- Supabase's `alter default privileges ... grant all on functions` fires at
-- CREATE time, so this function was executable by anon and authenticated the
-- moment it existed. Revoke explicitly; the guard above is the second layer.
revoke all on function backfill_legacy_menus() from public;
revoke all on function backfill_legacy_menus() from anon, authenticated;

comment on function backfill_legacy_menus() is
  'Moves legacy `menus` rows onto the Decision 033 chain. Idempotent. Called '
  'once by migration 0017 and re-run by tests/sql/verify_menu_cutover.sql so '
  'the suite exercises the real migration logic rather than a copy of it.';

-- Run it once as part of this migration.
select * from backfill_legacy_menus();
