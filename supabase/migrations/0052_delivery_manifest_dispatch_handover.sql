-- =====================================================================
-- 0052 — DELIVERY CONFIGURATION, MANIFEST, DISPATCH AND HANDOVER
--
-- DELIVERY FREQUENCY CHANGES TRANSPORT, NEVER ENTITLEMENT (§5/§38).
--
-- One delivery or two is an Institution logistics choice. It does not change a
-- Student's Meal Plan, the Menu, eligibility, or one single Meal of total
-- demand. Two runs carry the SAME already-calculated Meals in two vehicles.
-- The invariant that makes this safe is enforced in the database: for an active
-- configuration, every serviced Meal Period belongs to EXACTLY ONE run — never
-- two, never none. A period in both runs would double-ship it; a period in
-- neither would silently strand it.
--
-- NO GUESSING FOR EXISTING INSTITUTIONS (§39). Nothing here writes a default
-- configuration for anybody. An Institution with no configuration produces no
-- Manifest and the screen says DELIVERY CONFIGURATION REQUIRED. The commercial
-- agreement's "one delivery" default is a commercial default; it is not
-- permission to write a row into production on every site's behalf.
--
-- CUSTODY (§41/§44). The Driver carries; the Institution receives. The Driver
-- can say "I collected" and "I arrived" and cannot say "you received it" —
-- custody transfer is the Institution's own act, by a person that Institution
-- deliberately authorised. That is why AUTHORIZED DELIVERY RECEIVER is a
-- capability assignment and not a new app_role: it grants exactly the handover
-- action for exactly one Institution and expands nothing else.
-- =====================================================================

create type dispatch_state as enum (
  'PREPARING', 'READY_FOR_DISPATCH', 'RELEASED', 'IN_TRANSIT', 'ARRIVED', 'HANDED_OVER'
);

-- ---------------------------------------------------------------------
-- EFFECTIVE-DATED DELIVERY CONFIGURATION
-- ---------------------------------------------------------------------
create table if not exists institution_delivery_configs (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions (id) on delete cascade,
  effective_from  date not null,
  effective_until date,
  run_count       smallint not null,
  delivery_point  text not null,
  created_by      uuid references app_users (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint delivery_run_count check (run_count in (1, 2)),
  constraint delivery_dates check (
    effective_until is null or effective_until >= effective_from
  ),
  constraint delivery_point_not_blank check (btrim(delivery_point) <> '')
);

create index if not exists delivery_config_lookup_idx
  on institution_delivery_configs (institution_id, effective_from desc);

comment on table institution_delivery_configs is
  'How an Institution receives its Meals: one or two daily runs, from a date. '
  'Changing it applies PROSPECTIVELY — Manifests already created keep the '
  'configuration they were built from. Carries no pricing.';

create table if not exists delivery_config_runs (
  id             uuid primary key default gen_random_uuid(),
  config_id      uuid not null references institution_delivery_configs (id) on delete cascade,
  run_number     smallint not null,
  window_from    time not null,
  window_to      time not null,
  constraint delivery_run_number check (run_number in (1, 2)),
  constraint delivery_window check (window_to > window_from),
  unique (config_id, run_number)
);

create table if not exists delivery_config_run_periods (
  config_id  uuid not null references institution_delivery_configs (id) on delete cascade,
  period     app_period not null,
  run_number smallint not null,
  constraint drp_run_number check (run_number in (1, 2)),
  -- ONE RUN PER PERIOD, structurally: the primary key is (config, period), so a
  -- period physically cannot appear twice in one configuration.
  primary key (config_id, period)
);

comment on table delivery_config_run_periods is
  'Which run carries which Meal Period. The primary key is (config, period), so '
  'a period cannot be assigned to two runs. The complementary half — that no '
  'serviced period is left unassigned — is checked by set_delivery_config().';

-- ---------------------------------------------------------------------
-- AUTHORIZED DELIVERY RECEIVER — a capability, not a role.
-- ---------------------------------------------------------------------
create table if not exists delivery_receivers (
  institution_id uuid not null references institutions (id) on delete cascade,
  user_id        uuid not null references app_users (user_id) on delete cascade,
  assigned_by    uuid references app_users (user_id) on delete set null,
  assigned_at    timestamptz not null default now(),
  primary key (institution_id, user_id)
);

comment on table delivery_receivers is
  'People this Institution has authorised to accept custody of a delivery. '
  'A CAPABILITY, deliberately not an app_role: it grants the handover action '
  'for one Institution and widens no other permission. Parents are never '
  'eligible; only that Institution''s own active Admin or Classroom Staff.';

-- ---------------------------------------------------------------------
-- MANIFEST
-- ---------------------------------------------------------------------
create table if not exists delivery_manifests (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions (id) on delete restrict,
  service_date    date not null,
  run_number      smallint not null,
  config_id       uuid references institution_delivery_configs (id) on delete set null,
  window_from     time,
  window_to       time,
  delivery_point  text,
  state           dispatch_state not null default 'PREPARING',
  driver_user_id  uuid references app_users (user_id) on delete set null,
  released_at     timestamptz,
  released_by     uuid references app_users (user_id) on delete set null,
  collected_at    timestamptz,
  arrived_at      timestamptz,
  handed_over_at  timestamptz,
  received_by     uuid references app_users (user_id) on delete set null,
  handover_with_issue boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint manifest_run_number check (run_number in (1, 2)),
  unique (institution_id, service_date, run_number)
);

create index if not exists manifest_driver_idx
  on delivery_manifests (driver_user_id, service_date desc);
create index if not exists manifest_day_idx
  on delivery_manifests (service_date, institution_id);

comment on table delivery_manifests is
  'What travels to one Institution on one run. Lines derive from Final Demand — '
  'quantities are never reconstructed by hand. Custody moves '
  'PREPARING → READY_FOR_DISPATCH → RELEASED → IN_TRANSIT → ARRIVED → HANDED_OVER.';

create table if not exists manifest_lines (
  id               uuid primary key default gen_random_uuid(),
  manifest_id      uuid not null references delivery_manifests (id) on delete cascade,
  final_demand_id  uuid not null references final_demand (id) on delete restrict,
  period           app_period not null,
  meal_revision_id uuid references meal_revisions (id) on delete restrict,
  standard_quantity integer not null,
  special_quantity  integer not null,
  total_quantity    integer not null,
  constraint manifest_line_one_for_one
    check (total_quantity = standard_quantity + special_quantity),
  unique (manifest_id, final_demand_id)
);

-- The manifest_id FK that 0051 could not yet declare, because manifests did not
-- exist when the issue table was created.
alter table operational_issues drop constraint if exists operational_issues_manifest_fk;
alter table operational_issues
  add constraint operational_issues_manifest_fk
  foreign key (manifest_id) references delivery_manifests (id) on delete set null;

-- =====================================================================
-- CONFIGURATION
-- =====================================================================
create or replace function set_delivery_config(
  p_inst          uuid,
  p_from          date,
  p_run_count     smallint,
  p_delivery_point text,
  p_windows       jsonb,   -- [{"run":1,"from":"07:00","to":"08:30"}, ...]
  p_period_runs   jsonb    -- {"breakfast":1,"snack":1,"lunch":2,"afternoon_snack":2}
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_prev uuid; v_serviced app_period[]; v_p app_period; v_run smallint;
  v_w jsonb;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may set delivery configuration';
  end if;
  if not app_institution_is_active(p_inst) then
    raise exception 'That institution is archived.' using errcode = 'check_violation';
  end if;
  if p_run_count not in (1, 2) then
    raise exception 'An institution receives either one or two daily deliveries';
  end if;
  if coalesce(btrim(p_delivery_point), '') = '' then
    raise exception 'An agreed delivery point is required';
  end if;

  -- Which periods does this site actually serve on that date? The runs must
  -- cover exactly those — no more, no less.
  select isp.periods into v_serviced
    from institution_service_plans isp
   where isp.institution_id = p_inst
     and isp.effective_from <= p_from
     and (isp.effective_to is null or isp.effective_to >= p_from)
   order by isp.effective_from desc limit 1;
  if v_serviced is null then
    raise exception
      'This institution has no service configuration effective on %. '
      'Configure the service periods first.', p_from;
  end if;

  foreach v_p in array v_serviced loop
    if p_period_runs -> (v_p::text) is null then
      raise exception
        'Meal Period "%" is served here but is not assigned to a delivery run. '
        'Every serviced period must travel on exactly one run.', v_p;
    end if;
    v_run := (p_period_runs ->> (v_p::text))::smallint;
    if v_run is null or v_run < 1 or v_run > p_run_count then
      raise exception 'Meal Period "%" is assigned to run %, which does not exist '
                      'in a %-run configuration.', v_p, v_run, p_run_count;
    end if;
  end loop;

  -- Close the previous configuration the day before this one starts.
  select id into v_prev from institution_delivery_configs
   where institution_id = p_inst and effective_until is null and effective_from < p_from
   order by effective_from desc limit 1;
  if v_prev is not null then
    update institution_delivery_configs set effective_until = p_from - 1 where id = v_prev;
  end if;

  insert into institution_delivery_configs
    (institution_id, effective_from, run_count, delivery_point, created_by)
  values (p_inst, p_from, p_run_count, btrim(p_delivery_point), auth.uid())
  returning id into v_id;

  for v_w in select * from jsonb_array_elements(p_windows) loop
    insert into delivery_config_runs (config_id, run_number, window_from, window_to)
    values (v_id, (v_w ->> 'run')::smallint, (v_w ->> 'from')::time, (v_w ->> 'to')::time);
  end loop;

  if (select count(*) from delivery_config_runs where config_id = v_id) <> p_run_count then
    raise exception 'Provide a delivery window for each of the % run(s)', p_run_count;
  end if;

  foreach v_p in array v_serviced loop
    insert into delivery_config_run_periods (config_id, period, run_number)
    values (v_id, v_p, (p_period_runs ->> (v_p::text))::smallint);
  end loop;

  insert into audit_log (actor_user_id, action, entity_type, entity_id,
                         previous_value, new_value)
  values (auth.uid(), 'delivery.config_set', 'institutions', p_inst,
          case when v_prev is null then null else jsonb_build_object('superseded', v_prev) end,
          jsonb_build_object('config_id', v_id, 'effective_from', p_from,
                             'run_count', p_run_count, 'periods', p_period_runs));
  return v_id;
end $$;

-- =====================================================================
-- RECEIVERS
-- =====================================================================
create or replace function set_delivery_receiver(
  p_inst uuid, p_user uuid, p_authorized boolean
) returns void language plpgsql security definer set search_path = public as $$
declare v_role app_role; v_user_inst uuid; v_active boolean;
begin
  -- The Institution manages its own people here; a Super Admin may manage any.
  if not app_can_manage_institution(p_inst) then
    raise exception 'You may not manage delivery receivers for this institution';
  end if;

  select role, institution_id, active into v_role, v_user_inst, v_active
    from app_users where user_id = p_user;
  if v_role is null then raise exception 'User not found'; end if;

  if p_authorized then
    if not v_active then
      raise exception 'A deactivated account cannot be authorised to receive deliveries';
    end if;
    -- Parents are never eligible, and neither is anyone outside this site.
    if v_role not in ('school_admin', 'classroom_staff') then
      raise exception
        'Only this institution''s own Admin or Classroom Staff may be authorised '
        'to receive deliveries';
    end if;
    if v_user_inst is distinct from p_inst then
      raise exception 'That person does not belong to this institution';
    end if;
    insert into delivery_receivers (institution_id, user_id, assigned_by)
    values (p_inst, p_user, auth.uid()) on conflict do nothing;
  else
    delete from delivery_receivers where institution_id = p_inst and user_id = p_user;
  end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(),
          case when p_authorized then 'delivery.receiver_authorized'
               else 'delivery.receiver_removed' end,
          'app_users', p_user,
          jsonb_build_object('institution_id', p_inst, 'authorized', p_authorized));
end $$;

create or replace function app_is_delivery_receiver(p_inst uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from delivery_receivers dr
      join app_users me on me.user_id = dr.user_id
     where dr.institution_id = p_inst and dr.user_id = auth.uid() and me.active
  );
$$;

-- =====================================================================
-- MANIFEST BUILD
-- =====================================================================
create or replace function build_manifests(p_inst uuid, p_date date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_cfg uuid; v_runs smallint; v_point text; v_made int := 0; v_run smallint; v_mid uuid;
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may build a manifest';
  end if;

  select id, run_count, delivery_point into v_cfg, v_runs, v_point
    from institution_delivery_configs
   where institution_id = p_inst
     and effective_from <= p_date
     and (effective_until is null or effective_until >= p_date)
   order by effective_from desc limit 1;

  -- NOT A GUESS. No configuration means no manifest and a screen that says so.
  if v_cfg is null then
    raise exception
      'DELIVERY CONFIGURATION REQUIRED: this institution has no delivery '
      'configuration effective on %. Configure it before dispatching.', p_date;
  end if;

  for v_run in 1..v_runs loop
    insert into delivery_manifests
      (institution_id, service_date, run_number, config_id, delivery_point,
       window_from, window_to)
    select p_inst, p_date, v_run, v_cfg, v_point, r.window_from, r.window_to
      from delivery_config_runs r where r.config_id = v_cfg and r.run_number = v_run
    on conflict (institution_id, service_date, run_number) do nothing;

    select id into v_mid from delivery_manifests
     where institution_id = p_inst and service_date = p_date and run_number = v_run;
    if v_mid is null then continue; end if;

    -- Lines come from the FROZEN snapshot, never recomputed here.
    insert into manifest_lines
      (manifest_id, final_demand_id, period, meal_revision_id,
       standard_quantity, special_quantity, total_quantity)
    select v_mid, fd.id, fd.period, fd.meal_revision_id,
           fd.standard_quantity, fd.special_quantity, fd.total_quantity
      from final_demand fd
      join delivery_config_run_periods drp
        on drp.config_id = v_cfg and drp.period = fd.period
     where fd.institution_id = p_inst
       and fd.service_date = p_date
       and fd.superseded_at is null
       and drp.run_number = v_run
    on conflict (manifest_id, final_demand_id) do update
       set standard_quantity = excluded.standard_quantity,
           special_quantity = excluded.special_quantity,
           total_quantity = excluded.total_quantity,
           meal_revision_id = excluded.meal_revision_id;

    update delivery_manifests set state = 'READY_FOR_DISPATCH'
     where id = v_mid and state = 'PREPARING'
       and exists (select 1 from manifest_lines where manifest_id = v_mid);
    v_made := v_made + 1;
  end loop;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'manifest.built', 'institutions', p_inst,
          jsonb_build_object('service_date', p_date, 'runs', v_made, 'config_id', v_cfg));
  return v_made;
end $$;

create or replace function assign_manifest_driver(p_manifest uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role app_role; v_active boolean;
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may assign a driver';
  end if;
  select role, active into v_role, v_active from app_users where user_id = p_driver;
  if v_role is distinct from 'driver' then
    raise exception 'That person is not a Driver';
  end if;
  if not v_active then raise exception 'That Driver account is deactivated'; end if;

  update delivery_manifests set driver_user_id = p_driver where id = p_manifest;
  if not found then raise exception 'Manifest not found'; end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'manifest.driver_assigned', 'delivery_manifests', p_manifest,
          jsonb_build_object('driver_user_id', p_driver));
end $$;

-- =====================================================================
-- DISPATCH STATE MACHINE
--
-- One function per legal transition, each checking the state it is leaving.
-- A manifest cannot skip a step, and no role can perform another's step.
-- =====================================================================
create or replace function release_manifest(p_manifest uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_state dispatch_state; v_inst uuid; v_date date; v_unpacked int;
begin
  if not (app_is_super_admin() or app_current_role() = 'kitchen') then
    raise exception 'Only the Kitchen or a Super Admin may release a delivery';
  end if;
  select state, institution_id, service_date into v_state, v_inst, v_date
    from delivery_manifests where id = p_manifest;
  if v_state is null then raise exception 'Manifest not found'; end if;
  if v_state <> 'READY_FOR_DISPATCH' then
    raise exception 'This delivery is % and cannot be released', v_state;
  end if;
  if not exists (select 1 from delivery_manifests
                  where id = p_manifest and driver_user_id is not null) then
    raise exception 'Assign a Driver before releasing this delivery';
  end if;

  -- Packing must actually be finished for everything on this run.
  select count(*) into v_unpacked
    from manifest_lines ml
    join production_runs pr on pr.final_demand_id = ml.final_demand_id
   where ml.manifest_id = p_manifest and pr.packing_state <> 'PACKED';
  if v_unpacked > 0 then
    raise exception '% line(s) on this delivery are not packed yet', v_unpacked;
  end if;

  update delivery_manifests
     set state = 'RELEASED', released_at = now(), released_by = auth.uid()
   where id = p_manifest;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'dispatch.released', 'delivery_manifests', p_manifest,
          jsonb_build_object('state', 'RELEASED'));
end $$;

create or replace function driver_confirm_collection(p_manifest uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_state dispatch_state;
begin
  select state into v_state from delivery_manifests
   where id = p_manifest
     and (driver_user_id = auth.uid() or app_is_super_admin());
  if v_state is null then
    raise exception 'That delivery is not assigned to you';
  end if;
  if v_state <> 'RELEASED' then
    raise exception 'This delivery is % and cannot be collected', v_state;
  end if;

  update delivery_manifests set state = 'IN_TRANSIT', collected_at = now()
   where id = p_manifest;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'dispatch.collected', 'delivery_manifests', p_manifest,
          jsonb_build_object('state', 'IN_TRANSIT'));
end $$;

create or replace function driver_confirm_arrival(p_manifest uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_state dispatch_state;
begin
  select state into v_state from delivery_manifests
   where id = p_manifest
     and (driver_user_id = auth.uid() or app_is_super_admin());
  if v_state is null then
    raise exception 'That delivery is not assigned to you';
  end if;
  if v_state <> 'IN_TRANSIT' then
    raise exception 'This delivery is % and cannot be marked arrived', v_state;
  end if;

  update delivery_manifests set state = 'ARRIVED', arrived_at = now()
   where id = p_manifest;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(), 'dispatch.arrived', 'delivery_manifests', p_manifest,
          jsonb_build_object('state', 'ARRIVED'));
end $$;

-- HANDOVER — the custody-transfer event. The Institution's own act.
--
-- Note what this does NOT ask for: a quantity. The Manifest already says 120.
-- Making the receiver retype 120 adds a chance to type 12 and adds nothing else.
create or replace function confirm_handover(p_manifest uuid, p_with_issue boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_state dispatch_state; v_inst uuid;
begin
  select state, institution_id into v_state, v_inst
    from delivery_manifests where id = p_manifest;
  if v_state is null then raise exception 'Manifest not found'; end if;

  -- A Driver may never do this, even for their own manifest.
  if app_current_role() = 'driver' then
    raise exception 'A Driver cannot complete the institution handover';
  end if;
  if not (app_is_super_admin() or app_is_delivery_receiver(v_inst)) then
    raise exception
      'You are not authorised to receive deliveries for this institution';
  end if;
  if v_state <> 'ARRIVED' then
    raise exception 'This delivery is % and cannot be handed over', v_state;
  end if;

  update delivery_manifests
     set state = 'HANDED_OVER', handed_over_at = now(), received_by = auth.uid(),
         handover_with_issue = p_with_issue
   where id = p_manifest;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, new_value)
  values (auth.uid(),
          case when p_with_issue then 'delivery.handed_over_with_issue'
               else 'delivery.handed_over' end,
          'delivery_manifests', p_manifest,
          jsonb_build_object('state', 'HANDED_OVER', 'with_issue', p_with_issue,
                             'institution_id', v_inst));
end $$;

-- Has this service's food actually arrived? Read by the Classroom.
create or replace function app_service_handed_over(p_service uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select bool_or(dm.state = 'HANDED_OVER')
      from meal_services ms
      join final_demand fd on fd.meal_service_id = ms.id and fd.superseded_at is null
      join manifest_lines ml on ml.final_demand_id = fd.id
      join delivery_manifests dm on dm.id = ml.manifest_id
     where ms.id = p_service
  ), false);
$$;

-- =====================================================================
-- RLS + GRANTS
-- =====================================================================
alter table institution_delivery_configs   enable row level security;
alter table delivery_config_runs           enable row level security;
alter table delivery_config_run_periods    enable row level security;
alter table delivery_receivers             enable row level security;
alter table delivery_manifests             enable row level security;
alter table manifest_lines                 enable row level security;

grant select on institution_delivery_configs, delivery_config_runs,
                delivery_config_run_periods, delivery_receivers,
                delivery_manifests, manifest_lines to authenticated;
revoke all on institution_delivery_configs, delivery_config_runs,
              delivery_config_run_periods, delivery_receivers,
              delivery_manifests, manifest_lines from anon;

drop policy if exists delivery_config_select on institution_delivery_configs;
create policy delivery_config_select on institution_delivery_configs for select
  using (app_can_see_institution(institution_id) or app_current_role() = 'kitchen');

drop policy if exists delivery_config_runs_select on delivery_config_runs;
create policy delivery_config_runs_select on delivery_config_runs for select
  using (exists (select 1 from institution_delivery_configs c
                  where c.id = config_id
                    and (app_can_see_institution(c.institution_id)
                         or app_current_role() = 'kitchen')));

drop policy if exists delivery_config_run_periods_select on delivery_config_run_periods;
create policy delivery_config_run_periods_select on delivery_config_run_periods for select
  using (exists (select 1 from institution_delivery_configs c
                  where c.id = config_id
                    and (app_can_see_institution(c.institution_id)
                         or app_current_role() = 'kitchen')));

drop policy if exists delivery_receivers_select on delivery_receivers;
create policy delivery_receivers_select on delivery_receivers for select
  using (app_can_see_institution(institution_id));

-- THE DRIVER BOUNDARY, at the database. A Driver reads their OWN assigned
-- manifests and nothing else — not another Driver's, not another Institution's.
-- Parents are excluded from logistics entirely.
drop policy if exists delivery_manifests_select on delivery_manifests;
create policy delivery_manifests_select on delivery_manifests for select
  using (
    app_is_super_admin()
    or app_current_role() = 'kitchen'
    or (app_current_role() = 'driver' and driver_user_id = auth.uid())
    or (app_current_role() in ('school_admin', 'classroom_staff')
        and app_can_see_institution(institution_id))
  );

drop policy if exists manifest_lines_select on manifest_lines;
create policy manifest_lines_select on manifest_lines for select
  using (exists (select 1 from delivery_manifests dm where dm.id = manifest_id));

revoke all on function set_delivery_config(uuid,date,smallint,text,jsonb,jsonb) from public, anon;
revoke all on function set_delivery_receiver(uuid,uuid,boolean)                 from public, anon;
revoke all on function app_is_delivery_receiver(uuid)                           from public, anon;
revoke all on function build_manifests(uuid,date)                               from public, anon;
revoke all on function assign_manifest_driver(uuid,uuid)                        from public, anon;
revoke all on function release_manifest(uuid)                                   from public, anon;
revoke all on function driver_confirm_collection(uuid)                          from public, anon;
revoke all on function driver_confirm_arrival(uuid)                             from public, anon;
revoke all on function confirm_handover(uuid,boolean)                           from public, anon;
revoke all on function app_service_handed_over(uuid)                            from public, anon;

grant execute on function set_delivery_config(uuid,date,smallint,text,jsonb,jsonb) to authenticated;
grant execute on function set_delivery_receiver(uuid,uuid,boolean)                 to authenticated;
grant execute on function app_is_delivery_receiver(uuid)                           to authenticated;
grant execute on function build_manifests(uuid,date)                               to authenticated;
grant execute on function assign_manifest_driver(uuid,uuid)                        to authenticated;
grant execute on function release_manifest(uuid)                                   to authenticated;
grant execute on function driver_confirm_collection(uuid)                          to authenticated;
grant execute on function driver_confirm_arrival(uuid)                             to authenticated;
grant execute on function confirm_handover(uuid,boolean)                           to authenticated;
grant execute on function app_service_handed_over(uuid)                            to authenticated;
