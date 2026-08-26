-- =====================================================================
-- OPERABILITY CLOSURE — the rules 0054 states
--
-- Two things the product now depends on and the database has to guarantee:
--
--   1. active_drivers() answers "who can I give this run to" for the two roles
--      that may assign, and answers it to nobody else — without any of them
--      gaining a wider read on app_users.
--   2. An operational issue cannot skip, repeat or reverse its lifecycle.
--
-- Self-contained disposable fixture, one transaction, ROLLBACK.
-- =====================================================================
begin;
do $$
declare
  v_super uuid; v_inst uuid; v_other uuid; v_kid uuid;
  v_driver uuid; v_driver2 uuid; v_gone uuid;
  v_admin uuid; v_other_admin uuid; v_staff uuid; v_kitchen uuid; v_parent uuid;
  v_delivery uuid; v_internal uuid;
  n bigint;
  caught text;
begin
  select user_id into v_super from app_users where role='super_admin' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);

  insert into institutions (name,kind) values ('ZZ OPC A','nursery') returning id into v_inst;
  insert into institutions (name,kind) values ('ZZ OPC B','nursery') returning id into v_other;
  insert into kitchens (name) values ('ZZ OPC Kitchen') returning id into v_kid;

  v_driver  := gen_random_uuid();
  v_driver2 := gen_random_uuid();
  v_gone    := gen_random_uuid();
  v_admin   := gen_random_uuid();
  v_other_admin := gen_random_uuid();
  v_staff   := gen_random_uuid();
  v_kitchen := gen_random_uuid();
  v_parent  := gen_random_uuid();

  insert into auth.users (id,email) values
    (v_driver,'zz.opc.d1@zz.test'), (v_driver2,'zz.opc.d2@zz.test'),
    (v_gone,'zz.opc.gone@zz.test'), (v_admin,'zz.opc.admin@zz.test'),
    (v_other_admin,'zz.opc.other@zz.test'), (v_staff,'zz.opc.staff@zz.test'),
    (v_kitchen,'zz.opc.kitchen@zz.test'), (v_parent,'zz.opc.parent@zz.test');
  insert into app_users (user_id,role,full_name,email,institution_id,kitchen_id,active) values
    (v_driver,'driver','ZZ OPC Driver One','zz.opc.d1@zz.test',null,null,true),
    (v_driver2,'driver','ZZ OPC Driver Two','zz.opc.d2@zz.test',null,null,true),
    (v_gone,'driver','ZZ OPC Driver Gone','zz.opc.gone@zz.test',null,null,false),
    (v_admin,'school_admin','ZZ OPC Admin','zz.opc.admin@zz.test',v_inst,null,true),
    (v_other_admin,'school_admin','ZZ OPC Other Admin','zz.opc.other@zz.test',v_other,null,true),
    (v_staff,'classroom_staff','ZZ OPC Staff','zz.opc.staff@zz.test',v_inst,null,true),
    (v_kitchen,'kitchen','ZZ OPC Kitchen User','zz.opc.kitchen@zz.test',null,v_kid,true),
    (v_parent,'parent','ZZ OPC Parent','zz.opc.parent@zz.test',null,null,true);

  -- Everything above is fixture creation and runs as the owner. From here on
  -- the suite is asking what a SIGNED-IN PERSON can do, and the owner bypasses
  -- RLS entirely — a raw table read taken without this line proves nothing.
  set local role authenticated;

  -- =================================================================
  -- d — THE DRIVER LIST
  -- =================================================================
  select count(*) into n from active_drivers()
   where user_id in (v_driver, v_driver2);
  if n <> 2 then
    raise exception 'FAIL a Super Admin saw % of this fixture''s 2 active Drivers', n;
  end if;
  select count(*) into n from active_drivers() where user_id = v_gone;
  if n <> 0 then raise exception 'FAIL a deactivated Driver was offered for assignment'; end if;
  raise notice 'PASS d1: a Super Admin is offered every active Driver and no deactivated one';

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_kitchen,'role','authenticated')::text, true);
  select count(*) into n from active_drivers() where user_id in (v_driver, v_driver2);
  if n <> 2 then
    raise exception 'FAIL the Kitchen could not read the Drivers it is allowed to assign (got %)', n;
  end if;
  -- The point of the projection: this does NOT come with a wider read.
  select count(*) into n from app_users where role = 'driver';
  if n <> 0 then
    raise exception 'FAIL the Kitchen read % driver rows from app_users directly', n;
  end if;
  raise notice 'PASS d2: the Kitchen can name a Driver without gaining a read on app_users';

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  select count(*) into n from active_drivers();
  if n <> 0 then raise exception 'FAIL an Institution Admin was given the Driver list (%)', n; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_parent,'role','authenticated')::text, true);
  select count(*) into n from active_drivers();
  if n <> 0 then raise exception 'FAIL a Parent was given the Driver list (%)', n; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_driver,'role','authenticated')::text, true);
  select count(*) into n from active_drivers();
  if n <> 0 then raise exception 'FAIL a Driver was given the roster of other Drivers (%)', n; end if;
  raise notice 'PASS d3: nobody else is offered the Driver list — not the site, the Parent or a Driver';

  -- =================================================================
  -- i — THE ISSUE LIFECYCLE
  -- =================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  v_delivery := report_operational_issue(
    'DELIVERY','Missing Item','ZZ OPC: two lunch packs short',v_inst,current_date);

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_kitchen,'role','authenticated')::text, true);
  v_internal := report_operational_issue(
    'PRODUCTION','Operational / Equipment','ZZ OPC: oven down for an hour',null,current_date);

  -- An open issue cannot be closed, and cannot be acknowledged.
  begin
    perform advance_operational_issue(v_delivery,'CLOSED','tidying up');
    raise exception 'FAIL an OPEN issue was closed without ever being actioned';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  begin
    perform advance_operational_issue(v_delivery,'INSTITUTION_ACKNOWLEDGED',null);
    raise exception 'FAIL an institution acknowledged an issue nobody had actioned';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS i1: an open issue cannot be closed or acknowledged — it must be actioned first';

  -- Actioning requires saying what was done.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_kitchen,'role','authenticated')::text, true);
  begin
    perform advance_operational_issue(v_delivery,'LUNCHBOX_ACTIONED','   ');
    raise exception 'FAIL an issue was actioned with no account of what was done';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  perform advance_operational_issue(v_delivery,'LUNCHBOX_ACTIONED','Two packs redelivered at 12:40');
  select count(*) into n from operational_issues
   where id = v_delivery and status = 'LUNCHBOX_ACTIONED'
     and resolution = 'Two packs redelivered at 12:40';
  if n <> 1 then raise exception 'FAIL actioning did not record the resolution'; end if;
  raise notice 'PASS i2: actioning requires — and records — what was actually done';

  -- The same status twice is not a way to rewrite the note.
  begin
    perform advance_operational_issue(v_delivery,'LUNCHBOX_ACTIONED','actually we did nothing');
    raise exception 'FAIL an actioned issue was actioned again, replacing the record';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS i3: an issue cannot be re-actioned to overwrite what was recorded';

  -- Only THAT institution may acknowledge, and only a delivery issue.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_other_admin,'role','authenticated')::text, true);
  begin
    perform advance_operational_issue(v_delivery,'INSTITUTION_ACKNOWLEDGED',null);
    raise exception 'FAIL another institution acknowledged this institution''s issue';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_kitchen,'role','authenticated')::text, true);
  perform advance_operational_issue(v_internal,'LUNCHBOX_ACTIONED','Second oven used; nothing late');
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_admin,'role','authenticated')::text, true);
  begin
    perform advance_operational_issue(v_internal,'INSTITUTION_ACKNOWLEDGED',null);
    raise exception 'FAIL an institution acknowledged an internal production issue';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  -- And cannot even see it.
  select count(*) into n from operational_issues where id = v_internal;
  if n <> 0 then
    raise exception 'FAIL an institution read the Kitchen''s internal production issue';
  end if;
  raise notice 'PASS i4: acknowledgement belongs to that institution, and only for a delivery issue';

  -- The normal course, end to end.
  perform advance_operational_issue(v_delivery,'INSTITUTION_ACKNOWLEDGED','Received, thank you');
  select count(*) into n from operational_issues
   where id = v_delivery and status = 'INSTITUTION_ACKNOWLEDGED';
  if n <> 1 then raise exception 'FAIL the institution''s acknowledgement did not persist'; end if;

  -- The institution acknowledges; it does not close.
  begin
    perform advance_operational_issue(v_delivery,'CLOSED',null);
    raise exception 'FAIL an institution closed a LunchBox issue';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_kitchen,'role','authenticated')::text, true);
  perform advance_operational_issue(v_delivery,'CLOSED','Closed after acknowledgement');
  perform advance_operational_issue(v_internal,'CLOSED',null);
  select count(*) into n from operational_issues
   where id in (v_delivery, v_internal) and status = 'CLOSED' and resolved_at is not null;
  if n <> 2 then raise exception 'FAIL % of 2 issues closed cleanly', n; end if;
  raise notice 'PASS i5: open -> actioned -> acknowledged -> closed, each step by its own party';

  -- Closed is closed.
  begin
    perform advance_operational_issue(v_delivery,'LUNCHBOX_ACTIONED','reopening');
    raise exception 'FAIL a closed issue was reopened';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  begin
    perform advance_operational_issue(v_internal,'CLOSED','again');
    raise exception 'FAIL a closed issue was closed a second time';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS i6: a closed issue stays closed — a new problem is a new issue';

  -- A Classroom Staff member is not LunchBox.
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_staff,'role','authenticated')::text, true);
  begin
    perform advance_operational_issue(v_internal,'LUNCHBOX_ACTIONED','not mine to action');
    raise exception 'FAIL classroom staff actioned an operational issue';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS i7: nobody outside LunchBox actions or closes an issue';

  -- =================================================================
  -- c — CORRECTIONS STAY NARROW
  -- =================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub',v_super,'role','authenticated')::text, true);
  begin
    perform correct_operational_record(
      'operational_issues', v_delivery, 'status', 'OPEN', 'trying to reopen sideways');
    raise exception 'FAIL a status was rewritten through the correction facility';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  begin
    perform correct_operational_record(
      'final_demand', gen_random_uuid(), 'total_required', '999', 'inflating demand');
    raise exception 'FAIL demand was corrected through the correction facility';
  exception when others then
    caught := sqlerrm;
    if caught like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS c1: correction refuses any record and field outside its allow-list';

  perform correct_operational_record(
    'operational_issues', v_delivery, 'category', 'Wrong Item', 'Recategorised after review');
  select count(*) into n from operational_issues
   where id = v_delivery and category = 'Wrong Item';
  if n <> 1 then raise exception 'FAIL the allowed correction did not apply'; end if;
  select count(*) into n from audit_log
   where action = 'record.corrected' and entity_id = v_delivery
     and previous_value->>'category' = 'Missing Item'
     and new_value->>'category' = 'Wrong Item'
     and reason = 'Recategorised after review';
  if n <> 1 then
    raise exception 'FAIL the correction did not preserve the previous value in Audit';
  end if;
  raise notice 'PASS c2: an allowed correction applies and keeps the original value in Audit';

  reset role;
  raise notice '---------------------------------------------------------';
  raise notice 'OPERABILITY CLOSURE: a dispatcher can name a Driver without';
  raise notice 'a wider read, and an issue cannot skip, repeat or reverse';
  raise notice 'its lifecycle.';
end $$;
rollback;
