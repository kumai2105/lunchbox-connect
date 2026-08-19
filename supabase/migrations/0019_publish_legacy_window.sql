-- =====================================================================
-- 0019 — Publish dated Meal Services so downstream screens have
--        something authoritative to read after the 0017 cutover.
--
-- WHY THIS IS NEEDED
--   0017 moved the legacy menu onto the rotation engine, but a rotation
--   is a TEMPLATE. Kitchen, Classroom and Parent must not read templates:
--   §109 requires downstream roles to see only published, dated Meal
--   Services, and 0018 revoked the resolver RPCs from client roles
--   precisely so nobody can resolve a template on the fly. Without this
--   migration the rewired screens would correctly show nothing at all.
--
-- WHY A WINDOW, AND ITS LIMIT
--   Publishing is a deliberate act, so this seeds a fixed window rather
--   than resolving forever. THE WINDOW RUNS OUT. Once the Rotation
--   Builder / Calendar admin screens exist, publishing becomes an admin
--   action through publish_meal_services(). Until then, re-run
--   `select publish_legacy_window(<from>, <to>);` as the database owner to
--   extend it. This is recorded as a known limitation rather than hidden
--   behind an auto-extending default.
--
-- Idempotent: publish_meal_services' conflict rule never rewrites a row
-- that is already published, so re-running cannot alter served history.
-- =====================================================================

create or replace function publish_legacy_window(p_from date, p_to date)
returns int
language plpgsql security definer set search_path = public as $fn$
declare
  v_inst uuid;
  d date;
  p app_period;
  r record;
  v_rev uuid;
  n int := 0;
begin
  -- Same guard as backfill_legacy_menus(). EXECUTE is revoked below, but
  -- this is SECURITY DEFINER and writes the schedule every downstream role
  -- reads, so a future re-grant must still refuse a non-super-admin.
  -- auth.uid() is null in the migration/service contexts that legitimately
  -- run this.
  if auth.uid() is not null and not app_is_super_admin() then
    raise exception 'publish_legacy_window() is an administrative routine';
  end if;

  if p_to < p_from then
    raise exception 'publish_legacy_window: end date % precedes start date %', p_to, p_from;
  end if;

  for v_inst in select id from institutions loop
    d := p_from;
    while d <= p_to loop
      foreach p in array array['breakfast','snack','lunch','afternoon_snack']::app_period[] loop
        select * into r from resolve_meal(v_inst, d, p);
        if r.meal_id is not null then
          select m.current_revision_id into v_rev from meals m where m.id = r.meal_id;
          if v_rev is not null then
            insert into meal_services (
              institution_id, service_date, period, meal_revision_id,
              source, rotation_id, published, published_at
            )
            values (v_inst, d, p, v_rev, r.source, r.rotation_id, true, now())
            -- An already-published row is NEVER rewritten. What a child was
            -- actually served is history, and re-running this must not
            -- retroactively change it (§28).
            on conflict (institution_id, service_date, period) do update
              set meal_revision_id = case
                    when meal_services.published then meal_services.meal_revision_id
                    else excluded.meal_revision_id end,
                  published = true,
                  published_at = coalesce(meal_services.published_at, now());
            n := n + 1;
          end if;
        end if;
      end loop;
      d := d + 1;
    end loop;
  end loop;
  return n;
end $fn$;

revoke all on function publish_legacy_window(date, date) from public;
revoke all on function publish_legacy_window(date, date) from anon, authenticated;

comment on function publish_legacy_window(date, date) is
  'Seeds published Meal Services from the rotation for a date window. '
  'Administrative: revoked from anon/authenticated and guarded in-body. '
  'The window is finite and must be extended until the Calendar admin '
  'screen exists.';

-- Seed a wide window around the cutover so no screen is blank on day one.
select publish_legacy_window(current_date - 60, current_date + 300);
