-- 0009: approval-scope corrections -------------------------------------------
-- (a) Student operational eligibility becomes the confirmed institutional
--     billing status ACTIVE_BILLABLE_TO_NURSERY (docs/00 §8, docs/03 §5-7).
--     The free/reduced/paid "eligibility" concept from the earlier draft is
--     REMOVED: it was not part of the approved spec. The full status list and
--     transitions remain NOT_YET_DEFINED, so the column accepts exactly the
--     one approved value or NULL (undeclared = not operationally eligible).
-- (b) Classroom staff scope moves from institution-wide to ASSIGNED CLASSES
--     (docs/02 §25-27, AT-032 / AT-081) — enforced in SQL, not just UI.
-- (c) Generic audit log for important administrative changes
--     (docs/04 §43, docs/08 §18, AT-110). The exact audited-action list is
--     NOT_YET_DEFINED; students + operational status are covered.
-- (d) DROP messages: spec has NO communication platform and bans live chat
--     (docs/02 §46, AT-130). Parent->school note feature is removed.

-- (d) messages ---------------------------------------------------------------
drop table if exists messages;

-- (a) operational status ------------------------------------------------------
alter table students
  add column operational_status text
  check (operational_status = 'ACTIVE_BILLABLE_TO_NURSERY');

comment on column students.operational_status is
  'Only ACTIVE_BILLABLE_TO_NURSERY is an approved value (docs/11 §6). NULL '
  'means no approved eligible status. All other statuses NOT_YET_DEFINED.';

create index idx_students_operational_status on students (operational_status);

-- (c) audit ------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references app_users (user_id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text
);

create index idx_audit_log_entity on audit_log (entity_type, entity_id, occurred_at desc);
create index idx_audit_log_actor on audit_log (actor_user_id, occurred_at desc);

alter table audit_log enable row level security;
-- reads are reserved for Super Admin; writes happen only via the
-- SECURITY DEFINER triggers below, never from the client.
create policy audit_log_select on audit_log for select
  using (app_is_super_admin());

revoke all on audit_log from anon;

create or replace function audit_write_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  act text := tg_op;
  prev jsonb := null;
  newv jsonb := null;
begin
  if tg_op = 'DELETE' then
    act := 'delete';
    prev := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    act := 'update';
    prev := to_jsonb(old);
    newv := to_jsonb(new);
  elsif tg_op = 'INSERT' then
    act := 'create';
    newv := to_jsonb(new);
  end if;

  insert into audit_log (actor_user_id, action, entity_type, entity_id, previous_value, new_value)
  values (auth.uid(), act, tg_table_name, coalesce(new.id, old.id), prev, newv);
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_students
  after insert or update or delete on students
  for each row execute function audit_write_row();
create trigger trg_audit_menus
  after insert or update or delete on menus
  for each row execute function audit_write_row();
create trigger trg_audit_app_users
  after insert or update or delete on app_users
  for each row execute function audit_write_row();

-- eligibility review workflow tables from the earlier build are removed:
-- they modelled a family-means-tested entitlement that is not in the spec.
drop table if exists eligibility;