-- 0015: fix classes INSERT RLS (self-referencing WITH CHECK never passes) ----
-- classes_write (0004) was a single `for all` policy whose WITH CHECK calls
-- app_can_manage_class(id), which re-queries `classes` by that same id. During
-- an INSERT the new row isn't visible to that self-referencing subquery yet,
-- so the check can never pass — class creation has been broken for every
-- role, including super_admin, since 0004. Never caught before because
-- nothing had exercised class creation against a live database until now.
-- students_insert (0004) already avoided this by checking institution_id
-- directly; splitting classes the same way.

-- classes_select (0004) is unaffected and stays as-is; only classes_write
-- (the "for all" policy) is replaced.
drop policy if exists classes_write on classes;

create policy classes_insert on classes for insert
  with check (app_can_manage_institution(institution_id));
create policy classes_update on classes for update
  using (app_can_manage_class(id)) with check (app_can_manage_class(id));
create policy classes_delete on classes for delete
  using (app_can_manage_class(id));
