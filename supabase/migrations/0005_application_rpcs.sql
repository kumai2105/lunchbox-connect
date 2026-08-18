-- 0005: application RPCs -------------------------------------------------------
-- Thin, RLS-respecting entry points for the serving screen and menu publishing.
-- These run as the CALLER (no security definer), so every row still passes the
-- policies from 0004.

-- Bulk-insert or upsert a day's serving outcomes for one class/date.
-- payload: [{ student_id, period, outcome, note? }]
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
    insert into serving_records (class_id, student_id, period, outcome, note, recorded_by, serving_date)
    values (
      p_class,
      (r->>'student_id')::uuid,
      (r->>'period')::app_period,
      (r->>'outcome')::meal_outcome,
      r->>'note',
      app_current_user_id(),
      p_date
    )
    on conflict (student_id, serving_date, period)
    do update set
      outcome = excluded.outcome,
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

-- Publish every menu row of a week to families (super admin only via RLS).
create or replace function publish_menu_week(p_week int)
returns void
language sql
as $$
  update menus set published = true where week_number = p_week;
$$;

grant execute on function record_serving_batch(uuid, jsonb, date) to authenticated;
grant execute on function publish_menu_week(int) to authenticated;