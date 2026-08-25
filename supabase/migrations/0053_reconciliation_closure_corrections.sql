-- =====================================================================
-- 0053 — RECONCILIATION, DAY CLOSURE, AND CORRECTIONS
--
-- RECONCILIATION SHOWS AN ORDINARY DAY AS ORDINARY (§50).
--
-- The normal row reads 80 / 80 / 80 / 80 / FULL DELIVERY CONFIRMED / 3 of 3 / 0
-- issues. This is deliberately not a variance-management product: LunchBox's
-- standard is exact fulfilment, so the reporting surface confirms the chain
-- rather than inviting a daily reconciliation of differences that should not
-- exist.
--
-- CLASSROOM COMPLETION IS REPORTED SEPARATELY, and closure never waits on it
-- (§51). Logistics finished when the food was handed over. Whether Institution
-- staff have finished tapping intake into a tablet is a different fact about a
-- different organisation, and blocking LunchBox's day on it would be blocking
-- on someone else's afternoon.
--
-- CORRECTIONS PRESERVE WHAT WAS TRUE (§52). A completed operational event is
-- never hard-deleted or silently overwritten. A correction records the old
-- value, the new value, who and why — and this is deliberately NOT a generic
-- row editor. It corrects named operational facts, nothing else.
-- =====================================================================

create or replace function operational_reconciliation(p_date date)
returns table (
  institution_id     uuid,
  institution_name   text,
  period             app_period,
  meal_name          text,
  entitled_students  integer,
  required_total     integer,
  required_standard  integer,
  required_special   integer,
  production_state   text,
  packing_state      text,
  dispatch_state     text,
  specials_produced  bigint,
  specials_packed    bigint,
  specials_total     bigint,
  open_issues        bigint,
  plan_enforced      boolean
)
language sql stable security definer set search_path = public as $$
  select
    fd.institution_id, i.name, fd.period, mr.name,
    fd.entitled_students, fd.total_quantity, fd.standard_quantity, fd.special_quantity,
    coalesce(pr.production_state::text, 'NOT STARTED'),
    coalesce(pr.packing_state::text, 'WAITING FOR PRODUCTION'),
    coalesce(dm.state::text, 'NO MANIFEST'),
    (select count(*) from final_demand_special_lines l
      where l.final_demand_id = fd.id and l.produced_at is not null),
    (select count(*) from final_demand_special_lines l
      where l.final_demand_id = fd.id and l.packed_at is not null),
    (select count(*) from final_demand_special_lines l where l.final_demand_id = fd.id),
    (select count(*) from operational_issues oi
      where oi.service_date = fd.service_date
        and oi.institution_id = fd.institution_id
        and oi.status <> 'CLOSED'),
    fd.plan_enforced
  from final_demand fd
  join institutions i on i.id = fd.institution_id
  left join meal_revisions mr on mr.id = fd.meal_revision_id
  left join production_runs pr on pr.final_demand_id = fd.id
  left join manifest_lines ml on ml.final_demand_id = fd.id
  left join delivery_manifests dm on dm.id = ml.manifest_id
  where fd.service_date = p_date
    and fd.superseded_at is null
    and app_is_super_admin()
  order by i.name, fd.period;
$$;

-- Classroom intake completion — reported BESIDE reconciliation, never folded
-- into it, and with an entitlement-correct denominator (§21).
--
-- A Morning-only child is not in the Lunch denominator at all, so they can
-- never drag Lunch completion below 100% by existing.
create or replace function classroom_completion(p_date date)
returns table (
  institution_id   uuid,
  institution_name text,
  period           app_period,
  entitled         bigint,
  recorded         bigint
)
language sql stable security definer set search_path = public as $$
  select ms.institution_id, i.name, ms.period,
         count(*) filter (
           where app_student_counts_for(s.id, ms.institution_id, ms.service_date, ms.period)),
         count(*) filter (
           where app_student_counts_for(s.id, ms.institution_id, ms.service_date, ms.period)
             and exists (select 1 from serving_records sr
                          where sr.student_id = s.id and sr.meal_service_id = ms.id))
    from meal_services ms
    join institutions i on i.id = ms.institution_id
    join students s on s.institution_id = ms.institution_id
                   and s.operational_status = 'ACTIVE_BILLABLE_TO_NURSERY'
   where ms.service_date = p_date and ms.published
     and (app_is_super_admin() or app_can_manage_institution(ms.institution_id))
   group by ms.institution_id, i.name, ms.period
   order by i.name, ms.period;
$$;

-- ---------------------------------------------------------------------
-- DAY CLOSURE
-- ---------------------------------------------------------------------
create table if not exists operational_days (
  service_date date primary key,
  closed_at    timestamptz not null default now(),
  closed_by    uuid references app_users (user_id) on delete set null,
  note         text
);

comment on table operational_days is
  'A closed logistics day. Closure asserts every production, packing and '
  'delivery step reached an explicit final state and every special Meal is '
  'accounted for. Issues already accepted stay OPEN and stay visible after '
  'closure — closing the day does not close the problem.';

create or replace function close_operational_day(p_date date, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_bad int; v_specials int; v_manifests int;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may close the operational day';
  end if;
  if exists (select 1 from operational_days where service_date = p_date) then
    raise exception 'That day is already closed';
  end if;

  select count(*) into v_bad
    from final_demand fd
    left join production_runs pr on pr.final_demand_id = fd.id
   where fd.service_date = p_date and fd.superseded_at is null
     and (pr.id is null or pr.production_state <> 'COMPLETE' or pr.packing_state <> 'PACKED');
  if v_bad > 0 then
    raise exception '% service line(s) have no final Production/Packing state', v_bad;
  end if;

  select count(*) into v_specials
    from final_demand fd
    join final_demand_special_lines l on l.final_demand_id = fd.id
   where fd.service_date = p_date and fd.superseded_at is null
     and (l.produced_at is null or l.packed_at is null);
  if v_specials > 0 then
    raise exception '% special Meal(s) are not fully accounted for', v_specials;
  end if;

  -- Every expected delivery must have reached handover OR carry an explicit
  -- unresolved exception. Silence is not an outcome.
  select count(*) into v_manifests
    from delivery_manifests dm
   where dm.service_date = p_date
     and dm.state <> 'HANDED_OVER'
     and not exists (select 1 from operational_issues oi
                      where oi.manifest_id = dm.id and oi.status <> 'CLOSED');
  if v_manifests > 0 then
    raise exception
      '% delivery(ies) are neither handed over nor carrying an open issue', v_manifests;
  end if;

  insert into operational_days (service_date, closed_by, note)
  values (p_date, auth.uid(), nullif(btrim(coalesce(p_note,'')), ''));

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value, reason)
  values (auth.uid(), 'operational_day.closed', 'operational_days', null,
          jsonb_build_object('service_date', p_date),
          nullif(btrim(coalesce(p_note,'')), ''));
end $$;

-- ---------------------------------------------------------------------
-- CORRECTIONS — narrow by design.
-- ---------------------------------------------------------------------
create or replace function correct_operational_record(
  p_entity  text,
  p_id      uuid,
  p_field   text,
  p_value   text,
  p_reason  text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may correct an operational record';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required for every correction';
  end if;

  -- An allow-list, not a generic UPDATE. A correction facility that can write
  -- any column of any table is a database console with an audit row attached,
  -- and it would be used as one.
  if p_entity = 'delivery_manifests' and p_field = 'delivery_point' then
    select delivery_point into v_old from delivery_manifests where id = p_id;
    if v_old is null then raise exception 'Manifest not found'; end if;
    update delivery_manifests set delivery_point = p_value where id = p_id;

  elsif p_entity = 'operational_issues' and p_field = 'description' then
    select description into v_old from operational_issues where id = p_id;
    if v_old is null then raise exception 'Issue not found'; end if;
    update operational_issues set description = p_value where id = p_id;

  elsif p_entity = 'operational_issues' and p_field = 'category' then
    select category into v_old from operational_issues where id = p_id;
    if v_old is null then raise exception 'Issue not found'; end if;
    update operational_issues set category = p_value where id = p_id;

  else
    raise exception
      'That record and field are not correctable. Demand is corrected by '
      'adjusting it, and completed handovers are corrected by raising an issue.';
  end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(), 'record.corrected', p_entity, p_id,
          jsonb_build_object(p_field, v_old),
          jsonb_build_object(p_field, p_value),
          btrim(p_reason));
end $$;

-- =====================================================================
alter table operational_days enable row level security;
grant select on operational_days to authenticated;
revoke all on operational_days from anon;

drop policy if exists operational_days_select on operational_days;
create policy operational_days_select on operational_days for select
  using (app_is_super_admin() or app_current_role() = 'kitchen');

revoke all on function operational_reconciliation(date)                  from public, anon;
revoke all on function classroom_completion(date)                        from public, anon;
revoke all on function close_operational_day(date,text)                  from public, anon;
revoke all on function correct_operational_record(text,uuid,text,text,text) from public, anon;

grant execute on function operational_reconciliation(date)               to authenticated;
grant execute on function classroom_completion(date)                     to authenticated;
grant execute on function close_operational_day(date,text)               to authenticated;
grant execute on function correct_operational_record(text,uuid,text,text,text) to authenticated;
