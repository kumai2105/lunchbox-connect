-- =====================================================================
-- 0020 — Persist meal_service_id when a Classroom observation is recorded.
--
-- serving_records.meal_service_id has existed since 0016, but
-- record_serving_batch() never wrote it: the RPC still only persisted
-- menu_item_id, the legacy pointer to a template row addressed by a global
-- calendar-week number. Rewiring the Classroom screen to resolve the dated
-- Meal Service is pointless while the write path drops the value on the
-- floor, so this adds it.
--
-- menu_item_id is still written. Both columns coexist until the legacy
-- `menus` table is removed, so nothing that reads the old pointer breaks.
-- =====================================================================

create or replace function record_serving_batch(p_class uuid, p_rows jsonb, p_date date default current_date)
returns table (out_id uuid, out_student_id uuid)
language plpgsql
as $$
declare
  r jsonb;
  new_id uuid;
begin
  if jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into serving_records (
      class_id, student_id, period, recorded_by, serving_date,
      served_status, consumption_pct, behavior, low_intake_reason, concern_observed,
      menu_item_id, meal_service_id, note
    )
    values (
      p_class,
      (r->>'student_id')::uuid,
      (r->>'period')::app_period,
      app_current_user_id(),
      p_date,
      coalesce((r->>'served_status')::meal_served_status, 'served'),
      nullif(r->>'consumption_pct', '')::smallint,
      nullif(r->>'behavior', '')::eating_behavior,
      nullif(r->>'low_intake_reason', '')::low_intake_reason,
      coalesce((r->>'concern_observed')::boolean, false),
      nullif(r->>'menu_item_id', '')::uuid,
      nullif(r->>'meal_service_id', '')::uuid,
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
      -- Never blank an existing link. A correction submitted from a screen
      -- that could not resolve the service (nothing published for the slot)
      -- must not erase the traceability an earlier save established.
      meal_service_id = coalesce(excluded.meal_service_id, serving_records.meal_service_id),
      note = excluded.note,
      recorded_by = excluded.recorded_by,
      class_id = excluded.class_id,
      updated_at = now()
    returning id into new_id;

    out_id := new_id;
    out_student_id := (r->>'student_id')::uuid;
    return next;
  end loop;
end;
$$;

grant execute on function record_serving_batch(uuid, jsonb, date) to authenticated;
