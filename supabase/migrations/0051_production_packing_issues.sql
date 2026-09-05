-- =====================================================================
-- 0051 — PRODUCTION, PACKING, AND THE ISSUE DOMAIN
--
-- THE OPERATING STANDARD THIS ENCODES (§6)
--
--   REQUIRED = PRODUCED = PACKED = DISPATCHED = HANDED OVER.
--
-- That is LunchBox's normal day, not an aspiration. So the normal path here is
-- a confirmation, not a data-entry form: the Kitchen never retypes a quantity
-- the system already calculated. `MARK PRODUCTION COMPLETE` means "the exact
-- Final Demand was produced", and that is the whole interaction.
--
-- Exceptions exist because robust software needs somewhere to record an
-- abnormal event — but they are SECONDARY. There is no daily shortage
-- calculator, no expected-variance field, and no place to type "we made 78 of
-- 80" as though that were a normal Tuesday. An abnormal day goes through
-- report_operational_issue() and is visible as what it is.
--
-- SPECIAL MEALS ARE CONFIRMED INDIVIDUALLY. "We made the three specials" is a
-- weaker assurance than "this child's Meal was made", and the difference is
-- exactly the child who gets the wrong tray. Production and Packing cannot
-- complete while any special line is unconfirmed.
-- =====================================================================

create type production_state as enum ('READY', 'IN_PRODUCTION', 'COMPLETE');
create type packing_state    as enum ('WAITING_FOR_PRODUCTION', 'PACKING', 'PACKED');

create type operational_stage as enum (
  'PRODUCTION', 'PACKING', 'DISPATCH', 'DELIVERY'
);

create type operational_issue_status as enum (
  'OPEN', 'LUNCHBOX_ACTIONED', 'INSTITUTION_ACKNOWLEDGED', 'CLOSED'
);

-- ---------------------------------------------------------------------
-- One production/packing record per Final Demand snapshot. Quantities are NOT
-- duplicated here — they live in final_demand and are read from it. Storing
-- them twice is how two numbers start disagreeing.
-- ---------------------------------------------------------------------
create table if not exists production_runs (
  id                   uuid primary key default gen_random_uuid(),
  final_demand_id      uuid not null references final_demand (id) on delete cascade,
  production_state     production_state not null default 'READY',
  production_started_at timestamptz,
  production_started_by uuid references app_users (user_id) on delete set null,
  production_done_at   timestamptz,
  production_done_by   uuid references app_users (user_id) on delete set null,
  packing_state        packing_state not null default 'WAITING_FOR_PRODUCTION',
  packing_started_at   timestamptz,
  packing_started_by   uuid references app_users (user_id) on delete set null,
  packing_done_at      timestamptz,
  packing_done_by      uuid references app_users (user_id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (final_demand_id)
);

comment on table production_runs is
  'Production and Packing progress for one Final Demand snapshot. Carries no '
  'quantity of its own — the quantity is final_demand''s, read through the join, '
  'so there is exactly one number and it cannot drift.';

-- ---------------------------------------------------------------------
create table if not exists operational_issues (
  id              uuid primary key default gen_random_uuid(),
  stage           operational_stage not null,
  category        text not null,
  description     text not null,
  institution_id  uuid references institutions (id) on delete set null,
  service_date    date,
  final_demand_id uuid references final_demand (id) on delete set null,
  manifest_id     uuid,   -- FK added in 0052, where manifests are created
  special_line_id uuid references final_demand_special_lines (id) on delete set null,
  status          operational_issue_status not null default 'OPEN',
  raised_by       uuid references app_users (user_id) on delete set null,
  raised_at       timestamptz not null default now(),
  resolution      text,
  resolved_by     uuid references app_users (user_id) on delete set null,
  resolved_at     timestamptz,
  constraint operational_issue_text check (btrim(description) <> ''),
  constraint operational_issue_category check (btrim(category) <> '')
);

create index if not exists operational_issues_open_idx
  on operational_issues (status, service_date desc);
create index if not exists operational_issues_inst_idx
  on operational_issues (institution_id, service_date desc);

comment on table operational_issues is
  'One issue domain for every stage, with stage-scoped visibility. An internal '
  'Production or Packing problem that never reached the Institution is not '
  'shown to the Institution; a Delivery issue raised at handover is.';

-- =====================================================================
-- PRODUCTION
-- =====================================================================
create or replace function start_production(p_final uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_run uuid; v_state production_state;
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may start production';
  end if;
  if not exists (select 1 from final_demand where id = p_final and superseded_at is null) then
    raise exception 'That demand is not finalised, or has been superseded';
  end if;

  insert into production_runs (final_demand_id) values (p_final)
    on conflict (final_demand_id) do nothing;
  select id, production_state into v_run, v_state
    from production_runs where final_demand_id = p_final;

  if v_state <> 'READY' then
    raise exception 'Production has already started for this service';
  end if;

  update production_runs
     set production_state = 'IN_PRODUCTION',
         production_started_at = now(), production_started_by = auth.uid()
   where id = v_run;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'production.started', 'production_runs', v_run,
          jsonb_build_object('final_demand_id', p_final));
end $$;

-- Confirm one special Meal has actually been made, by reference.
create or replace function confirm_special_produced(p_line uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may confirm a special Meal';
  end if;
  update final_demand_special_lines
     set produced_at = now(), produced_by = auth.uid()
   where id = p_line and produced_at is null;
  if not found then
    raise exception 'That special Meal line does not exist or is already confirmed';
  end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'production.special_confirmed', 'final_demand_special_lines',
          p_line, jsonb_build_object('produced', true));
end $$;

create or replace function complete_production(p_final uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_run uuid; v_state production_state; v_missing int;
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may complete production';
  end if;

  select id, production_state into v_run, v_state
    from production_runs where final_demand_id = p_final;
  if v_run is null or v_state <> 'IN_PRODUCTION' then
    raise exception 'Production is not in progress for this service';
  end if;

  select count(*) into v_missing from final_demand_special_lines
   where final_demand_id = p_final and produced_at is null;
  if v_missing > 0 then
    raise exception
      '% special Meal(s) are not yet confirmed as produced. Confirm each one '
      'before completing production.', v_missing;
  end if;

  update production_runs
     set production_state = 'COMPLETE',
         production_done_at = now(), production_done_by = auth.uid(),
         packing_state = 'WAITING_FOR_PRODUCTION'
   where id = v_run;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'production.completed', 'production_runs', v_run,
          jsonb_build_object('final_demand_id', p_final,
                             'meaning', 'exact Final Demand produced'));
end $$;

-- =====================================================================
-- PACKING
-- =====================================================================
create or replace function start_packing(p_final uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_run uuid; v_prod production_state; v_pack packing_state;
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may start packing';
  end if;
  select id, production_state, packing_state into v_run, v_prod, v_pack
    from production_runs where final_demand_id = p_final;
  if v_run is null then raise exception 'Production has not started for this service'; end if;
  if v_prod <> 'COMPLETE' then
    raise exception 'Packing derives from completed Production. Complete production first.';
  end if;
  if v_pack <> 'WAITING_FOR_PRODUCTION' then
    raise exception 'Packing has already started for this service';
  end if;

  update production_runs
     set packing_state = 'PACKING',
         packing_started_at = now(), packing_started_by = auth.uid()
   where id = v_run;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'packing.started', 'production_runs', v_run,
          jsonb_build_object('final_demand_id', p_final));
end $$;

create or replace function confirm_special_packed(p_line uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may confirm a special Meal';
  end if;
  update final_demand_special_lines
     set packed_at = now(), packed_by = auth.uid()
   where id = p_line and produced_at is not null and packed_at is null;
  if not found then
    raise exception
      'That special Meal line is not ready to pack — it must be produced first '
      'and not already packed';
  end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'packing.special_confirmed', 'final_demand_special_lines',
          p_line, jsonb_build_object('packed', true));
end $$;

create or replace function complete_packing(p_final uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_run uuid; v_pack packing_state; v_missing int;
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may complete packing';
  end if;
  select id, packing_state into v_run, v_pack
    from production_runs where final_demand_id = p_final;
  if v_run is null or v_pack <> 'PACKING' then
    raise exception 'Packing is not in progress for this service';
  end if;

  select count(*) into v_missing from final_demand_special_lines
   where final_demand_id = p_final and packed_at is null;
  if v_missing > 0 then
    raise exception
      '% special Meal(s) are not yet confirmed as packed. Confirm each one '
      'before completing packing.', v_missing;
  end if;

  update production_runs
     set packing_state = 'PACKED',
         packing_done_at = now(), packing_done_by = auth.uid()
   where id = v_run;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'packing.completed', 'production_runs', v_run,
          jsonb_build_object('final_demand_id', p_final,
                             'meaning', 'exact required packs ready'));
end $$;

-- =====================================================================
-- ISSUES — the secondary path.
-- =====================================================================
create or replace function report_operational_issue(
  p_stage       operational_stage,
  p_category    text,
  p_description text,
  p_institution uuid default null,
  p_date        date default null,
  p_final       uuid default null,
  p_manifest    uuid default null,
  p_special_line uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role app_role;
begin
  v_role := app_current_role();
  if v_role is null then raise exception 'Not authorised'; end if;

  -- Who may raise what: the Kitchen owns internal stages, the Institution owns
  -- what it received, the Super Admin sees everything.
  if p_stage in ('PRODUCTION', 'PACKING', 'DISPATCH')
     and v_role not in ('super_admin', 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may report a % issue', p_stage;
  end if;
  if p_stage = 'DELIVERY'
     and v_role not in ('super_admin', 'kitchen', 'school_admin', 'classroom_staff', 'driver') then
    raise exception 'You may not report a delivery issue';
  end if;
  if p_institution is not null and v_role in ('school_admin', 'classroom_staff')
     and not app_can_see_institution(p_institution) then
    raise exception 'You may only report an issue for your own institution';
  end if;
  if coalesce(btrim(p_description), '') = '' then
    raise exception 'Describe what happened';
  end if;

  insert into operational_issues
    (stage, category, description, institution_id, service_date, final_demand_id,
     manifest_id, special_line_id, raised_by)
  values (p_stage, btrim(p_category), btrim(p_description), p_institution, p_date,
          p_final, p_manifest, p_special_line, auth.uid())
  returning id into v_id;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'issue.raised', 'operational_issues', v_id,
          jsonb_build_object('stage', p_stage, 'category', btrim(p_category),
                             'institution_id', p_institution, 'service_date', p_date));
  return v_id;
end $$;

create or replace function advance_operational_issue(
  p_id uuid, p_status operational_issue_status, p_resolution text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_was operational_issue_status; v_inst uuid; v_role app_role;
begin
  v_role := app_current_role();
  select status, institution_id into v_was, v_inst from operational_issues where id = p_id;
  if v_was is null then raise exception 'Issue not found'; end if;

  -- LunchBox actions and closes. The Institution may acknowledge its own.
  if p_status in ('LUNCHBOX_ACTIONED', 'CLOSED') then
    if v_role not in ('super_admin', 'kitchen') then
      raise exception 'Only LunchBox may action or close an issue';
    end if;
  elsif p_status = 'INSTITUTION_ACKNOWLEDGED' then
    if not (app_is_super_admin() or (v_inst is not null and app_can_manage_institution(v_inst))) then
      raise exception 'Only that institution may acknowledge this issue';
    end if;
  else
    raise exception 'An issue cannot be moved back to open';
  end if;

  update operational_issues
     set status = p_status,
         resolution = coalesce(nullif(btrim(coalesce(p_resolution,'')), ''), resolution),
         resolved_by = case when p_status = 'CLOSED' then auth.uid() else resolved_by end,
         resolved_at = case when p_status = 'CLOSED' then now() else resolved_at end
   where id = p_id;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value, reason)
  values (auth.uid(), 'issue.advanced', 'operational_issues', p_id,
          jsonb_build_object('status', v_was), jsonb_build_object('status', p_status),
          nullif(btrim(coalesce(p_resolution,'')), ''));
end $$;

-- =====================================================================
-- RLS + GRANTS
-- =====================================================================
alter table production_runs     enable row level security;
alter table operational_issues  enable row level security;

grant select on production_runs, operational_issues to authenticated;
revoke all on production_runs, operational_issues from anon;

-- Production planning stays LunchBox-internal.
drop policy if exists production_runs_select on production_runs;
create policy production_runs_select on production_runs for select
  using (app_is_super_admin() or app_current_role() = 'kitchen');

-- Stage-scoped: the Institution sees delivery issues that concern it, never the
-- Kitchen's internal production problems. A Parent sees none of it.
drop policy if exists operational_issues_select on operational_issues;
create policy operational_issues_select on operational_issues for select
  using (
    app_is_super_admin()
    or app_current_role() = 'kitchen'
    or (
      stage = 'DELIVERY'
      and institution_id is not null
      and app_can_see_institution(institution_id)
      and app_current_role() in ('school_admin', 'classroom_staff')
    )
  );

revoke all on function start_production(uuid)             from public, anon;
revoke all on function complete_production(uuid)          from public, anon;
revoke all on function confirm_special_produced(uuid)     from public, anon;
revoke all on function start_packing(uuid)                from public, anon;
revoke all on function complete_packing(uuid)             from public, anon;
revoke all on function confirm_special_packed(uuid)       from public, anon;
revoke all on function report_operational_issue(operational_stage,text,text,uuid,date,uuid,uuid,uuid) from public, anon;
revoke all on function advance_operational_issue(uuid,operational_issue_status,text) from public, anon;

grant execute on function start_production(uuid)          to authenticated;
grant execute on function complete_production(uuid)       to authenticated;
grant execute on function confirm_special_produced(uuid)  to authenticated;
grant execute on function start_packing(uuid)             to authenticated;
grant execute on function complete_packing(uuid)          to authenticated;
grant execute on function confirm_special_packed(uuid)    to authenticated;
grant execute on function report_operational_issue(operational_stage,text,text,uuid,date,uuid,uuid,uuid) to authenticated;
grant execute on function advance_operational_issue(uuid,operational_issue_status,text) to authenticated;
