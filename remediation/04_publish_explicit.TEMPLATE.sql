-- =====================================================================
-- 04_publish_explicit.TEMPLATE.sql — EXPLICIT, BOUNDED publication.
--
-- Generates dated Meal Services for ONE named institution over a date
-- range YOU choose. It is gated: it refuses unless that institution has
-- BOTH an approved rotation assignment AND an approved service plan
-- (from step 03). It does not touch any other institution, and it does
-- not span a year by default.
--
-- DRAFT vs PUBLISH (domain rule 4): migration/backfill and publishing are
-- different operations. This creates rows as DRAFTS by default
-- (published=false). Flip v_publish to true only when the calendar for
-- that window is genuinely approved for operations.
--
-- Already-published rows are never rewritten (served history is immutable).
--
-- ── TRANSACTION SAFETY ── does NOT commit. Review the count, then commit;
-- =====================================================================
begin;

do $guard$
begin
  raise exception
    'STOP: 04 is a template. Set the institution name, the date range, and '
    'the draft/publish flag below, delete this guard, then run. Nothing ran.';
end $guard$;

do $pub$
declare
  -- >>> FILL IN <<<
  v_inst_name text := '<<EXACT INSTITUTION NAME>>';
  v_from      date := '<<YYYY-MM-DD start>>';
  v_to        date := '<<YYYY-MM-DD end>>';       -- keep this a real operational window, not a year
  v_publish   bool := false;                       -- false = create DRAFTS; true = publish for operations
  -- ----------------
  v_inst uuid; v_has_plan bool; v_has_rot bool;
  d date; p app_period; r record; v_rev uuid; n int := 0;
begin
  select id into v_inst from institutions where name = v_inst_name;
  if v_inst is null then raise exception 'No institution named "%".', v_inst_name; end if;

  select exists(select 1 from institution_service_plans      where institution_id=v_inst) into v_has_plan;
  select exists(select 1 from institution_rotation_assignments where institution_id=v_inst) into v_has_rot;
  if not v_has_plan or not v_has_rot then
    raise exception 'BLOCKED: "%" is not configured (service_plan=%, rotation_assignment=%). Run 03 first.',
      v_inst_name, v_has_plan, v_has_rot;
  end if;
  if v_to < v_from then raise exception 'end % precedes start %', v_to, v_from; end if;
  if v_to - v_from > 90 then
    raise exception 'Refusing to publish % days at once (>90). Publish real operational windows.', v_to - v_from;
  end if;

  d := v_from;
  while d <= v_to loop
    foreach p in array array['breakfast','snack','lunch','afternoon_snack']::app_period[] loop
      select * into r from resolve_meal(v_inst, d, p);   -- definer-run internally; honours THIS inst's plan
      if r.meal_id is not null then
        select m.current_revision_id into v_rev from meals m where m.id = r.meal_id;
        if v_rev is not null then
          insert into meal_services (institution_id, service_date, period, meal_revision_id,
                                     source, rotation_id, published, published_at)
          values (v_inst, d, p, v_rev, r.source, r.rotation_id, v_publish,
                  case when v_publish then now() else null end)
          on conflict (institution_id, service_date, period) do update
            set meal_revision_id = case when meal_services.published
                  then meal_services.meal_revision_id else excluded.meal_revision_id end,
                published    = meal_services.published or excluded.published,
                published_at = coalesce(meal_services.published_at, excluded.published_at);
          n := n + 1;
        end if;
      end if;
    end loop;
    d := d + 1;
  end loop;

  raise notice '% %: % service rows for "%" over % .. %',
    case when v_publish then 'PUBLISHED' else 'DRAFTED' end, v_inst_name, n, v_inst_name, v_from, v_to;
  raise notice 'Review, then:  commit;  (or rollback;)';
end $pub$;
-- NO commit here on purpose.
