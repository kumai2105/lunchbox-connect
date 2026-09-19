-- =====================================================================
-- 0030 — Surgical integrity pass (items 1-4). No product redesign.
--
-- (1) publish_meal_services previously froze EVERY already-published service,
--     so a future Override/Closure/Menu correction never took effect after the
--     window was published. The correct boundary is operational evidence, not
--     "published": a service that already carries Classroom/served records is
--     historical truth and is never rewritten; any other service (typically a
--     future date) is genuinely re-resolvable. A future Closure now removes the
--     applicable service; a future Override now replaces its revision.
--
-- (2) Revision-level analytics. Meal-level analytics (v_meal_performance) is
--     the stable default, but Decision 033 also needs before/after evaluation
--     of recipe changes, so v_meal_revision_performance keeps every revision
--     distinct: Meal -> Revision -> observations.
--
-- (3) record_serving_batch validates that the Meal Service (supplied by the
--     client OR resolved internally) matches the student's institution, the
--     serving date, the period, and is published — mismatches are rejected.
--
-- (4) record_serving_batch verifies the student actually belongs to p_class.
--     Holding authorization to a student and to a class separately is not
--     enough to record that student under an unrelated class id.
-- =====================================================================

-- ---- (1) publishable future services -------------------------------------
create or replace function publish_meal_services(p_inst uuid, p_from date, p_to date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  d date;
  p app_period;
  r record;
  v_rev uuid;
  v_existing uuid;
  v_locked boolean;
  n int := 0;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may publish a schedule';
  end if;

  d := p_from;
  while d <= p_to loop
    foreach p in array array['breakfast','snack','lunch','afternoon_snack']::app_period[] loop
      -- Does a service already exist for this slot, and is it locked by served
      -- history? A service with ANY serving_record is historical truth.
      select ms.id,
             exists (select 1 from serving_records sr where sr.meal_service_id = ms.id)
        into v_existing, v_locked
        from meal_services ms
       where ms.institution_id = p_inst and ms.service_date = d and ms.period = p;

      if v_existing is not null and coalesce(v_locked, false) then
        -- Served/recorded already: never rewrite or remove it.
        null;
      else
        select * into r from resolve_meal(p_inst, d, p);
        if r.meal_id is not null then
          select m.current_revision_id into v_rev from meals m where m.id = r.meal_id;
          if v_rev is not null then
            -- Not locked, so the resolved revision genuinely takes effect
            -- (this is what makes a future Override / Menu correction apply).
            insert into meal_services (
              institution_id, service_date, period, meal_revision_id,
              source, rotation_id, published, published_at
            )
            values (p_inst, d, p, v_rev, r.source, r.rotation_id, true, now())
            on conflict (institution_id, service_date, period) do update
              set meal_revision_id = excluded.meal_revision_id,
                  source           = excluded.source,
                  rotation_id      = excluded.rotation_id,
                  published        = true,
                  published_at     = coalesce(meal_services.published_at, now());
            n := n + 1;
          end if;
        else
          -- Nothing resolves for this slot (a Closure, or nothing planned).
          -- Remove the unlocked service so the closure actually suppresses it.
          if v_existing is not null then
            delete from meal_services where id = v_existing;
            n := n + 1;
          end if;
        end if;
      end if;
    end loop;
    d := d + 1;
  end loop;
  return n;
end $$;

grant execute on function publish_meal_services(uuid, date, date) to authenticated;

comment on function publish_meal_services(uuid, date, date) is
  'Materialize/re-materialize dated Meal Services for a window. A service that '
  'already carries serving_records is historical truth and is never rewritten '
  'or removed; any other (typically future) service is re-resolved so Overrides '
  '(replace revision), Closures (remove service) and Menu corrections take '
  'effect. Production-lock behaviour beyond the served-records boundary is '
  'BLOCKED_BY_SPEC.';

-- ---- (2) revision-level analytics ----------------------------------------
create or replace function v_meal_revision_performance_impl()
returns table (
  meal_id uuid,
  meal_name text,
  meal_revision_id uuid,
  revision_no int,
  revision_name text,
  period app_period,
  total_observations bigint,
  valid_observations bigint,
  avg_consumption_pct numeric,
  refusal_count bigint,
  encouragement_count bigint,
  did_not_like_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    mm.id, mm.name,
    mr.id, mr.revision_no, mr.name,
    ms.period,
    count(sr.id),
    count(sr.id) filter (
      where sr.served_status = 'served'
        and coalesce(sr.low_intake_reason::text, '') not in ('absent', 'unwell', 'sleeping')
    ),
    round(avg(sr.consumption_pct) filter (
      where sr.served_status = 'served'
        and coalesce(sr.low_intake_reason::text, '') not in ('absent', 'unwell', 'sleeping')
    ), 1),
    count(sr.id) filter (where sr.behavior = 'refused'),
    count(sr.id) filter (where sr.behavior = 'needed_encouragement'),
    count(sr.id) filter (where sr.low_intake_reason = 'did_not_like_it')
  from serving_records sr
  join meal_services ms on ms.id = sr.meal_service_id
  join meal_revisions mr on mr.id = ms.meal_revision_id
  join meals mm on mm.id = mr.meal_id
  where exists (select 1 from app_users me where me.user_id = auth.uid() and me.role = 'super_admin')
  group by mm.id, mm.name, mr.id, mr.revision_no, mr.name, ms.period
$$;

create or replace view v_meal_revision_performance
with (security_invoker = true) as
select * from v_meal_revision_performance_impl();

grant select on v_meal_revision_performance to authenticated;

comment on view v_meal_revision_performance is
  'Revision-level meal performance (Decision 033): the same observations as '
  'v_meal_performance but kept split by meal_revision, so recipe changes can be '
  'evaluated before/after. v_meal_performance stays the stable meal-level view.';

-- ---- (3) + (4) harden record_serving_batch -------------------------------
create or replace function record_serving_batch(p_class uuid, p_rows jsonb, p_date date default current_date)
returns table (out_id uuid, out_student_id uuid)
language plpgsql
as $$
declare
  r jsonb;
  new_id uuid;
  v_student uuid;
  v_period app_period;
  v_status meal_served_status;
  v_service uuid;
  v_inst uuid;
  v_ok boolean;
begin
  if jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_student := (r->>'student_id')::uuid;
    v_period  := (r->>'period')::app_period;
    v_status  := coalesce((r->>'served_status')::meal_served_status, 'served');
    v_service := nullif(r->>'meal_service_id', '')::uuid;

    -- Item 4: the student must actually belong to the class being recorded.
    -- Separate authorization to a student and to a class is not sufficient.
    select s.institution_id into v_inst
      from students s
     where s.id = v_student and s.class_id = p_class;
    if v_inst is null then
      raise exception
        'Student % is not in class % — cannot record them under this class', v_student, p_class
        using errcode = 'check_violation';
    end if;

    -- Item 1 carry-over: a served meal must be tied to a published Meal Service.
    if v_status = 'served' and v_service is null then
      -- Preserve an existing link on a correction (never blank it).
      select sr.meal_service_id into v_service
        from serving_records sr
       where sr.student_id = v_student and sr.serving_date = p_date and sr.period = v_period;
      if v_service is null then
        select ms.id into v_service
          from meal_services ms
         where ms.institution_id = v_inst
           and ms.service_date = p_date
           and ms.period = v_period
           and ms.published;
      end if;
      if v_service is null then
        raise exception
          'No published Meal for % on % — a served meal cannot be recorded without a published Meal Service',
          v_period, p_date
          using errcode = 'check_violation';
      end if;
    end if;

    -- Item 3: whatever service id we are about to store (client-supplied OR
    -- internally resolved) must match this student's institution, the serving
    -- date, the period, and be published. Reject a foreign/stale service.
    if v_service is not null then
      select exists (
        select 1 from meal_services ms
         where ms.id = v_service
           and ms.institution_id = v_inst
           and ms.service_date = p_date
           and ms.period = v_period
           and ms.published
      ) into v_ok;
      if not v_ok then
        raise exception
          'Meal Service % does not match this student''s institution / date % / period % / published state',
          v_service, p_date, v_period
          using errcode = 'check_violation';
      end if;
    end if;

    insert into serving_records (
      class_id, student_id, period, recorded_by, serving_date,
      served_status, consumption_pct, behavior, low_intake_reason, concern_observed,
      menu_item_id, meal_service_id, note
    )
    values (
      p_class,
      v_student,
      v_period,
      app_current_user_id(),
      p_date,
      v_status,
      nullif(r->>'consumption_pct', '')::smallint,
      nullif(r->>'behavior', '')::eating_behavior,
      nullif(r->>'low_intake_reason', '')::low_intake_reason,
      coalesce((r->>'concern_observed')::boolean, false),
      nullif(r->>'menu_item_id', '')::uuid,
      v_service,
      r->>'note'
    )
    on conflict (student_id, serving_date, period)
    do update set
      served_status = excluded.served_status,
      consumption_pct = excluded.consumption_pct,
      behavior = excluded.behavior,
      low_intake_reason = excluded.low_intake_reason,
      concern_observed = excluded.concern_observed,
      menu_item_id = excluded.menu_item_id,
      meal_service_id = coalesce(excluded.meal_service_id, serving_records.meal_service_id),
      note = excluded.note,
      recorded_by = excluded.recorded_by,
      class_id = excluded.class_id,
      updated_at = now()
    returning id into new_id;

    out_id := new_id;
    out_student_id := v_student;
    return next;
  end loop;
end;
$$;

grant execute on function record_serving_batch(uuid, jsonb, date) to authenticated;
