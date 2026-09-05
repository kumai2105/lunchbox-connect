-- =====================================================================
-- 0022 — Fix special-period / camp rotation week resolution (order §37).
--
-- The special_period branch of resolve_meal() selected the slot by weekday
-- and period only, with `limit 1`. For a MULTI-WEEK camp/special rotation,
-- every week's <weekday, period> slot matched and an arbitrary one was
-- returned. A 2-week camp menu would therefore serve week 1's Monday lunch
-- on some Mondays and week 2's on others, unpredictably.
--
-- Fix: compute the special period's rotation WEEK from the special period's
-- own start alignment — whole calendar weeks elapsed since the special
-- period's date_from, modulo the special rotation's week_count, week 1 being
-- the week that contains date_from. This mirrors resolve_rotation_week()'s
-- math but anchors on the special period rather than the institution's
-- standing assignment.
-- =====================================================================

create or replace function resolve_meal(p_inst uuid, p_date date, p_period app_period)
returns table (meal_id uuid, source calendar_exception_kind, rotation_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_closed boolean;
  v_override_meal uuid;
  v_special record;
  v_special_week int;
  v_rot record;
  v_weekday smallint;
begin
  if not service_plan_includes(p_inst, p_date, p_period) then
    return;
  end if;

  -- 1. Closure wins.
  select true into v_closed from calendar_exceptions ce
   where ce.institution_id = p_inst and ce.kind = 'closure'
     and p_date between ce.date_from and ce.date_to
     and (ce.period is null or ce.period = p_period)
   limit 1;
  if v_closed then return; end if;

  -- 2. Date-specific override.
  select ce.meal_id into v_override_meal from calendar_exceptions ce
   where ce.institution_id = p_inst and ce.kind = 'override'
     and p_date between ce.date_from and ce.date_to
     and (ce.period is null or ce.period = p_period)
   order by ce.created_at desc limit 1;
  if v_override_meal is not null then
    return query select v_override_meal, 'override'::calendar_exception_kind, null::uuid;
    return;
  end if;

  v_weekday := (extract(isodow from p_date)::int - 1)::smallint;  -- 0=Mon..6=Sun

  -- 3. Special period / camp rotation, week computed from the PERIOD's start.
  select ce.rotation_id, ce.date_from, r.week_count
    into v_special
    from calendar_exceptions ce
    join rotations r on r.id = ce.rotation_id
   where ce.institution_id = p_inst and ce.kind = 'special_period'
     and p_date between ce.date_from and ce.date_to
     and ce.rotation_id is not null
   order by ce.created_at desc
   limit 1;
  if v_special.rotation_id is not null then
    -- whole weeks since the special period's first week (Monday-aligned),
    -- modulo the special rotation length; week 1 == the week of date_from.
    v_special_week := (
      floor(
        extract(epoch from (date_trunc('week', p_date::timestamp)
                            - date_trunc('week', v_special.date_from::timestamp)))
        / 604800
      )::int % v_special.week_count
    ) + 1;

    return query
      select rs.meal_id, 'special_period'::calendar_exception_kind, rs.rotation_id
      from rotation_slots rs
      where rs.rotation_id = v_special.rotation_id
        and rs.week_number = v_special_week
        and rs.weekday = v_weekday
        and rs.period = p_period
        and rs.meal_id is not null
      limit 1;
    return;
  end if;

  -- 4. Normal active rotation assignment.
  select * into v_rot from resolve_rotation_week(p_inst, p_date);
  if v_rot.rotation_id is null then return; end if;

  return query
    select rs.meal_id, null::calendar_exception_kind, rs.rotation_id
    from rotation_slots rs
    where rs.rotation_id = v_rot.rotation_id
      and rs.week_number = v_rot.week_number
      and rs.weekday = v_weekday
      and rs.period = p_period
      and rs.meal_id is not null
    limit 1;
end $$;

-- resolve_meal keeps the same signature; re-revoke from clients to be safe
-- (a create-or-replace re-grants EXECUTE to PUBLIC by Supabase default).
revoke execute on function resolve_meal(uuid, date, app_period) from public, authenticated, anon;
