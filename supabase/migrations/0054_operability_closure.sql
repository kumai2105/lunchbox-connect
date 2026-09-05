-- =====================================================================
-- 0054 — OPERABILITY CLOSURE
--
-- Forward-only. 0001–0053 are applied to production and are not edited: an
-- applied migration has to keep saying what was actually run.
--
-- Three changes, each one closing something an independent inspection proved
-- rather than something that looked untidy.
--
-- 1. A NAME TO ASSIGN A DELIVERY TO.
--
--    assign_manifest_driver() has existed since 0052 and the Kitchen has
--    always been allowed to call it. Nothing let the Kitchen find out WHICH
--    driver to name: app_users is readable only within your own tenant, and a
--    Driver belongs to LunchBox rather than to a site. The workflow was
--    therefore complete in the database and impossible in the product, which
--    is how "assign the driver by RPC" became a normal step.
--
--    The fix is a projection, not a wider policy. active_drivers() returns two
--    columns — who they are and what to call them — to the two roles that may
--    already assign. It is not a directory: no email, no phone, no institution,
--    no account state beyond the fact that an inactive Driver is not returned.
--    Widening app_users to populate a dropdown would have handed the Kitchen
--    every account in the system to solve a problem about four rows.
--
-- 2. AN ISSUE CANNOT SKIP ITS OWN LIFECYCLE.
--
--    0051 checked WHO may set a status and never checked WHAT the issue was
--    before. Every one of these was accepted:
--
--      OPEN                     -> CLOSED       (never actioned, never seen)
--      OPEN                     -> ACKNOWLEDGED (acknowledging nothing)
--      CLOSED                   -> ACTIONED     (a closed issue reopening)
--      ACTIONED                 -> ACTIONED     (silently replacing the note)
--
--    The approved lifecycle is OPEN -> LUNCHBOX_ACTIONED -> (the Institution
--    acknowledges, for a delivery issue) -> CLOSED, and this states it as the
--    database rule it always should have been. An internal Production, Packing
--    or Dispatch issue has no Institution in the loop, so it closes from
--    ACTIONED and can never be acknowledged at all.
--
--    Actioning now REQUIRES the note. "We actioned it" with no statement of
--    what was done is the shape of a record that means nothing six weeks later,
--    when somebody is asking what happened to a delivery.
--
-- 2b. THE SITE A RUN IS GOING TO.
--
--    manifests_for_date() projects the institution name onto the day's
--    manifests. The Kitchen could always READ its manifests and never read
--    `institutions`, so every Dispatch row and every printed label has been
--    missing the site since 0052. Found by the browser test that drives the
--    new Driver selector, whose label read "Driver for undefined run 1".
--
-- 3. A SEARCH_PATH THIS RELEASE OWED.
--
--    app_special_meal_reference lost the setting in 0049 and the advisor said
--    so. It is not SECURITY DEFINER and touches no table, so nothing could be
--    reached through it — but it was recorded as an open finding, and closing
--    a known warning inside the next migration that had to exist anyway is
--    cheaper than carrying it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. THE DRIVERS A DISPATCHER MAY NAME
-- ---------------------------------------------------------------------
create or replace function active_drivers()
returns table (user_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select u.user_id, u.full_name
    from app_users u
   where u.role = 'driver'
     and u.active
     and (app_is_super_admin() or app_current_role() = 'kitchen')
   order by u.full_name;
$$;

comment on function active_drivers() is
  'The Drivers a Kitchen or Super Admin may assign a manifest to. Two columns '
  'by design: this answers "who can I give this run to", not "show me the '
  'accounts". Any other caller receives no rows rather than an error, because '
  'an empty dropdown is the honest answer to a question they may not ask.';

-- ---------------------------------------------------------------------
-- 1b. AND THE SITE EACH RUN IS FOR
--
-- Found by the browser test that drives the new Dispatch row: the selector's
-- label came out as "Driver for undefined run 1".
--
-- Same defect as the Driver's screen in the last release, one role along.
-- delivery_manifests_select lets the Kitchen read every manifest — correctly,
-- the Kitchen dispatches them — but app_can_see_institution() has no `kitchen`
-- branch, so the Kitchen cannot read `institutions`. PostgREST returns an
-- unreadable embedded row as NULL rather than as an error, so
-- `select *, institutions(name)` handed the screen a manifest with no site on
-- it and no complaint.
--
-- It has been that way since 0052. The Dispatch table showed a blank
-- institution for every run, and the LABELS DIALOG — the sheet the packing
-- bench prints and sticks on the crate — put a blank line where the delivery
-- address should be. Nothing asserted the name, so nothing failed.
--
-- Fixed by projection, exactly as my_delivery_manifests() was: the predicate
-- below is delivery_manifests_select restated, so no role sees a manifest it
-- could not already see. The only thing that changes is that the row now
-- carries the name of the place it is going to.
-- ---------------------------------------------------------------------
create or replace function manifests_for_date(p_date date)
returns table (
  id                  uuid,
  institution_id      uuid,
  institution_name    text,
  service_date        date,
  run_number          smallint,
  window_from         time,
  window_to           time,
  delivery_point      text,
  state               dispatch_state,
  driver_user_id      uuid,
  handover_with_issue boolean,
  handed_over_at      timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.institution_id, i.name, m.service_date, m.run_number,
         m.window_from, m.window_to, m.delivery_point, m.state,
         m.driver_user_id, m.handover_with_issue, m.handed_over_at
    from delivery_manifests m
    join institutions i on i.id = m.institution_id
   where m.service_date = p_date
     and (
       app_is_super_admin()
       or app_current_role() = 'kitchen'
       or (app_current_role() = 'driver' and m.driver_user_id = auth.uid())
       or (app_current_role() in ('school_admin', 'classroom_staff')
           and app_can_see_institution(m.institution_id))
     )
   order by i.name, m.run_number;
$$;

comment on function manifests_for_date(date) is
  'The day''s delivery manifests a caller may see, each carrying the name of '
  'the institution it is going to. The predicate is delivery_manifests_select '
  'restated: this widens nothing, it only stops the Kitchen being shown a run '
  'with no destination on it.';

-- ---------------------------------------------------------------------
-- 2. THE ISSUE LIFECYCLE, ENFORCED
-- ---------------------------------------------------------------------
create or replace function advance_operational_issue(
  p_id uuid, p_status operational_issue_status, p_resolution text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_was   operational_issue_status;
  v_inst  uuid;
  v_stage operational_stage;
  v_role  app_role;
begin
  v_role := app_current_role();
  select status, institution_id, stage into v_was, v_inst, v_stage
    from operational_issues where id = p_id;
  if v_was is null then raise exception 'Issue not found'; end if;

  if v_was = 'CLOSED' then
    raise exception 'This issue is closed. Raise a new issue rather than reopening it';
  end if;
  if p_status = v_was then
    raise exception 'This issue is already %', replace(v_was::text, '_', ' ');
  end if;

  -- LunchBox actions and closes. The Institution may acknowledge its own.
  if p_status = 'LUNCHBOX_ACTIONED' then
    if v_role not in ('super_admin', 'kitchen') then
      raise exception 'Only LunchBox may action or close an issue';
    end if;
    if v_was <> 'OPEN' then
      raise exception 'Only an open issue can be actioned';
    end if;
    -- What was done is the whole value of the record.
    if coalesce(btrim(coalesce(p_resolution, '')), '') = '' then
      raise exception 'Describe what was done about this issue';
    end if;

  elsif p_status = 'INSTITUTION_ACKNOWLEDGED' then
    -- Only a delivery issue reaches the Institution at all; the Kitchen's
    -- internal production problems are not theirs to acknowledge, and RLS
    -- already keeps them from seeing one.
    if v_stage <> 'DELIVERY' or v_inst is null then
      raise exception 'Only a delivery issue is acknowledged by an institution';
    end if;
    if v_was <> 'LUNCHBOX_ACTIONED' then
      raise exception 'There is nothing to acknowledge until LunchBox has actioned this issue';
    end if;
    if not (app_is_super_admin() or app_can_manage_institution(v_inst)) then
      raise exception 'Only that institution may acknowledge this issue';
    end if;

  elsif p_status = 'CLOSED' then
    if v_role not in ('super_admin', 'kitchen') then
      raise exception 'Only LunchBox may action or close an issue';
    end if;
    if v_was = 'OPEN' then
      raise exception 'Action this issue before closing it';
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

-- ---------------------------------------------------------------------
-- 3. THE OUTSTANDING SEARCH_PATH
--
-- Body unchanged from 0049 — this adds the setting and nothing else.
-- ---------------------------------------------------------------------
create or replace function app_special_meal_reference(p_id uuid)
returns text language sql immutable set search_path = public as $$
  select 'SM-' || upper(substring(replace(p_id::text, '-', '') from 1 for 6));
$$;

-- ---------------------------------------------------------------------
-- GRANTS
--
-- Stated for every function this migration creates or replaces, including the
-- two that already had them: a `create or replace` keeps the existing ACL, but
-- relying on that means the file no longer says what is true, and 0047 exists
-- because eight functions inherited a default nobody had written down.
-- ---------------------------------------------------------------------
revoke all on function active_drivers()                                                 from public, anon;
revoke all on function manifests_for_date(date)                                          from public, anon;
revoke all on function advance_operational_issue(uuid,operational_issue_status,text)     from public, anon;
revoke all on function app_special_meal_reference(uuid)                                  from public, anon;

grant execute on function active_drivers()                                              to authenticated;
grant execute on function manifests_for_date(date)                                       to authenticated;
grant execute on function advance_operational_issue(uuid,operational_issue_status,text)  to authenticated;
