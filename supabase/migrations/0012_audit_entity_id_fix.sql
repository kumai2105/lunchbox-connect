-- 0012: fix audit_write_row for tables whose PK isn't "id" ---------------------
-- audit_write_row() (0009) referenced new.id / old.id directly, which only
-- compiles/runs for tables that actually have an "id" column. app_users' PK
-- is user_id (0002), so the trg_audit_app_users trigger errored on every
-- write to app_users, discovered while bootstrapping the first super_admin.
-- Fix: resolve the entity id via jsonb so it works for either column name.

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
  rec_id uuid;
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

  rec_id := coalesce(
    (coalesce(newv, prev) ->> 'id')::uuid,
    (coalesce(newv, prev) ->> 'user_id')::uuid
  );

  insert into audit_log (actor_user_id, action, entity_type, entity_id, previous_value, new_value)
  values (auth.uid(), act, tg_table_name, rec_id, prev, newv);
  return coalesce(new, old);
end;
$$;
